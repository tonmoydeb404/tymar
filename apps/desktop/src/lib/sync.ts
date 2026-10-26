import { TABLES } from "@packages/domain/index";
import type { SupabaseClient } from "@supabase/supabase-js";
import { api, type ProjectIpc, type TaskIpc, type TimeEntryIpc } from "./api";

// ---- Sync engine: push dirty local rows → Supabase, pull remote rows → SQLite.
//
// Every Supabase response is checked: the SDK resolves API errors (RLS denial,
// FK violation, expired token) as `{ error }` instead of throwing, so an
// unchecked call reports success while the row silently never reaches the
// server. Failures mark the row (sync_attempts/last_sync_error) and are
// reported to the caller — nothing is acked that didn't actually land. ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PgRow = Record<string, any>;

/** Rows past this many consecutive failed pushes stop retrying until a
 * manual sync (must match MAX_SYNC_ATTEMPTS in src-tauri/src/db.rs). */
const MAX_SYNC_ATTEMPTS = 10;

const PULL_PAGE = 250;
const PULL_MAX = { projects: 500, tasks: 1500, entries: 2000 };

export type SyncOutcome = {
  /** A full push+pull cycle ran without any failure. */
  ok: boolean;
  /** Network unreachable (distinct from a server-side rejection). */
  offline: boolean;
  pushed: number;
  failed: number;
  /** First failure message, for surfacing in the UI. */
  error: string | null;
};

/** Heuristic: network-level failures (offline, DNS, timeout) vs. API errors. */
function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|network request|load failed|timed?\s*out|temporarily unavailable/i.test(
    message,
  );
}

function firstError(errors: unknown[]): string | null {
  for (const err of errors) {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === "string" && err) return err;
  }
  return errors.length > 0 ? "Sync failed." : null;
}

/** Awaits a Supabase call and throws its `error` — the SDK resolves
 * PostgREST errors instead of rejecting, so this check is mandatory. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sbExec(call: PromiseLike<{ error: any }>): Promise<void> {
  const { error } = await call;
  if (error) throw new Error(error.message || "Supabase request failed.");
}

/** Strips local-only sync metadata — Supabase tables don't have these. */
function remoteRow(row: Record<string, unknown>): Record<string, unknown> {
  const {
    sync_status: _s,
    sync_attempts: _a,
    last_sync_error: _e,
    entry_type: _t,
    ...rest
  } = row;
  return rest;
}

// ---- Row converters: Supabase Postgres row → IPC row with sync_status=synced ----

function pgToProject(r: PgRow): ProjectIpc {
  return {
    id: String(r.id),
    user_id: String(r.user_id ?? ""),
    name: String(r.name ?? ""),
    description: r.description as string | null,
    status: String(r.status ?? "ACTIVE"),
    deleted_at: r.deleted_at as string | null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
    sync_status: "synced",
    sync_attempts: 0,
    last_sync_error: null,
  };
}

function pgToTask(r: PgRow): TaskIpc {
  return {
    id: String(r.id),
    user_id: String(r.user_id ?? ""),
    project_id: String(r.project_id ?? ""),
    title: String(r.title ?? ""),
    description: r.description as string | null,
    status: String(r.status ?? "TODO"),
    priority: String(r.priority ?? "MEDIUM"),
    due_date: r.due_date as string | null,
    completed_at: r.completed_at as string | null,
    deleted_at: r.deleted_at as string | null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
    sync_status: "synced",
    sync_attempts: 0,
    last_sync_error: null,
  };
}

function pgToTimeEntry(r: PgRow): TimeEntryIpc {
  return {
    id: String(r.id),
    user_id: String(r.user_id ?? ""),
    task_id: r.task_id as string | null,
    project_id: r.project_id as string | null,
    type: String(r.type ?? "WORK"),
    started_at: String(r.started_at ?? ""),
    ended_at: r.ended_at as string | null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
    sync_status: "synced",
    sync_attempts: 0,
    last_sync_error: null,
  };
}

// ---- Push: dirty local rows → Supabase ----

type PushRow = ProjectIpc | TaskIpc | TimeEntryIpc;

/** True when the row has failed too many times and should wait for a
 * manual retry instead of churning every cycle. */
function beyondRetryCap(row: PushRow): boolean {
  return row.sync_attempts >= MAX_SYNC_ATTEMPTS;
}

async function markRowFailed(
  kind: "project" | "task" | "entry",
  id: string,
  error: string | null,
): Promise<void> {
  try {
    await api.markSyncFailed(kind, id, error ?? "Push failed.");
  } catch {
    // Failure bookkeeping must never break the sync cycle itself.
  }
}

/** Pushes every pending row, one at a time, acking each row individually so
 * a single failure can never mark its siblings as synced. Entries are pushed
 * last and skipped when their parent task/project failed this cycle (the
 * server would reject them on FK anyway). Rows past the retry cap are
 * counted as `blocked` — they need a manual retry and must surface. */
