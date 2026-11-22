import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  LegacyPendingEntry,
  TrayAction,
  TrayState,
  UpdateInfo,
} from "../types";

// ---- IPC row types (mirror Rust domain.rs serde output) ----

export type WorkspaceIpc = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
  /** Local-only sync bookkeeping (never sent to Supabase). */
  sync_attempts: number;
  last_sync_error: string | null;
};

export type ProjectIpc = {
  id: string;
  user_id: string;
  /** Owning workspace — null means "no workspace" (ungrouped). */
  workspace_id: string | null;
  name: string;
  description: string | null;
  status: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
  /** Local-only sync bookkeeping (never sent to Supabase). */
  sync_attempts: number;
  last_sync_error: string | null;
};

export type TaskIpc = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
  /** Local-only sync bookkeeping (never sent to Supabase). */
  sync_attempts: number;
  last_sync_error: string | null;
};

export type TimeEntryIpc = {
  id: string;
  user_id: string;
  task_id: string | null;
  project_id: string | null;
  type: string; // Rust field entry_type, serde-renamed to "type"
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
  /** Local-only sync bookkeeping (never sent to Supabase). */
  sync_attempts: number;
  last_sync_error: string | null;
};

export type PendingSyncPayload = {
  workspaces: WorkspaceIpc[];
  projects: ProjectIpc[];
  tasks: TaskIpc[];
  time_entries: TimeEntryIpc[];
};

export type AckIds = {
  workspace_ids: string[];
  project_ids: string[];
  task_ids: string[];
  entry_ids: string[];
};

export type SyncPullPayload = {
  workspaces: WorkspaceIpc[];
  projects: ProjectIpc[];
  tasks: TaskIpc[];
  time_entries: TimeEntryIpc[];
};

// ---- Sleep monitor events (emitted from Rust sleep_monitor.rs) ----

/** `tymar://slept` — the system is suspending and Rust just closed the
 * running entries in SQLite at `closed_at_ms` (sleep time is not billed). */
export type SleptEvent = {
  closed_at_ms: number;
  entries: TimeEntryIpc[];
};

/** `tymar://woke` — the system resumed from sleep. */
export type WokeEvent = {
  woke_at_ms: number;
};

/** `tymar://power-gap` + `take_power_gap` — at boot, open entries from the
 * previous run were closed at their last heartbeat because the app/machine
 * had been off; the gap itself is never billed. */
export type PowerGapEvent = {
  closed_at_ms: number;
  gap_ms: number;
  entries: TimeEntryIpc[];
};

/** `take_sleep_info` — what the frontend sleep watchdog needs to validate
 * a suspicious JS-tick gap: a suspend timestamp inside the gap proves the
 * system really slept (safe to close the timer at that moment); null means
 * the stall was only a throttled/App-Napped webview and the timer must
 * keep counting. `last_suspend_ms` is taken (cleared) on read. */
export type SleepInfo = {
  native_sleep_supported: boolean;
  last_suspend_ms: number | null;
};

// All IPC wrappers live here — one entry per Rust command in
// src-tauri/src/commands.rs. Supabase I/O (including realtime) happens in
// the webview via the SDK (see lib/db.ts, lib/realtime.ts);
// Rust only renders the tray from pushed state.

