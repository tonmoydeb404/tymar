import {
  TABLES,
  type EntryType,
  type Profile,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TimeEntry,
} from "@packages/domain/index";
import { api, type TaskIpc, type TimeEntryIpc } from "./api";
import { getSupabaseClient } from "./supabase";
import { notifyLocalMutation } from "./sync-bus";

// ---- Row → domain mappers (exported for realtime.ts) ----
// These work for both SQLite IPC rows and Supabase realtime payloads —
// both use the same snake_case column names.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function toProject(row: Row): Project {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    userId: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    description: str(row.description),
    status: (row.status as ProjectStatus) ?? "ACTIVE",
    deletedAt: str(row.deleted_at),
  };
}

export function toTask(row: Row): Task {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    userId: String(row.user_id ?? ""),
    projectId: String(row.project_id ?? ""),
    title: String(row.title ?? ""),
    description: str(row.description),
    status: (row.status as TaskStatus) ?? "TODO",
    priority: (row.priority as TaskPriority) ?? "MEDIUM",
    dueDate: str(row.due_date),
    completedAt: str(row.completed_at),
    deletedAt: str(row.deleted_at),
  };
}

export function toProfile(row: Row): Profile {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    userId: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    avatarUrl: str(row.avatar_url),
    timezone: String(row.timezone ?? "UTC"),
  };
}

export function toTimeEntry(row: Row): TimeEntry {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    userId: String(row.user_id ?? ""),
    taskId: str(row.task_id),
    projectId: str(row.project_id),
    // IPC rows use "type"; Supabase realtime rows also use "type"
    type: (row.type as EntryType) ?? "WORK",
    startedAt: String(row.started_at ?? ""),
    endedAt: str(row.ended_at),
  };
}

// ---- Projects (read from local SQLite) ----

export async function listProjects(userId: string): Promise<Project[]> {
  const rows = await api.listProjects(userId);
  return rows.map(toProject);
}

export async function queryProjects(
  userId: string,
  opts: { search?: string; limit?: number } = {},
): Promise<Project[]> {
  const rows = await api.listProjects(userId);
  let results = rows
    .filter((r) => r.status === "ACTIVE" && !r.deleted_at)
    .map(toProject);
  if (opts.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    results = results.filter((p) => p.name.toLowerCase().includes(q));
  }
  return results.slice(0, opts.limit ?? 20);
}

export async function getProject(projectId: string): Promise<Project | null> {
  const userId = await resolveUserId();
  if (!userId) return null;
  const rows = await api.listProjects(userId);
  const row = rows.find((r) => r.id === projectId);
  return row ? toProject(row) : null;
}

// ---- Tasks (read from local SQLite) ----

export async function listTasks(userId: string): Promise<Task[]> {
  const rows = await api.listTasks(userId);
  return rows.map(toTask);
}

export async function queryTasks(
  userId: string,
  opts: { projectId?: string; search?: string; limit?: number } = {},
): Promise<Task[]> {
  const rows = await api.listTasks(userId);
  let results = rows
    .filter((r) => r.status !== "DONE" && !r.deleted_at)
    .map(toTask);
  if (opts.projectId) {
    results = results.filter((t) => t.projectId === opts.projectId);
  }
  if (opts.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    results = results.filter((t) => t.title.toLowerCase().includes(q));
  }
  return results.slice(0, opts.limit ?? 20);
}

export async function getTask(taskId: string): Promise<Task | null> {
  const userId = await resolveUserId();
  if (!userId) return null;
  const rows = await api.listTasks(userId);
  const row = rows.find((r) => r.id === taskId);
  return row ? toTask(row) : null;
}

export async function createTask(
  userId: string,
  projectId: string,
  title: string,
): Promise<Task> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("A task title is required.");
  const now = new Date().toISOString();
  const ipcRow: TaskIpc = {
    id: crypto.randomUUID(),
    user_id: userId,
    project_id: projectId,
    title: trimmed,
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    due_date: null,
    completed_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    sync_status: "pending_create",
    sync_attempts: 0,
    last_sync_error: null,
  };
  await api.upsertTask(ipcRow);
  // Push to Supabase async — a background sync will retry on failure.
  void pushRowToSupabase(TABLES.tasks, ipcRow);
  notifyLocalMutation();
  return toTask(ipcRow);
}

// ---- Profile (not in SQLite — read from Supabase directly) ----

export async function getProfile(userId: string): Promise<Profile | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data } = await sb
    .from(TABLES.profiles)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? toProfile(data) : null;
}

// ---- Time entries (reads from SQLite; writes to SQLite + Supabase) ----

export async function getActiveTimeEntries(userId: string): Promise<TimeEntry[]> {
  const rows = await api.getActiveTimeEntries(userId);
  return rows.map(toTimeEntry);
}

/** Queries Supabase directly for open entries — used by the timer so it
 * sees entries started on other devices without waiting for a full sync.
 * Throws on failure so callers can surface the outage; there is no silent
 * local fallback (a failed check must be visible, not look like "nothing
 * is running"). */
