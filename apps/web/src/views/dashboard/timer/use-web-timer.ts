"use client";

import { useAuth } from "@/lib/auth-context";
import {
  createTimeEntry,
  getActiveTimeEntries,
  updateTimeEntry,
} from "@/lib/db";
import { createSupabaseClient } from "@/lib/supabase";
import type { EntryType, TimeEntry } from "@packages/domain/index";
import { TABLES } from "@packages/domain/index";
import { useCallback, useEffect, useRef, useState } from "react";
// Web app doesn't bundle sonner; surface errors via the callback pattern below.
function toastError(label: string, err: unknown) {
  console.error(`${label}:`, err instanceof Error ? err.message : String(err));
}

type TimerStatus = "IDLE" | "WORKING" | "BREAK";

export type WebTimerState = {
  status: TimerStatus;
  activeEntry: TimeEntry | null;
  elapsedMs: number;
  busy: boolean;
  start: (taskId: string | null, projectId: string | null) => Promise<void>;
  stop: () => Promise<void>;
  takeBreak: () => Promise<void>;
  resume: () => Promise<void>;
  switchTo: (taskId: string | null, projectId: string | null) => Promise<void>;
};

export function useWebTimer(): WebTimerState {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [busy, setBusy] = useState(false);

  const activeRef = useRef<TimeEntry | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const apply = useCallback((entry: TimeEntry | null) => {
    if (!mountedRef.current) return;
    activeRef.current = entry;
    setActiveEntry(entry);
    if (entry) {
      const startMs = new Date(entry.startedAt).getTime();
      setElapsedMs(Number.isFinite(startMs) ? Math.max(0, Date.now() - startMs) : 0);
    } else {
      setElapsedMs(0);
    }
  }, []);

  // Tick elapsed
  useEffect(() => {
    if (!activeRef.current) return;
    const id = setInterval(() => {
      const entry = activeRef.current;
      if (!entry) return;
      const startMs = new Date(entry.startedAt).getTime();
      setElapsedMs(Number.isFinite(startMs) ? Math.max(0, Date.now() - startMs) : 0);
    }, 1000);
    return () => clearInterval(id);
  }, [activeEntry]);

  // Initial load + realtime
  useEffect(() => {
    if (!userId) {
      apply(null);
      return;
    }
    let cancelled = false;

    void getActiveTimeEntries(userId).then((entries) => {
      if (!cancelled) apply(entries[0] ?? null);
    });

    const sb = createSupabaseClient();
    const channel = sb
      .channel(`web-timer-${userId}`)
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = (payload.new ?? payload.old) as any;
          if (!row) return;
          const current = activeRef.current;

          if (payload.eventType === "DELETE" || row.ended_at) {
            if (current && row.id === current.id) apply(null);
            return;
          }
          if (!row.ended_at) {
            if (
              !current ||
              row.id === current.id ||
              row.started_at >= current.startedAt
            ) {
              apply({
                id: row.id,
                userId: row.user_id,
                taskId: row.task_id ?? null,
                projectId: row.project_id ?? null,
                type: row.type as EntryType,
                startedAt: row.started_at,
                endedAt: row.ended_at ?? null,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
              });
            }
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
  }, [userId, apply]);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await fn();
      } catch (err) {
        toastError(`${label} failed`, err);
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
      }
    },
    [],
  );

  const start = useCallback(
    (taskId: string | null, projectId: string | null) =>
      run("Start", async () => {
        if (!userId) throw new Error("You're signed out.");
        const entry = await createTimeEntry(userId, {
          taskId,
          projectId,
          type: "WORK",
          startedAt: new Date().toISOString(),
          endedAt: null,
        });
        apply(entry);
      }),
    [run, userId, apply],
  );

  const stop = useCallback(
    () =>
      run("Stop", async () => {
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        const closed = await updateTimeEntry(current.id, {
          endedAt: new Date().toISOString(),
        });
        if (closed) apply(null);
      }),
    [run, apply],
  );

  const takeBreak = useCallback(
    () =>
      run("Break", async () => {
        if (!userId) throw new Error("You're signed out.");
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        if (current.type === "BREAK") throw new Error("Already on a break.");
        await updateTimeEntry(current.id, { endedAt: new Date().toISOString() });
        const entry = await createTimeEntry(userId, {
          taskId: current.taskId,
          projectId: current.projectId,
          type: "BREAK",
          startedAt: new Date().toISOString(),
          endedAt: null,
        });
        apply(entry);
      }),
    [run, userId, apply],
  );

  const resume = useCallback(
    () =>
      run("Resume", async () => {
        if (!userId) throw new Error("You're signed out.");
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        if (current.type !== "BREAK") throw new Error("Timer is not on a break.");
        await updateTimeEntry(current.id, { endedAt: new Date().toISOString() });
        const entry = await createTimeEntry(userId, {
          taskId: current.taskId,
          projectId: current.projectId,
          type: "WORK",
          startedAt: new Date().toISOString(),
          endedAt: null,
        });
        apply(entry);
      }),
    [run, userId, apply],
  );

  const switchTo = useCallback(
    (taskId: string | null, projectId: string | null) =>
      run("Switch", async () => {
        if (!userId) throw new Error("You're signed out.");
        const current = activeRef.current;
        if (current) {
          await updateTimeEntry(current.id, { endedAt: new Date().toISOString() });
        }
        const entry = await createTimeEntry(userId, {
          taskId,
          projectId,
          type: "WORK",
          startedAt: new Date().toISOString(),
          endedAt: null,
        });
        apply(entry);
      }),
    [run, userId, apply],
  );

  const status: TimerStatus =
    activeEntry === null ? "IDLE" : activeEntry.type === "BREAK" ? "BREAK" : "WORKING";

  return { status, activeEntry, elapsedMs, busy, start, stop, takeBreak, resume, switchTo };
}
