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
  type Workspace,
  type WorkspaceStatus,
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
    workspaceId: str(row.workspace_id),
    name: String(row.name ?? ""),
    description: str(row.description),
    status: (row.status as ProjectStatus) ?? "ACTIVE",
    deletedAt: str(row.deleted_at),
  };
}

export function toWorkspace(row: Row): Workspace {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    userId: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    description: str(row.description),
    status: (row.status as WorkspaceStatus) ?? "ACTIVE",
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

// ---- Workspaces (read from local SQLite; managed on the web dashboard) ----

export async function listWorkspaces(userId: string): Promise<Workspace[]> {
  const rows = await api.listWorkspaces(userId);
  return rows.map(toWorkspace);
}

// ---- Projects (read from local SQLite) ----

export async function listProjects(userId: string): Promise<Project[]> {
  const rows = await api.listProjects(userId);
  return rows.map(toProject);
}

export async function queryProjects(
  userId: string,
  opts: { search?: string; workspaceId?: string; limit?: number } = {},
): Promise<Project[]> {
  const rows = await api.listProjects(userId);
  let results = rows
    .filter((r) => r.status === "ACTIVE" && !r.deleted_at)
    .map(toProject);
  if (opts.workspaceId) {
    results = results.filter((p) => p.workspaceId === opts.workspaceId);
  }
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
  notifyLocalMutation();
  return toTimeEntry(ipcRow);
}

/** Closes an open entry in SQLite; the sync engine pushes it.
 * Returns null when the row was already closed (the Rust sleep guard or
 * boot reconciliation beat us to it) — the caller must then keep that
 * committed end time and never push a possibly-older request timestamp
 * over it. Throws when the entry doesn't exist locally. */
export async function closeTimeEntry(
  entryId: string,
  endedAtIso: string,
): Promise<TimeEntry | null> {
  const closed = await api.closeTimeEntry(entryId, endedAtIso);
  if (!closed) throw new Error(`Entry ${entryId} not found or already closed.`);
  const row = toTimeEntry(closed);
  if (row.endedAt !== endedAtIso) {
    // Already closed elsewhere with a different (authoritative) end time.
    // The row is dirty locally — the sync engine pushes it as-is.
    notifyLocalMutation();
    return null;
  }
  notifyLocalMutation();
  return row;
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
  notifyLocalMutation();
  return toTimeEntry(updated);
}

// ---- Internal helpers ----

/** Gets the current user ID from Supabase session (used for ad-hoc lookups). */
async function resolveUserId(): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}
