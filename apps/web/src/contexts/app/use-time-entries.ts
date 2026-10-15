import { useAuth } from "@/lib/auth-context";
import {
  createTimeEntry,
  deleteTimeEntry,
  listTimeEntries,
  updateTimeEntry,
  type TimeEntryInput,
} from "@/lib/db";
import { createSupabaseClient } from "@/lib/supabase";
import { useAsyncAction } from "@/lib/use-async-action";
import { TABLES, type EntryType, type TimeEntry } from "@packages/domain/index";
import { useCallback, useEffect, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEntry(row: Record<string, any>): TimeEntry {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    userId: String(row.user_id ?? ""),
    taskId: typeof row.task_id === "string" ? row.task_id : null,
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    type: (row.type as EntryType) ?? "WORK",
    startedAt: String(row.started_at ?? ""),
    endedAt: typeof row.ended_at === "string" ? row.ended_at : null,
  };
}

/** Latest 500 time entries — consumers filter/aggregate locally. */
export function useTimeEntriesData() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!userId) return;
      setTimeEntries(await listTimeEntries(userId, { limit: 500 }));
    }, [userId]),
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live updates from Supabase — keeps other tabs and devices in sync.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const sb = createSupabaseClient();
    const channel = sb
      .channel(`time-entries-rt-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLES.timeEntries,
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) setTimeEntries((prev) => prev.filter((e) => e.id !== id));
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          if (!row?.id) return;
          const item = rowToEntry(row);
          setTimeEntries((prev) => {
            const exists = prev.some((e) => e.id === item.id);
            const next = exists
              ? prev.map((e) => (e.id === item.id ? item : e))
              : [item, ...prev];
            return next.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
          });
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
  }, [userId]);

  const upsert = (saved: TimeEntry) => {
    setTimeEntries((prev) => {
      const exists = prev.some((e) => e.id === saved.id);
      const next = exists
        ? prev.map((e) => (e.id === saved.id ? saved : e))
        : [saved, ...prev];
      return next.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    });
  };

  const create = useAsyncAction(async (input: TimeEntryInput) => {
    if (!userId) throw new Error("Not signed in.");
    const saved = await createTimeEntry(userId, input);
    upsert(saved);
    return saved;
  });

  const update = useAsyncAction(
    async (
      entryId: string,
      patch: Partial<
        Pick<TimeEntry, "taskId" | "projectId" | "type" | "startedAt" | "endedAt">
      >,
    ) => {
      const saved = await updateTimeEntry(entryId, patch);
      upsert(saved);
      return saved;
    },
  );

  const remove = useAsyncAction(async (entryId: string) => {
    await deleteTimeEntry(entryId);
    setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
  });

  return {
    timeEntries,
    setTimeEntries,
    loading,
    error,
    reload,
    create,
    update,
    remove,
  };
}
