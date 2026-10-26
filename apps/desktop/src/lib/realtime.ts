import type { TimeEntry } from "@packages/domain/index";
import { getSupabaseClient } from "./supabase";
import { toTimeEntry } from "./db";

export type TimeEntryEventType = "INSERT" | "UPDATE" | "DELETE";

export type TimeEntryEvent = {
  eventType: TimeEntryEventType;
  entry: TimeEntry;
};

type RealtimeCallback = (event: TimeEntryEvent) => void;

/** Connection state for the channel — drives the "Reconnecting…" hint. */
export type RealtimeStatus = "connected" | "disconnected";

/** Subscribes to this user's time_entries realtime events. Returns an
 * unsubscribe function (idempotent).
 *
 * `onReconnect` is called whenever the channel re-establishes after a
 * disconnect so the caller can do a single catch-up refetch. `onStatus`
 * tracks the channel's connection state. */
export function subscribeToTimeEntries(
  userId: string,
  callback: RealtimeCallback,
  onReconnect?: () => void,
  onStatus?: (status: RealtimeStatus) => void,
): () => void {
  const sb = getSupabaseClient();
  if (!sb) return () => {};

  let firstSubscribe = true;

  const channel = sb
    .channel(`te-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "time_entries",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = (payload.new ?? payload.old) as any;
          const entry = toTimeEntry(row);
          callback({
            eventType: payload.eventType as TimeEntryEventType,
            entry,
          });
        } catch {
          // Malformed payload — ignore, the next refetch reconciles state.
        }
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        onStatus?.("connected");
        if (firstSubscribe) {
          firstSubscribe = false;
        } else {
          // Reconnected after a drop — caller refetches to catch up.
          onReconnect?.();
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
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
