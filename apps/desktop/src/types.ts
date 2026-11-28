// Types shared across the frontend. Backend (raw) types match the Rust
// serde output (snake_case); domain shapes come from @packages/domain.

export type UpdateInfo = {
  version: string;
  body: string | null;
  date: string | null;
};

// ---- Auth (Supabase session in the webview) ----

export type AuthStatus = "signed_out" | "active" | "expired" | "unknown";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  /** OAuth provider avatar (e.g. Google `user_metadata.avatar_url`). */
  avatarUrl?: string | null;
};

export type AuthState = {
  /** False when the Supabase URL/key are not configured. */
  configured: boolean;
  status: AuthStatus;
  user: AuthUser | null;
};

// ---- Timer (derived from the local open entry; see timer-context) ----

export type TimerStatus = "IDLE" | "WORKING" | "BREAK";

export type SegmentType = "WORK" | "BREAK";

/** What the UI renders for the running timer. Derived from the open local
 * entry (endedAt = null); titles resolved from the shared lists. */
export type TimerView = {
  status: TimerStatus;
  /** Type of the open entry — WORKING/BREAK display state. */
  kind: SegmentType;
  task_id: string | null;
  task_title: string | null;
  project_id: string | null;
  project_title: string | null;
  started_at_ms: number | null;
  /** Id of the open entry. */
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
