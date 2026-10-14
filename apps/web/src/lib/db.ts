import {
  aggregateDayTotals,
  entryDurationMs,
  groupEntriesByStartDay,
  TABLES,
  VIEWS,
  type DayTotal,
  type EntryType,
  type Profile,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TimeEntry,
  type TimeEntryWithDetails,
} from "@packages/domain/index";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "./supabase";

function getDb(): SupabaseClient {
  return createSupabaseClient();
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// ---- Row → domain mappers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function toProject(row: Row): Project {
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

function toTask(row: Row): Task {
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

function toProfile(row: Row): Profile {
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

function toTimeEntry(row: Row): TimeEntry {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    userId: String(row.user_id ?? ""),
    taskId: str(row.task_id),
    projectId: str(row.project_id),
    type: (row.type as EntryType) ?? "WORK",
    startedAt: String(row.started_at ?? ""),
    endedAt: str(row.ended_at),
  };
}

function toTimeEntryWithDetails(row: Row): TimeEntryWithDetails {
  return {
    ...toTimeEntry(row),
    taskTitle: str(row.task_title),
    projectName: str(row.project_name),
  };
}

function throwOnError<T>(
  result: { data: T | null; error: { message: string } | null },
): T {
  if (result.error) throw new Error(result.error.message);
  return result.data!;
}

// ---- Profiles ----

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = getDb();
  const { data } = await db
    .from(TABLES.profiles)
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data ? toProfile(data) : null;
}

export async function ensureProfile(input: {
  userId: string;
  name: string;
  email: string;
}): Promise<Profile> {
  const existing = await getProfile(input.userId);
  if (existing) return existing;
  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";
  const db = getDb();
  const result = await db
    .from(TABLES.profiles)
    .insert({
      user_id: input.userId,
      name: input.name,
      email: input.email,
      avatar_url: null,
      timezone,
    })
    .select("*")
    .single();
  return toProfile(throwOnError(result));
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "name" | "timezone" | "avatarUrl">>,
): Promise<Profile> {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("A name is required.");
    data.name = name;
  }
  if (patch.timezone !== undefined) {
    if (!patch.timezone) throw new Error("A timezone is required.");
    try {
      Intl.DateTimeFormat(undefined, { timeZone: patch.timezone });
    } catch {
      throw new Error("Unknown timezone.");
    }
    data.timezone = patch.timezone;
  }
  if (patch.avatarUrl !== undefined) data.avatar_url = patch.avatarUrl;

  const db = getDb();
  const result = await db
    .from(TABLES.profiles)
    .update(data)
    .eq("user_id", userId)
    .select("*")
    .single();
  return toProfile(throwOnError(result));
}

export async function ensureUserSetup(input: {
  userId: string;
  name: string;
  email: string;
}): Promise<{ profile: Profile }> {
  const profile = await ensureProfile(input);
  return { profile };
}

// ---- Projects ----

export type ProjectInput = {
  name: string;
  description?: string | null;
};

export async function listProjects(
  userId: string,
  includeArchived = true,
  includeDeleted = false,
): Promise<Project[]> {
  const db = getDb();
  let q = db
    .from(TABLES.projects)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (!includeDeleted) q = q.is("deleted_at", null);
  if (!includeArchived) q = q.eq("status", "ACTIVE");
  const result = await q;
  return throwOnError(result).map(toProject);
}

export type ProjectQuery = {
  status?: ProjectStatus | "ALL";
  search?: string;
  limit?: number;
  offset?: number;
};

export async function queryProjects(
  userId: string,
  query: ProjectQuery = {},
): Promise<{ projects: Project[]; total: number }> {
  const { status = "ALL", search, limit = 8, offset = 0 } = query;
  const db = getDb();
  let q = db
    .from(TABLES.projects)
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status !== "ALL") q = q.eq("status", status);
  if (search?.trim()) q = q.ilike("name", `%${search.trim()}%`);
  const result = await q;
  const rows = throwOnError(result);
  return { projects: (rows as Row[]).map(toProject), total: result.count ?? 0 };
}

export async function createProject(
  userId: string,
  input: ProjectInput,
): Promise<Project> {
  const db = getDb();
  const result = await db
    .from(TABLES.projects)
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: "ACTIVE",
      deleted_at: null,
    })
    .select("*")
    .single();
  return toProject(throwOnError(result));
}