async function pushDirtyRows(
  sb: SupabaseClient,
  userId: string,
  opts: { force: boolean },
): Promise<{ pushed: number; failed: number; blocked: number; errors: unknown[] }> {
  const pending = await api.getPendingSync(userId);
  let pushed = 0;
  let failed = 0;
  let blocked = 0;
  const errors: unknown[] = [];

  const failedProjects = new Set<string>();
  const failedTasks = new Set<string>();

  for (const p of pending.projects) {
    if (!opts.force && beyondRetryCap(p)) {
      blocked += 1;
      continue;
    }
    try {
      if (p.sync_status === "pending_delete") {
        await sbExec(sb.from(TABLES.projects).delete().eq("id", p.id));
      } else {
        await sbExec(
          sb.from(TABLES.projects).upsert(remoteRow(p) as PgRow),
        );
      }
      await api.ackSyncPush(userId, {
        project_ids: [p.id],
        task_ids: [],
        entry_ids: [],
      });
      pushed += 1;
    } catch (err) {
      failed += 1;
      errors.push(err);
      failedProjects.add(p.id);
      void markRowFailed("project", p.id, firstError([err]));
    }
  }

  for (const t of pending.tasks) {
    if (!opts.force && beyondRetryCap(t)) {
      blocked += 1;
      continue;
    }
    if (failedProjects.has(t.project_id)) continue; // parent failed — retry next cycle
    try {
      if (t.sync_status === "pending_delete") {
        await sbExec(sb.from(TABLES.tasks).delete().eq("id", t.id));
      } else {
        await sbExec(sb.from(TABLES.tasks).upsert(remoteRow(t) as PgRow));
      }
      await api.ackSyncPush(userId, {
        project_ids: [],
        task_ids: [t.id],
        entry_ids: [],
      });
      pushed += 1;
    } catch (err) {
      failed += 1;
      errors.push(err);
      failedTasks.add(t.id);
      void markRowFailed("task", t.id, firstError([err]));
    }
  }

  for (const e of pending.time_entries) {
    if (!opts.force && beyondRetryCap(e)) {
      blocked += 1;
      continue;
    }
    // Skip entries whose parent failed this cycle (FK) or was never pushed.
    if (e.project_id && failedProjects.has(e.project_id)) continue;
    if (e.task_id && failedTasks.has(e.task_id)) continue;
    try {
      if (e.sync_status === "pending_delete") {
        await sbExec(sb.from(TABLES.timeEntries).delete().eq("id", e.id));
      } else {
        await sbExec(
          sb.from(TABLES.timeEntries).upsert(remoteRow(e) as PgRow),
        );
      }
      await api.ackSyncPush(userId, {
        project_ids: [],
        task_ids: [],
        entry_ids: [e.id],
      });
      pushed += 1;
    } catch (err) {
      failed += 1;
      errors.push(err);
      void markRowFailed("entry", e.id, firstError([err]));
    }
  }

  return { pushed, failed, blocked, errors };
}

// ---- Pull: latest remote rows → local SQLite ----

/** Pages through a table until exhausted (or the per-table cap) — the old
 * single `.limit(500)` silently dropped everything beyond the first page. */
async function pullTable(
  sb: SupabaseClient,
  table: string,
  order: string,
  max: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const rows: PgRow[] = [];
  for (let from = 0; from < max; from += PULL_PAGE) {
    const to = Math.min(from + PULL_PAGE - 1, max - 1);
    const { data, error } = await sb
      .from(table)
      .select("*")
      .order(order, { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message || "Pull failed.");
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < to - from + 1) break; // last page
  }
  return rows;
}

async function pullLatest(sb: SupabaseClient, userId: string): Promise<void> {
  const [projects, tasks, entries] = await Promise.all([
    pullTable(sb, TABLES.projects, "updated_at", PULL_MAX.projects),
    pullTable(sb, TABLES.tasks, "updated_at", PULL_MAX.tasks),
    pullTable(sb, TABLES.timeEntries, "started_at", PULL_MAX.entries),
  ]);

  await api.applySyncPull({
    projects: projects
      .filter((r) => r.user_id === userId)
      .map(pgToProject),
    tasks: tasks.filter((r) => r.user_id === userId).map(pgToTask),
    time_entries: entries
      .filter((r) => r.user_id === userId)
      .map(pgToTimeEntry),
  });
}

// ---- Public API ----

let inFlight = false;

/** Full bidirectional sync: push dirty rows first, then pull latest. Returns
 * what happened instead of swallowing failures. Concurrent calls are ignored
 * (the interval, visibility handler and mutation debounce can overlap). */
export async function runSync(
  sb: SupabaseClient,
  userId: string,
  opts: { force?: boolean } = {},
): Promise<SyncOutcome> {
  if (inFlight) {
    return { ok: true, offline: false, pushed: 0, failed: 0, error: null };
  }
  inFlight = true;
  try {
    const push = await pushDirtyRows(sb, userId, { force: opts.force ?? false });

    let pullFailed = false;
    let pullError: unknown = null;
    try {
      await pullLatest(sb, userId);
    } catch (err) {
      pullFailed = true;
      pullError = err;
    }

    const errors = [...push.errors, ...(pullFailed ? [pullError] : [])];
    const offline = errors.length > 0 && errors.every(isNetworkError);
    const blockedMessage =
      push.blocked > 0
        ? `${push.blocked} change${
            push.blocked === 1 ? "" : "s"
          } stopped syncing after repeated failures — retry to force them.`
        : null;
    return {
      ok: push.failed === 0 && !pullFailed && push.blocked === 0,
      offline,
      pushed: push.pushed,
      failed: push.failed + (pullFailed ? 1 : 0),
      error: firstError(errors) ?? blockedMessage,
    };
  } finally {
    inFlight = false;
  }
}
