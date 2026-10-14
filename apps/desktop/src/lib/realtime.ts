import type { TimeEntry } from "@packages/domain/index";
import { getSupabaseClient } from "./supabase";
import { toTimeEntry } from "./db";

export type TimeEntryEventType = "INSERT" | "UPDATE" | "DELETE";

export type TimeEntryEvent = {
  eventType: TimeEntryEventType;
  entry: TimeEntry;
};

type RealtimeCallback = (event: TimeEntryEvent) => void;

/** Subscribes to this user's time_entries realtime events. Returns an
 * unsubscribe function (idempotent). Callback errors are swallowed — a
 * bad handler must never kill the socket. */
export function subscribeToTimeEntries(
  userId: string,
  callback: RealtimeCallback,
): () => void {
  const sb = getSupabaseClient();
  if (!sb) return () => {};

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
    .subscribe();

  let done = false;
  return () => {
    if (done) return;
    done = true;
    void sb.removeChannel(channel);
  };
}
