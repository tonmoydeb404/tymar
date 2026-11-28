import { getSupabaseClient } from "./supabase";
import { TABLES } from "@packages/domain/index";
import type { SyncPullPayload } from "./api";
import {
  pgToProject,
  pgToTask,
  pgToTimeEntry,
  pgToWorkspace,
} from "./sync";

/** Channel state — drives the sync pill, never the timer. */
export type RealtimeStatus = "connected" | "disconnected";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PgRow = Record<string, any>;

export type RealtimeChange = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  /** The row converted into its local (IPC) shape, as a one-row pull
   * payload ready for `apply_sync_pull`. Null for DELETE events (payloads
   * carry only the primary key — see `deleted`). */
  payload: SyncPullPayload | null;
  /** DELETE events: which row the server removed. */
  deleted?: { kind: "workspace" | "project" | "task" | "entry"; id: string };
};

const EMPTY: SyncPullPayload = {
  workspaces: [],
  projects: [],
  tasks: [],
  time_entries: [],
};

const KIND: Record<string, "workspace" | "project" | "task" | "entry"> = {
  [TABLES.workspaces]: "workspace",
  [TABLES.projects]: "project",
  [TABLES.tasks]: "task",
  [TABLES.timeEntries]: "entry",
};

function toPayload(table: string, row: PgRow): SyncPullPayload {
  switch (table) {
    case TABLES.workspaces:
      return { ...EMPTY, workspaces: [pgToWorkspace(row)] };
    case TABLES.projects:
      return { ...EMPTY, projects: [pgToProject(row)] };
    case TABLES.tasks:
      return { ...EMPTY, tasks: [pgToTask(row)] };
    default:
      return { ...EMPTY, time_entries: [pgToTimeEntry(row)] };
  }
}

/** Subscribes to every synced table for this user over ONE channel. Each
 * remote change is handed to `onChange` already shaped for the local DB —
 * the caller writes it to SQLite (last-write-wins, dirty rows protected),
 * so the UI keeps reading a single source of truth. `onStatus` reports
 * connectivity; `onReconnect` fires after a drop so the caller can run a
 * catch-up sync. Returns an idempotent unsubscribe. */
export function subscribeToChanges(
  userId: string,
  onChange: (change: RealtimeChange) => void,
  onStatus?: (status: RealtimeStatus) => void,
  onReconnect?: () => void,
): () => void {
  const sb = getSupabaseClient();
  if (!sb) return () => {};

  let firstSubscribe = true;
  let channel = sb.channel(`sync-${userId}`);

  for (const table of [
    TABLES.workspaces,
    TABLES.projects,
    TABLES.tasks,
    TABLES.timeEntries,
  ]) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
      (payload) => {
        try {
          const eventType = payload.eventType as RealtimeChange["eventType"];
          if (eventType === "DELETE") {
            const id = (payload.old as PgRow | undefined)?.id;
            onChange({
              eventType,
              payload: null,
              deleted: id ? { kind: KIND[table] ?? "entry", id: String(id) } : undefined,
            });
            return;
          }
          onChange({ eventType, payload: toPayload(table, payload.new as PgRow) });
        } catch {
          // Malformed payload — the next sync cycle reconciles it.
        }
      },
    );
  }

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      onStatus?.("connected");
      if (firstSubscribe) firstSubscribe = false;
      else onReconnect?.();
    } else if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT" ||
      status === "CLOSED"
    ) {
      onStatus?.("disconnected");
    }
  });

  let done = false;
  return () => {
    if (done) return;
    done = true;
    void sb.removeChannel(channel);
  };
}
