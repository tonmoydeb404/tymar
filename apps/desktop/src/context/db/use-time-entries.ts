import { useApp } from "@/context/app-context";
import {
    createManualTimeEntry,
    getProfile,
    listTimeEntries,
    updateManualTimeEntry,
} from "@/lib/db";
import { subscribeToTimeEntries } from "@/lib/realtime";
import { useAsyncAction } from "@/lib/use-async-action";
import type { EntryType, Profile, TimeEntry } from "@packages/domain/index";
import { useCallback, useEffect, useState } from "react";

const LIMIT = 500;

/** Latest time entries + reporting profile (timezone) — consumers filter/aggregate locally. */
export function useTimeEntriesData() {
  const { auth } = useApp();
  const userId = auth?.user?.id ?? null;
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!userId) {
        setEntries([]);
        setProfile(null);
        return;
      }
      const [fetchedProfile, fetchedEntries] = await Promise.all([
        getProfile(userId),
        listTimeEntries(userId, LIMIT),
      ]);
      setProfile(fetchedProfile);
      setEntries(fetchedEntries);
    }, [userId]),
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // Realtime keeps the shared list fresh — a timer stopped on this device
  // (or any other) lands here without a manual reload, so Home/Times
  // totals stay accurate.
  useEffect(() => {
    if (!userId) return;
    const upsertRow = (row: TimeEntry) => {
      setEntries((prev) => {
        const exists = prev.some((e) => e.id === row.id);
        const next = exists
          ? prev.map((e) => (e.id === row.id ? row : e))
          : [row, ...prev];
        return next.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      });
    };
    return subscribeToTimeEntries(userId, ({ eventType, entry }) => {
      if (eventType === "DELETE") {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      } else {
        upsertRow(entry);
      }
    });
  }, [userId]);

  const timeZone =
    profile?.timezone ||
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC");

  // Keeps the shared list newest-first so the Times screen + Home stats
  // (both derived from `entries`) reflect a create/update immediately.
  const upsert = useCallback((saved: TimeEntry) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === saved.id);
      const next = exists
        ? prev.map((e) => (e.id === saved.id ? saved : e))
        : [saved, ...prev];
      return next.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    });
  }, []);

  const addManualEntry = useAsyncAction(
    async (input: {
      taskId: string | null;
      projectId: string | null;
      type: EntryType;
      startedAt: string;
      endedAt: string | null;
    }) => {
      if (!userId) throw new Error("You're signed out.");
      const created = await createManualTimeEntry(userId, input);
      upsert(created);
      return created;
    },
  );

  const updateEntry = useAsyncAction(
    async (
      entryId: string,
      patch: Partial<
        Pick<
          TimeEntry,
          "taskId" | "projectId" | "type" | "startedAt" | "endedAt"
        >
      >,
    ) => {
      const saved = await updateManualTimeEntry(entryId, patch);
      upsert(saved);
      return saved;
    },
  );

  return {
    entries,
    profile,
    timeZone,
    loading,
    error,
    reload,
    addManualEntry: addManualEntry.run,
    addingManualEntry: addManualEntry.isLoading,
    updateEntry: updateEntry.run,
    updatingEntry: updateEntry.isLoading,
  };
}
