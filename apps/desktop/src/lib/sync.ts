import { TABLES } from "@packages/domain/index";
import type { SupabaseClient } from "@supabase/supabase-js";
import { api, type ProjectIpc, type TaskIpc, type TimeEntryIpc, type WorkspaceIpc } from "./api";

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
const PULL_MAX = { workspaces: 1000, projects: 2000, tasks: 5000, entries: 10000 };

/** Every Nth cycle ignores the cursors and re-pulls everything — a cheap
 * safety net against a missed row (clock skew, cursor drift). */
const FULL_PULL_EVERY = 5;
let cycleCount = 0;

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

export function pgToWorkspace(r: PgRow): WorkspaceIpc {
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

export function pgToProject(r: PgRow): ProjectIpc {
  return {
    id: String(r.id),
    user_id: String(r.user_id ?? ""),
    workspace_id: (r.workspace_id as string | null) ?? null,
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

export function pgToTask(r: PgRow): TaskIpc {
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

export function pgToTimeEntry(r: PgRow): TimeEntryIpc {
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

type PushRow = WorkspaceIpc | ProjectIpc | TaskIpc | TimeEntryIpc;

/** True when the row has failed too many times and should wait for a
 * manual retry instead of churning every cycle. */
function beyondRetryCap(row: PushRow): boolean {
  return row.sync_attempts >= MAX_SYNC_ATTEMPTS;
}

async function markRowFailed(
  kind: "workspace" | "project" | "task" | "entry",
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
 * a single failure can never mark its siblings as synced. Workspaces are
 * pushed first, then projects, then tasks, entries last — children are
 * skipped when their parent failed this cycle (the server would reject them
 * on FK anyway). Rows past the retry cap are counted as `blocked` — they
 * need a manual retry and must surface. */
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

  const failedWorkspaces = new Set<string>();
  const failedProjects = new Set<string>();
  const failedTasks = new Set<string>();

  for (const w of pending.workspaces) {
    if (!opts.force && beyondRetryCap(w)) {
      blocked += 1;
      continue;
    }
    try {
      if (w.sync_status === "pending_delete") {
        await sbExec(sb.from(TABLES.workspaces).delete().eq("id", w.id));
      } else {
        await sbExec(sb.from(TABLES.workspaces).upsert(remoteRow(w) as PgRow));
      }
      await api.ackSyncPush(userId, {
        workspace_ids: [w.id],
        project_ids: [],
        task_ids: [],
        entry_ids: [],
        versions: { [w.id]: w.updated_at },
      });
      pushed += 1;
    } catch (err) {
      failed += 1;
      errors.push(err);
      failedWorkspaces.add(w.id);
      void markRowFailed("workspace", w.id, firstError([err]));
    }
  }

  for (const p of pending.projects) {
    if (!opts.force && beyondRetryCap(p)) {
      blocked += 1;
      continue;
    }
    if (p.workspace_id && failedWorkspaces.has(p.workspace_id)) continue; // parent failed — retry next cycle
    try {
      if (p.sync_status === "pending_delete") {
        await sbExec(sb.from(TABLES.projects).delete().eq("id", p.id));
      } else {
        await sbExec(
          sb.from(TABLES.projects).upsert(remoteRow(p) as PgRow),
        );
      }
      await api.ackSyncPush(userId, {
        workspace_ids: [],
        project_ids: [p.id],
        task_ids: [],
        entry_ids: [],
        versions: { [p.id]: p.updated_at },
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
        workspace_ids: [],
        project_ids: [],
        task_ids: [t.id],
        entry_ids: [],
        versions: { [t.id]: t.updated_at },
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
        workspace_ids: [],
        project_ids: [],
        task_ids: [],
        entry_ids: [e.id],
        versions: { [e.id]: e.updated_at },
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

// ---- Pull: remote changes since the per-table cursor → local SQLite ----
//
// Each table keeps a cursor (the newest `updated_at` already applied). A
// pull only asks for rows at or after it, oldest first, so a cycle costs a
// handful of rows instead of re-downloading the whole account. The cursor is
// inclusive (`>=`) because several rows can share a millisecond; re-applying
// a row is a no-op (last-write-wins on updated_at, dirty rows protected).

type PullTable = "workspaces" | "projects" | "tasks" | "time_entries";

const cursorKey = (userId: string, table: PullTable) =>
  `sync_cursor:${userId}:${table}`;

async function pullSince(
  sb: SupabaseClient,
  table: string,
  userId: string,
  cursor: string | null,
  max: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const rows: PgRow[] = [];
  for (let from = 0; from < max; from += PULL_PAGE) {
    let query = sb.from(table).select("*").eq("user_id", userId);
    if (cursor) query = query.gte("updated_at", cursor);
    const { data, error } = await query
      .order("updated_at", { ascending: true })
      .range(from, from + PULL_PAGE - 1);
    if (error) throw new Error(error.message || "Pull failed.");
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PULL_PAGE) break; // last page
  }
  return rows;
}

function newestUpdatedAt(rows: PgRow[], fallback: string | null): string | null {
  let best = fallback;
  for (const r of rows) {
    const v = typeof r.updated_at === "string" ? r.updated_at : null;
    if (v && (!best || v > best)) best = v;
  }
  return best;
}

/** Every id the server holds for this table, or null when the list could
 * not be read completely (cap hit) — pruning on a partial list would delete
 * rows that still exist. */
async function fetchAllIds(
  sb: SupabaseClient,
  table: string,
  userId: string,
  max: number,
): Promise<string[] | null> {
  const ids: string[] = [];
  const page = 1000;
  for (let from = 0; from < max; from += page) {
    const { data, error } = await sb
      .from(table)
      .select("id")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message || "Pull failed.");
    ids.push(...(data ?? []).map((r) => String(r.id)));
    if (!data || data.length < page) return ids;
  }
  return null;
}

async function pullLatest(
  sb: SupabaseClient,
  userId: string,
  opts: { full: boolean },
): Promise<void> {
  const settings = await api.getSettings();
  const cursors: Record<PullTable, string | null> = {
    workspaces: null,
    projects: null,
    tasks: null,
    time_entries: null,
  };
  if (!opts.full) {
    for (const t of Object.keys(cursors) as PullTable[]) {
      cursors[t] = settings[cursorKey(userId, t)] ?? null;
    }
  }

  const [workspaces, projects, tasks, entries] = await Promise.all([
    pullSince(sb, TABLES.workspaces, userId, cursors.workspaces, PULL_MAX.workspaces),
    pullSince(sb, TABLES.projects, userId, cursors.projects, PULL_MAX.projects),
    pullSince(sb, TABLES.tasks, userId, cursors.tasks, PULL_MAX.tasks),
    pullSince(sb, TABLES.timeEntries, userId, cursors.time_entries, PULL_MAX.entries),
  ]);

  await api.applySyncPull({
    workspaces: workspaces.map(pgToWorkspace),
    projects: projects.map(pgToProject),
    tasks: tasks.map(pgToTask),
    time_entries: entries.map(pgToTimeEntry),
  });

  // Full pass: also learn what the server deleted. Incremental pulls only
  // see changed rows, so removals are found by diffing the id lists. Done
  // after the apply so a row just pulled is never pruned.
  if (opts.full) {
    const kinds: ["workspace" | "project" | "task" | "entry", string, number][] = [
      ["workspace", TABLES.workspaces, PULL_MAX.workspaces],
      ["project", TABLES.projects, PULL_MAX.projects],
      ["task", TABLES.tasks, PULL_MAX.tasks],
      ["entry", TABLES.timeEntries, PULL_MAX.entries],
    ];
    for (const [kind, table, max] of kinds) {
      const remoteIds = await fetchAllIds(sb, table, userId, max);
      if (remoteIds) await api.pruneSynced(userId, kind, { remoteIds });
    }
  }

  // Advance cursors only after the rows are safely in SQLite.
  const next: [PullTable, PgRow[]][] = [
    ["workspaces", workspaces],
    ["projects", projects],
    ["tasks", tasks],
    ["time_entries", entries],
  ];
  for (const [table, rows] of next) {
    const newest = newestUpdatedAt(rows, cursors[table]);
    if (newest && newest !== cursors[table]) {
      await api.setSetting(cursorKey(userId, table), newest);
    }
  }
}

// ---- Public API ----

/** At most one cycle runs at a time. A call that arrives mid-cycle queues
 * exactly one follow-up pass (so changes made during the cycle are never
 * skipped) and resolves with the outcome of that final pass — which makes
 * `runSync` usable as a flush ("everything local is now on the server"). */
let running: Promise<SyncOutcome> | null = null;
let queued = false;
let queuedForce = false;

export function runSync(
  sb: SupabaseClient,
  userId: string,
  opts: { force?: boolean } = {},
): Promise<SyncOutcome> {
  if (running) {
    queued = true;
    queuedForce ||= opts.force ?? false;
    return running;
  }
  running = (async () => {
    let outcome: SyncOutcome;
    let force = opts.force ?? false;
    do {
      queued = false;
      outcome = await syncOnce(sb, userId, { force });
      force = queuedForce;
      queuedForce = false;
    } while (queued);
    return outcome;
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce(
  sb: SupabaseClient,
  userId: string,
  opts: { force?: boolean },
): Promise<SyncOutcome> {
  const push = await pushDirtyRows(sb, userId, { force: opts.force ?? false });

  let pullFailed = false;
  let pullError: unknown = null;
  try {
    cycleCount += 1;
    await pullLatest(sb, userId, {
      full: opts.force === true || cycleCount === 1 || cycleCount % FULL_PULL_EVERY === 0,
    });
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
}
