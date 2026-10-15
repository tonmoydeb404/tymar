import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  LegacyPendingEntry,
  TrayAction,
  TrayState,
  UpdateInfo,
} from "../types";

// ---- IPC row types (mirror Rust domain.rs serde output) ----

export type ProjectIpc = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
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
};

export type PendingSyncPayload = {
  projects: ProjectIpc[];
  tasks: TaskIpc[];
  time_entries: TimeEntryIpc[];
};

export type AckIds = {
  project_ids: string[];
  task_ids: string[];
  entry_ids: string[];
};

export type SyncPullPayload = {
  projects: ProjectIpc[];
  tasks: TaskIpc[];
  time_entries: TimeEntryIpc[];
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

// Deep-link URLs forwarded by the single-instance guard (Windows/Linux).
export function onDeepLinkEvent(
  callback: (urls: string[]) => void,
): Promise<UnlistenFn> {
  return listen<string[]>("tymar://deep-link", (event) =>
    callback(event.payload),
  );
}