export async function getActiveTimeEntriesFromCloud(
  userId: string,
): Promise<TimeEntry[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured.");
  const { data, error } = await sb
    .from(TABLES.timeEntries)
    .select("*")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false });
  if (error) throw new Error(error.message || "Couldn't query open entries.");
  return (data ?? []).map(toTimeEntry);
}

export async function listTimeEntries(
  userId: string,
  limit = 200,
): Promise<TimeEntry[]> {
  const rows = await api.listTimeEntries(userId, Math.min(Math.max(limit, 1), 500));
  return rows.map(toTimeEntry);
}

/** Creates the live (open-ended) record locally first, then pushes to Supabase
 * so realtime can propagate it to other devices. */
export async function createOpenTimeEntry(
  userId: string,
  entry: {
    task_id: string | null;
    project_id: string | null;
    type: EntryType;
    started_at: string;
  },
): Promise<TimeEntry> {
  const now = new Date().toISOString();
  const ipcRow: TimeEntryIpc = {
    id: crypto.randomUUID(),
    user_id: userId,
    task_id: entry.task_id,
    project_id: entry.project_id,
    type: entry.type,
    started_at: entry.started_at,
    ended_at: null,
    created_at: now,
    updated_at: now,
    sync_status: "pending_create",
    sync_attempts: 0,
    last_sync_error: null,
  };
  await api.insertTimeEntry(ipcRow);
  void pushTimeEntryCreate(userId, ipcRow);
  notifyLocalMutation();
  return toTimeEntry(ipcRow);
}

/** Closes an open entry locally then pushes the update to Supabase.
 * Throws when no local open row exists — callers fall back to
 * `closeTimeEntryRemote` for entries adopted from the cloud. */
export async function closeTimeEntry(
  entryId: string,
  endedAtIso: string,
): Promise<TimeEntry> {
  const closed = await api.closeTimeEntry(entryId, endedAtIso);
  if (!closed) throw new Error(`Entry ${entryId} not found or already closed.`);
  void pushTimeEntryClose(closed.id, endedAtIso);
  notifyLocalMutation();
  return toTimeEntry(closed);
}

/** Persists a cloud entry into local SQLite as already-synced. Called when
 * the timer adopts an entry created elsewhere (web / another device) so
 * Stop/Switch work through the normal local path. */
export async function adoptCloudTimeEntry(entry: TimeEntry): Promise<TimeEntry> {
  const row: TimeEntryIpc = {
    id: entry.id,
    user_id: entry.userId,
    task_id: entry.taskId,
    project_id: entry.projectId,
    type: entry.type,
    started_at: entry.startedAt,
    ended_at: entry.endedAt,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    sync_status: "synced",
    sync_attempts: 0,
    last_sync_error: null,
  };
  await api.upsertTimeEntry(row);
  return entry;
}

/** Cloud-first close — the fallback when `closeTimeEntry` finds no local
 * open row (the entry was adopted remotely but never written locally).
 * Updates Supabase first, then mirrors the closed row into SQLite. */
export async function closeTimeEntryRemote(
  userId: string,
  entryId: string,
  endedAtIso: string,
): Promise<TimeEntry> {
  const sb = getSupabaseClient();
  if (!sb) {
    throw new Error(
      "You're offline and this timer isn't stored locally yet — reconnect to stop it.",
    );
  }
  const { data, error: fetchError } = await sb
    .from(TABLES.timeEntries)
    .select("*")
    .eq("id", entryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!data) throw new Error(`Entry ${entryId} no longer exists.`);

  const now = new Date().toISOString();
  await sbExec(
    sb
      .from(TABLES.timeEntries)
      .update({ ended_at: endedAtIso, updated_at: now })
      .eq("id", entryId)
      .eq("user_id", userId),
  );
  const closed = toTimeEntry({ ...data, ended_at: endedAtIso });
  await api.upsertTimeEntry({
    id: closed.id,
    user_id: closed.userId,
    task_id: closed.taskId,
    project_id: closed.projectId,
    type: closed.type,
    started_at: closed.startedAt,
    ended_at: closed.endedAt,
    created_at: closed.createdAt,
    updated_at: now,
    sync_status: "synced",
    sync_attempts: 0,
    last_sync_error: null,
  });
  notifyLocalMutation();
  return closed;
}

export async function createManualTimeEntry(
  userId: string,
  input: {
    taskId: string | null;
    projectId: string | null;
    type: EntryType;
    startedAt: string;
    endedAt: string | null;
  },
): Promise<TimeEntry> {
  const now = new Date().toISOString();
  const ipcRow: TimeEntryIpc = {
    id: crypto.randomUUID(),
    user_id: userId,
    task_id: input.taskId,
    project_id: input.projectId,
    type: input.type,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    created_at: now,
    updated_at: now,
    sync_status: "pending_create",
    sync_attempts: 0,
    last_sync_error: null,
  };
  await api.insertTimeEntry(ipcRow);
  void pushRowToSupabase(TABLES.timeEntries, ipcRow);
  notifyLocalMutation();
  return toTimeEntry(ipcRow);
}

