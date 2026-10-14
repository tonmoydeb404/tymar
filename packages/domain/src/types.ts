// Shared domain types used across desktop and web apps.

export type DbRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthStatus = "signed_out" | "active" | "expired" | "unknown";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthState = {
  /** False when endpoint/project ID are not configured at build time. */
  configured: boolean;
  status: AuthStatus;
  user: AuthUser | null;
};

export type ProjectStatus = "ACTIVE" | "ARCHIVED";

export type Profile = DbRecord & {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  timezone: string;
};

export type Project = DbRecord & {
  userId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  deletedAt: string | null;
};

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type Task = DbRecord & {
  userId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  deletedAt: string | null;
};

export type EntryType = "WORK" | "BREAK";

export type TimeEntry = DbRecord & {
  userId: string;
  taskId: string | null;
  projectId: string | null;
  type: EntryType;
  startedAt: string;
  endedAt: string | null;
};

/** Returned by the `time_entries_with_details` view — task/project names joined server-side. */
export type TimeEntryWithDetails = TimeEntry & {
  taskTitle: string | null;
  projectName: string | null;
};

export type TimerState = "IDLE" | "WORKING" | "BREAK";

export const AUTH_ERROR_NOT_CONFIGURED = "not_configured";
export const AUTH_ERROR_UNAUTHORIZED = "unauthorized";
export const AUTH_ERROR_NETWORK = "network";