export async function updateProject(
  projectId: string,
  patch: Partial<ProjectInput & { status: ProjectStatus }>,
): Promise<Project> {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.description !== undefined)
    data.description = patch.description?.trim() || null;
  if (patch.status !== undefined) data.status = patch.status;
  const db = getDb();
  const result = await db
    .from(TABLES.projects)
    .update(data)
    .eq("id", projectId)
    .select("*")
    .single();
  return toProject(throwOnError(result));
}

export async function deleteProject(
  userId: string,
  projectId: string,
): Promise<void> {
  const db = getDb();
  const { count } = await db
    .from(TABLES.tasks)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    throw new Error(
      "This project still has active tasks. Delete or move them first.",
    );
  }
  await db
    .from(TABLES.projects)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", projectId);
}

export async function getProject(projectId: string): Promise<Project | null> {
  const db = getDb();
  const { data } = await db
    .from(TABLES.projects)
    .select("*")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? toProject(data) : null;
}

export async function countActiveTasks(
  userId: string,
  projectId: string,
): Promise<number> {
  const db = getDb();
  const { count } = await db
    .from(TABLES.tasks)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .is("deleted_at", null);
  return count ?? 0;
}

// ---- Tasks ----

export type TaskInput = {
  projectId: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
};

export async function listTasks(
  userId: string,
  opts: {
    projectId?: string;
    status?: TaskStatus;
    includeDeleted?: boolean;
  } = {},
): Promise<Task[]> {
  const db = getDb();
  let q = db
    .from(TABLES.tasks)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (!opts.includeDeleted) q = q.is("deleted_at", null);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.status) q = q.eq("status", opts.status);
  const result = await q;
  return throwOnError(result).map(toTask);
}

export type TaskQuery = {
  status?: TaskStatus | "ALL";
  projectId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function queryTasks(
  userId: string,
  query: TaskQuery = {},
): Promise<{ tasks: Task[]; total: number }> {
  const { status = "ALL", projectId, search, limit = 8, offset = 0 } = query;
  const db = getDb();
  let q = db
    .from(TABLES.tasks)
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status !== "ALL") q = q.eq("status", status);
  if (projectId) q = q.eq("project_id", projectId);
  if (search?.trim()) q = q.ilike("title", `%${search.trim()}%`);
  const result = await q;
  const rows = throwOnError(result);
  return { tasks: (rows as Row[]).map(toTask), total: result.count ?? 0 };
}

export async function createTask(
  userId: string,
  input: TaskInput,
): Promise<Task> {
  const db = getDb();
  const result = await db
    .from(TABLES.tasks)
    .insert({
      user_id: userId,
      project_id: input.projectId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: "TODO",
      priority: input.priority ?? "MEDIUM",
      due_date: input.dueDate ?? null,
      completed_at: null,
      deleted_at: null,
    })
    .select("*")
    .single();
  return toTask(throwOnError(result));
}

export async function updateTask(
  taskId: string,
  patch: Partial<
    Pick<Task, "title" | "description" | "priority" | "dueDate" | "projectId">
  > & { status?: TaskStatus },
): Promise<Task> {
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.description !== undefined)
    data.description = patch.description?.trim() || null;
  if (patch.priority !== undefined) data.priority = patch.priority;
  if (patch.dueDate !== undefined) data.due_date = patch.dueDate;
  if (patch.projectId !== undefined) data.project_id = patch.projectId;
  if (patch.status !== undefined) {
    data.status = patch.status;
    data.completed_at =
      patch.status === "DONE" ? new Date().toISOString() : null;
  }
  const db = getDb();
  const result = await db
    .from(TABLES.tasks)
    .update(data)
    .eq("id", taskId)
    .select("*")
    .single();
  return toTask(throwOnError(result));
}

export async function deleteTask(taskId: string): Promise<void> {
  const db = getDb();
  await db
    .from(TABLES.tasks)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId);
}

export async function getTask(taskId: string): Promise<Task | null> {
  const db = getDb();
  const { data } = await db
    .from(TABLES.tasks)
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  return data ? toTask(data) : null;
}

// ---- Time entries ----

export type TimeEntryInput = {
  taskId?: string | null;
  projectId?: string | null;
  type?: EntryType;
  startedAt: string;
  endedAt: string | null;
};

function validateEntryRange(startedAt: string, endedAt: string | null): void {
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) throw new Error("Start time is invalid.");
  if (endedAt !== null) {
    const end = new Date(endedAt).getTime();
    if (!Number.isFinite(end)) throw new Error("End time is invalid.");
    if (end <= start) throw new Error("End must be after start.");
  }
}