export async function updateManualTimeEntry(
  entryId: string,
  patch: Partial<
    Pick<TimeEntry, "taskId" | "projectId" | "type" | "startedAt" | "endedAt">
  >,
): Promise<TimeEntry> {
  const userId = await resolveUserId();
  if (!userId) throw new Error("You're signed out.");
  const rows = await api.listTimeEntries(userId, 500);
  const existing = rows.find((r) => r.id === entryId);
  if (!existing) throw new Error(`Entry ${entryId} not found.`);
  const now = new Date().toISOString();
  const updated: TimeEntryIpc = {
    ...existing,
    task_id: patch.taskId !== undefined ? patch.taskId : existing.task_id,
    project_id: patch.projectId !== undefined ? patch.projectId : existing.project_id,
    type: patch.type !== undefined ? patch.type : existing.type,
    started_at: patch.startedAt !== undefined ? patch.startedAt : existing.started_at,
    ended_at: patch.endedAt !== undefined ? patch.endedAt : existing.ended_at,
    updated_at: now,
    sync_status: "pending_update",
  };
  await api.upsertTimeEntry(updated);
  void updateTimeEntryInSupabase(updated);
  notifyLocalMutation();
  return toTimeEntry(updated);
}

// ---- Legacy upload (pre-local-first drain) ----

export type PendingUpload = {
  local_id: string;
  task_id: string | null;
  project_id: string | null;
  type: "WORK" | "BREAK";
  started_at: string;
  ended_at: string;
  remote_id: string | null;
};

export async function uploadTimeEntries(
  userId: string,
  entries: PendingUpload[],
): Promise<string[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const uploaded: string[] = [];
  for (const entry of entries) {
    if (entry.remote_id) {
      await sbExec(
        sb
          .from(TABLES.timeEntries)
          .update({ ended_at: entry.ended_at })
          .eq("id", entry.remote_id),
      );
    } else {
      await sbExec(
        sb.from(TABLES.timeEntries).insert({
          user_id: userId,
          task_id: entry.task_id,
          project_id: entry.project_id,
          type: entry.type,
          started_at: entry.started_at,
          ended_at: entry.ended_at,
        }),
      );
    }
    // Only leave the queue after the upload verifiably succeeded — the
    // file is the only copy until then.
    uploaded.push(entry.local_id);
  }
  return uploaded;
}

// ---- Internal helpers ----

/** Gets the current user ID from Supabase session (used for ad-hoc lookups). */
async function resolveUserId(): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/** supabase-js resolves API errors (RLS, FK, expired token) as `{ error }`
 * instead of rejecting — every call must be checked or failures pass
 * silently. Throws so callers can distinguish success from failure. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sbExec(call: PromiseLike<{ error: any }>): Promise<void> {
  const { error } = await call;
  if (error) throw new Error(error.message || "Supabase request failed.");
}

/** Strips local-only sync metadata before sending a row to Supabase. */
function remoteRow(row: Record<string, unknown>): Record<string, unknown> {
  const {
    sync_status: _syncStatus,
    sync_attempts: _syncAttempts,
    last_sync_error: _lastSyncError,
    ...rest
  } = row;
  return rest;
}

/** Fire-and-forget upsert for instant propagation. On failure the row stays
 * pending — a mutation-triggered sync retries it and surfaces the error. */
async function pushRowToSupabase(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any>,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sbExec(sb.from(table).upsert(remoteRow(row)));
  } catch {
    notifyLocalMutation();
  }
}

async function pushTimeEntryCreate(userId: string, row: TimeEntryIpc): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sbExec(
      sb.from(TABLES.timeEntries).insert({
        id: row.id,
        user_id: userId,
        task_id: row.task_id,
        project_id: row.project_id,
        type: row.type,
        started_at: row.started_at,
        ended_at: row.ended_at,
      }),
    );
    await api.ackSyncPush(userId, {
      project_ids: [],
      task_ids: [],
      entry_ids: [row.id],
    });
  } catch {
    // Stays pending_create — the retried sync surfaces the failure.
    notifyLocalMutation();
  }
}

async function pushTimeEntryClose(entryId: string, endedAt: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sbExec(
      sb.from(TABLES.timeEntries).update({ ended_at: endedAt }).eq("id", entryId),
    );
    const userId = await resolveUserId();
    if (userId) {
      await api.ackSyncPush(userId, {
        project_ids: [],
        task_ids: [],
        entry_ids: [entryId],
      });
    }
  } catch {
    // Stays pending_update — the retried sync surfaces the failure.
    notifyLocalMutation();
  }
}

async function updateTimeEntryInSupabase(row: TimeEntryIpc): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sbExec(
      sb
        .from(TABLES.timeEntries)
        .update({
          task_id: row.task_id,
          project_id: row.project_id,
          type: row.type,
          started_at: row.started_at,
          ended_at: row.ended_at,
        })
        .eq("id", row.id),
    );
    await api.ackSyncPush(row.user_id, {
      project_ids: [],
      task_ids: [],
      entry_ids: [row.id],
    });
  } catch {
    notifyLocalMutation();
  }
}
