import { useApp } from "@/context/app-context";
import {
    createManualTimeEntry,
    getProfile,
    listTimeEntries,
    updateManualTimeEntry,
} from "@/lib/db";
import { onDataPulled } from "@/lib/sync-bus";
import { useAsyncAction } from "@/lib/use-async-action";
import type { EntryType, Profile, TimeEntry } from "@packages/domain/index";
import { useCallback, useEffect, useState } from "react";

const LIMIT = 500;

/** Latest time entries + reporting profile (timezone) — consumers filter/aggregate locally. */
export function useTimeEntriesData() {
  const { auth, settings, updateSetting } = useApp();
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
      // Remember the reporting timezone so day totals stay right offline
      // (the profile itself lives in the cloud).
      if (
        fetchedProfile?.timezone &&
        fetchedProfile.timezone !== settings.profile_timezone
      ) {
        void updateSetting("profile_timezone", fetchedProfile.timezone).catch(
          () => {},
        );
      }
      setEntries(fetchedEntries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]),
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // A sync cycle just wrote pulled rows into SQLite — pick them up so
  // Home/Times totals never sit stale until a remount.
  useEffect(() => onDataPulled(() => void reload()), [reload]);

  const timeZone =
    profile?.timezone ||
    settings.profile_timezone ||
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