export async function getActiveTimeEntries(userId: string): Promise<TimeEntry[]> {
  const db = getDb();
  const result = await db
    .from(TABLES.timeEntries)
    .select("*")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false });
  return (result.data ?? []).map(toTimeEntry);
}

export async function listTimeEntries(
  userId: string,
  opts: {
    taskId?: string;
    type?: EntryType;
    from?: string;
    to?: string;
    limit?: number;
  } = {},
): Promise<TimeEntry[]> {
  const db = getDb();
  let q = db
    .from(TABLES.timeEntries)
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(Math.min(Math.max(opts.limit ?? 200, 1), 500));
  if (opts.taskId) q = q.eq("task_id", opts.taskId);
  if (opts.type) q = q.eq("type", opts.type);
  if (opts.from) q = q.gte("started_at", opts.from);
  if (opts.to) q = q.lt("started_at", opts.to);
  const result = await q;
  return throwOnError(result).map(toTimeEntry);
}

export type TimeEntryQuery = {
  type?: EntryType | "ALL";
  taskId?: string;
  projectId?: string;
  projectIds?: string[];
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

/** Uses the joined view so task/project names come back with the row. */
export async function queryTimeEntriesWithDetails(
  userId: string,
  query: TimeEntryQuery = {},
): Promise<{ entries: TimeEntryWithDetails[]; total: number }> {
  const {
    type = "ALL",
    taskId,
    projectId,
    projectIds,
    from,
    to,
    limit = 8,
    offset = 0,
  } = query;
  const db = getDb();
  let q = db
    .from(VIEWS.timeEntriesWithDetails)
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (type !== "ALL") q = q.eq("type", type);
  if (taskId) q = q.eq("task_id", taskId);
  if (projectId) q = q.eq("project_id", projectId);
  else if (projectIds?.length) q = q.in("project_id", projectIds);
  if (from) q = q.gte("started_at", from);
  if (to) q = q.lt("started_at", to);
  const result = await q;
  const rows = throwOnError(result);
  return {
    entries: (rows as Row[]).map(toTimeEntryWithDetails),
    total: result.count ?? 0,
  };
}

export type TimeRangeGroup = {
  day: string;
  entries: TimeEntryWithDetails[];
  workMs: number;
  breakMs: number;
  entryCount: number;
};

/** Single range query with server-side joins. Replaces the old pagination loop + client join. */
export async function queryTimeEntriesByRange(
  userId: string,
  timeZone: string,
  query: Omit<TimeEntryQuery, "limit" | "offset"> = {},
  opts: { pageSize?: number; maxEntries?: number } = {},
): Promise<{
  groups: TimeRangeGroup[];
  totalEntries: number;
  truncated: boolean;
}> {
  const { pageSize = 100, maxEntries = 2000 } = opts;

  const all: TimeEntryWithDetails[] = [];
  let offset = 0;
  let total = 0;
  for (;;) {
    const { entries, total: t } = await queryTimeEntriesWithDetails(userId, {
      ...query,
      limit: pageSize,
      offset,
    });
    total = t;
    all.push(...entries);
    offset += pageSize;
    if (
      entries.length < pageSize ||
      offset >= total ||
      all.length >= maxEntries
    )
      break;
  }
  const truncated = all.length >= maxEntries && offset < total;
  const rows = truncated ? all.slice(0, maxEntries) : all;

  const groups = groupEntriesByStartDay(rows, timeZone).map(
    ({ day, entries }) => {
      let workMs = 0;
      let breakMs = 0;
      for (const e of entries) {
        const ms = entryDurationMs(e.startedAt, e.endedAt);
        if (e.type === "BREAK") breakMs += ms;
        else workMs += ms;
      }
      return { day, entries, workMs, breakMs, entryCount: entries.length };
    },
  );

  return { groups, totalEntries: total, truncated };
}

export type TimeStats = {
  workedMs: number;
  breakMs: number;
  entryCount: number;
};

export async function getTimeStats(
  userId: string,
  range: { from: string; to: string },
): Promise<TimeStats> {
  const db = getDb();
  const pageSize = 200;
  let offset = 0;
  let workedMs = 0;
  let breakMs = 0;
  let entryCount = 0;
  for (;;) {
    const result = await db
      .from(TABLES.timeEntries)
      .select("type,started_at,ended_at", { count: "exact" })
      .eq("user_id", userId)
      .gte("started_at", range.from)
      .lt("started_at", range.to)
      .range(offset, offset + pageSize - 1);
    const rows = throwOnError(result);
    for (const row of rows as Row[]) {
      const ms = entryDurationMs(
        String(row.started_at),
        str(row.ended_at),
      );
      if (row.type === "BREAK") breakMs += ms;
      else workedMs += ms;
      entryCount += 1;
    }
    offset += pageSize;
    if (rows.length < pageSize || offset >= (result.count ?? 0)) break;
  }
  return { workedMs, breakMs, entryCount };
}

export async function getDayTotals(
  userId: string,
  timeZone: string,
  range: { from: string; to: string },
): Promise<DayTotal[]> {
  const db = getDb();
  const pageSize = 200;
  let offset = 0;
  const entries: TimeEntry[] = [];
  for (;;) {
    const result = await db
      .from(TABLES.timeEntries)
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", range.from)
      .lt("started_at", range.to)
      .range(offset, offset + pageSize - 1);
    const rows = throwOnError(result);
    entries.push(...(rows as Row[]).map(toTimeEntry));
    offset += pageSize;
    if (rows.length < pageSize) break;
  }
  return aggregateDayTotals(entries, timeZone);
}

export async function createTimeEntry(
  userId: string,
  input: TimeEntryInput,
): Promise<TimeEntry> {
  validateEntryRange(input.startedAt, input.endedAt);
  const db = getDb();
  const result = await db
    .from(TABLES.timeEntries)
    .insert({
      user_id: userId,
      task_id: input.taskId ?? null,
      project_id: input.projectId ?? null,
      type: input.type ?? "WORK",
      started_at: input.startedAt,
      ended_at: input.endedAt,
    })
    .select("*")
    .single();
  return toTimeEntry(throwOnError(result));
}

export async function updateTimeEntry(
  entryId: string,
  patch: Partial<Pick<TimeEntry, "taskId" | "projectId" | "type" | "startedAt" | "endedAt">>,
): Promise<TimeEntry> {
  const data: Record<string, unknown> = {};
  if (patch.taskId !== undefined) data.task_id = patch.taskId;
  if (patch.projectId !== undefined) data.project_id = patch.projectId;
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.startedAt !== undefined) data.started_at = patch.startedAt;
  if (patch.endedAt !== undefined) data.ended_at = patch.endedAt;

  if (data.started_at !== undefined || data.ended_at !== undefined) {
    let startedAt = typeof data.started_at === "string" ? data.started_at : null;
    let endedAt = data.ended_at === undefined ? undefined : (data.ended_at as string | null);
    if (startedAt === null || endedAt === undefined) {
      const db = getDb();
      const { data: current } = await db
        .from(TABLES.timeEntries)
        .select("started_at,ended_at")
        .eq("id", entryId)
        .single();
      if (startedAt === null) startedAt = String(current?.started_at ?? "");
      if (endedAt === undefined) endedAt = str(current?.ended_at);
    }
    validateEntryRange(startedAt ?? "", endedAt ?? null);
  }

  const db = getDb();
  const result = await db
    .from(TABLES.timeEntries)
    .update(data)
    .eq("id", entryId)
    .select("*")
    .single();
  return toTimeEntry(throwOnError(result));
}

export async function deleteTimeEntry(entryId: string): Promise<void> {
  const db = getDb();
  await db.from(TABLES.timeEntries).delete().eq("id", entryId);
}

// ---- Public status ----

export type PublicStatusSettings = {
  userId: string;
  slug: string;
  isPublic: boolean;
};

export async function getPublicStatusSettings(
  userId: string,
): Promise<PublicStatusSettings | null> {
  const db = getDb();
  const { data } = await db
    .from(TABLES.publicStatusSettings)
    .select("user_id,slug,is_public")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data
    ? {
        userId: String(data.user_id ?? ""),
        slug: String(data.slug ?? ""),
        isPublic: Boolean(data.is_public),
      }
    : null;
}

export async function regeneratePublicSlug(): Promise<string> {
  const db = getDb();
  const { data, error } = await db.rpc("regenerate_public_slug");
  throwOnError({ data: data as string | null, error });
  return String(data);
}

export async function setPublicStatusEnabled(enabled: boolean): Promise<void> {
  const db = getDb();
  const { error } = await db.rpc("set_public_status_enabled", {
    p_enabled: enabled,
  });
  if (error) throw new Error(error.message);
}
