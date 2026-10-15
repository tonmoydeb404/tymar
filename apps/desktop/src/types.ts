// Types shared across the frontend. Backend (raw) types match the Rust
// serde output (snake_case); Appwrite shapes come from @packages/domain.

export type UpdateInfo = {
  version: string;
  body: string | null;
  date: string | null;
};

// ---- Auth (Appwrite SDK session in the webview) ----

export type AuthStatus = "signed_out" | "active" | "expired" | "unknown";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  /** OAuth provider avatar (e.g. Google `user_metadata.avatar_url`). */
  avatarUrl?: string | null;
};

export type AuthState = {
  /** False when the Appwrite endpoint/project ID are not configured. */
  configured: boolean;
  status: AuthStatus;
  user: AuthUser | null;
};

// ---- Timer (derived from the cloud active entry; see timer-context) ----

export type TimerStatus = "IDLE" | "WORKING" | "BREAK";

export type SegmentType = "WORK" | "BREAK";

/** Legacy closed-segment row from the old local `timer-state.json`
 * (pre-realtime versions). Only used to drain the old upload queue. */
export type LegacyPendingEntry = {
  local_id: string;
  task_id: string | null;
  project_id: string | null;
  type: SegmentType;
  started_at: string;
  ended_at: string;
  attempts: number;
  /** Set if a live doc already exists for this entry — update, not create. */
  remote_id: string | null;
};

/** What the UI renders for the running timer. Derived from the single open
 * Appwrite entry (endedAt = null); titles resolved from the shared lists. */
export type TimerView = {
  status: TimerStatus;
  /** Type of the open entry — WORKING/BREAK display state. */
  kind: SegmentType;
  task_id: string | null;
  task_title: string | null;
  project_id: string | null;
  project_title: string | null;
  started_at_ms: number | null;
  /** Appwrite doc id of the open entry. */
  entry_id: string | null;
};

// ---- Tray (frontend pushes state; Rust renders + emits actions back) ----

export type TrayAction = "break" | "resume" | "stop";

export type TrayState = {
  running: boolean;
  on_break: boolean;
  /** Resolved task/project title, or null for "Untitled session". */
  title: string | null;
  elapsed_ms: number;
  /** Epoch ms anchor of the open entry — Rust's native ticker derives the
   * live menubar readout from this (null while idle). */
  started_at_ms: number | null;
};