export const api = {
  /** Legacy (pre-realtime) closed segments waiting for upload. */
  getLegacyPending: () => invoke<LegacyPendingEntry[]>("get_legacy_pending"),
  clearLegacyPending: (localIds: string[]) =>
    invoke<void>("clear_legacy_pending", { localIds }),

  /** Frontend is the timer source of truth; Rust only mirrors it here. */
  setTrayState: (state: TrayState) =>
    invoke<void>("set_tray_state", { state }),

  getSettings: () => invoke<Record<string, string>>("get_settings"),
  setSetting: (key: string, value: string) =>
    invoke<void>("set_setting", { key, value }),

  enableAutostart: () => invoke<void>("enable_autostart"),
  disableAutostart: () => invoke<void>("disable_autostart"),
  isAutostartEnabled: () => invoke<boolean>("is_autostart_enabled"),

  installUpdate: () => invoke<void>("install_update"),
  /** Manual updater check (settings) — null when up to date. */
  checkForUpdate: () => invoke<UpdateInfo | null>("check_for_update"),

  // ---- Domain: local SQLite CRUD ----
  listWorkspaces: (userId: string) =>
    invoke<WorkspaceIpc[]>("list_workspaces", { userId }),
  upsertWorkspace: (row: WorkspaceIpc) =>
    invoke<void>("upsert_workspace", { row }),
  listProjects: (userId: string) =>
    invoke<ProjectIpc[]>("list_projects", { userId }),
  upsertProject: (row: ProjectIpc) =>
    invoke<void>("upsert_project", { row }),
  listTasks: (userId: string) =>
    invoke<TaskIpc[]>("list_tasks", { userId }),
  upsertTask: (row: TaskIpc) =>
    invoke<void>("upsert_task", { row }),
  listTimeEntries: (userId: string, limit?: number) =>
    invoke<TimeEntryIpc[]>("list_time_entries", { userId, limit }),
  getActiveTimeEntries: (userId: string) =>
    invoke<TimeEntryIpc[]>("get_active_time_entries", { userId }),
  insertTimeEntry: (row: TimeEntryIpc) =>
    invoke<void>("insert_time_entry", { row }),
  upsertTimeEntry: (row: TimeEntryIpc) =>
    invoke<void>("upsert_time_entry", { row }),
  closeTimeEntry: (id: string, endedAt: string) =>
    invoke<TimeEntryIpc | null>("close_time_entry", { id, endedAt }),

  // ---- Sync ----
  getPendingSync: (userId: string) =>
    invoke<PendingSyncPayload>("get_pending_sync", { userId }),
  touchActiveTimeEntries: (userId: string) =>
    invoke<void>("touch_active_time_entries", { userId }),
  ackSyncPush: (userId: string, ids: AckIds) =>
    invoke<void>("ack_sync_push", { userId, ids }),
  applySyncPull: (payload: SyncPullPayload) =>
    invoke<void>("apply_sync_pull", { payload }),
  /** Records a failed push for one row (kind: "project" | "task" | "entry"). */
  markSyncFailed: (kind: string, id: string, error: string) =>
    invoke<void>("mark_sync_failed", { kind, id, error }),

  // ---- Sleep monitor ----
  /** Arms the sleep guard while a timer runs on this device (null
   * disarms). Rust stops the timer itself on system sleep and keeps a
   * heartbeat so power-offs are detected at next boot. */
  setSleepGuard: (userId: string | null) =>
    invoke<void>("set_sleep_guard", { userId }),
  /** Fetches and clears the boot-time power-gap payload (entries closed
   * after the app/machine was off). Polled at startup because the boot
   * event fires before webview listeners exist. */
  takePowerGap: () => invoke<PowerGapEvent | null>("take_power_gap"),
  /** Consumes the last native suspend timestamp + whether native sleep
   * events are live — the watchdog's proof that a tick gap was real sleep. */
  takeSleepInfo: () => invoke<SleepInfo>("take_sleep_info"),
};

// Backend → frontend events (emitted from Rust with app.emit(...)).

export function onUpdateAvailable(
  callback: (payload: UpdateInfo) => void,
): Promise<UnlistenFn> {
  return listen<UpdateInfo>("update://available", (event) =>
    callback(event.payload),
  );
}

/** Tray menu clicked a timer control; the frontend performs the API call. */
export function onTrayAction(
  callback: (action: TrayAction) => void,
): Promise<UnlistenFn> {
  return listen<TrayAction>("tymar://tray-action", (event) =>
    callback(event.payload),
  );
}

export function onOpenSwitcher(callback: () => void): Promise<UnlistenFn> {
  return listen("tymar://open-switcher", () => callback());
}

/** The system is suspending — Rust already closed the running entries at
 * the moment of sleep; mirror that locally. */
export function onSlept(
  callback: (payload: SleptEvent) => void,
): Promise<UnlistenFn> {
  return listen<SleptEvent>("tymar://slept", (event) => callback(event.payload));
}

/** The system resumed from sleep — reconcile and auto-resume if enabled. */
export function onWoke(
  callback: (payload: WokeEvent) => void,
): Promise<UnlistenFn> {
  return listen<WokeEvent>("tymar://woke", (event) => callback(event.payload));
}

/** Boot found entries left open across a long absence and closed them at
 * their last heartbeat. Also available via `api.takePowerGap()` (the event
 * usually fires before this webview has listeners). */
export function onPowerGap(
  callback: (payload: PowerGapEvent) => void,
): Promise<UnlistenFn> {
  return listen<PowerGapEvent>("tymar://power-gap", (event) =>
    callback(event.payload),
  );
}

// Deep-link URLs forwarded by the single-instance guard (Windows/Linux).
export function onDeepLinkEvent(
  callback: (urls: string[]) => void,
): Promise<UnlistenFn> {
  return listen<string[]>("tymar://deep-link", (event) =>
    callback(event.payload),
  );
}
