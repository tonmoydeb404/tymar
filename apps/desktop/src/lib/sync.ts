import { TABLES } from "@packages/domain/index";
import type { SupabaseClient } from "@supabase/supabase-js";
import { api, type ProjectIpc, type TaskIpc, type TimeEntryIpc } from "./api";

// ---- Row converters: Supabase Postgres row → IPC row with sync_status=synced ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PgRow = Record<string, any>;

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
  };
}

// ---- Push: dirty local rows → Supabase ----

async function pushDirtyRows(sb: SupabaseClient, userId: string): Promise<void> {
  const pending = await api.getPendingSync(userId);
  const ack = { project_ids: [] as string[], task_ids: [] as string[], entry_ids: [] as string[] };

  for (const p of pending.projects) {
    const { sync_status: _, ...row } = p;
    if (p.sync_status === "pending_delete") {
      await sb.from(TABLES.projects).delete().eq("id", p.id);
    } else {
      await sb.from(TABLES.projects).upsert(row);
    }
    ack.project_ids.push(p.id);
  }

  for (const t of pending.tasks) {
    const { sync_status: _, ...row } = t;
    if (t.sync_status === "pending_delete") {
      await sb.from(TABLES.tasks).delete().eq("id", t.id);
    } else {
      await sb.from(TABLES.tasks).upsert(row);
    }
    ack.task_ids.push(t.id);
  }

  for (const e of pending.time_entries) {
    const { sync_status: _, entry_type: __, ...rest } = e as TimeEntryIpc & { entry_type?: unknown };
    const row = { ...rest, type: e.type };
    if (e.sync_status === "pending_delete") {
      await sb.from(TABLES.timeEntries).delete().eq("id", e.id);
    } else {
      await sb.from(TABLES.timeEntries).upsert(row);
    }
    ack.entry_ids.push(e.id);
  }

  if (ack.project_ids.length + ack.task_ids.length + ack.entry_ids.length > 0) {
    await api.ackSyncPush(userId, ack);
  }
}

// ---- Pull: latest remote rows → local SQLite ----

async function pullLatest(sb: SupabaseClient, userId: string): Promise<void> {
  const [{ data: projects }, { data: tasks }, { data: entries }] = await Promise.all([
    sb
      .from(TABLES.projects)
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(200),
    sb
      .from(TABLES.tasks)
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(500),
    sb
      .from(TABLES.timeEntries)
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(500),
  ]);

  await api.applySyncPull({
    projects: (projects ?? []).map(pgToProject),
    tasks: (tasks ?? []).map(pgToTask),
    time_entries: (entries ?? []).map(pgToTimeEntry),
  });
}

// ---- Public API ----

/** Full bidirectional sync: push dirty rows first, then pull latest. */
export async function runSync(sb: SupabaseClient, userId: string): Promise<void> {
  try {
    await pushDirtyRows(sb, userId);
  } catch {
    // Push failures are non-fatal: dirty rows stay dirty and are retried next cycle.
  }
  try {
    await pullLatest(sb, userId);
  } catch {
    // Pull failures are non-fatal: stale local reads are acceptable offline.
  }
}
