import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EntryType, TimeEntry } from "@packages/domain/index";
import { toast } from "sonner";
import { useApp } from "./app-context";
import { useProjects, useTasks } from "./db/db-context";
import { api, onTrayAction } from "../lib/api";
import {
  closeTimeEntry,
  createOpenTimeEntry,
  getActiveTimeEntries,
  uploadTimeEntries,
  type PendingUpload,
} from "../lib/db";
import { subscribeToTimeEntries, type TimeEntryEvent } from "../lib/realtime";
import type { TimerStatus, TimerView } from "../types";

type TimerContextValue = {
  /** Derived from the cloud's open entry (endedAt = null) — status IDLE
   * when nothing is running, for this user, on any device. */
  view: TimerView;
  /** True while a timer action is in flight. */
  busy: boolean;
  /** Elapsed ms of the open entry captured when `fetchedAt` was stamped —
   * add `Date.now() - fetchedAt` for the live value (clock-skew safe). */
  elapsedMsBase: number;
  /** Epoch ms when the current view/anchor was received. */
  fetchedAt: number;

  start: (taskId: string | null, projectId: string | null) => Promise<void>;
  takeBreak: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  switchTo: (taskId: string | null, projectId: string | null) => Promise<void>;
};

const TimerContext = createContext<TimerContextValue | null>(null);

const IDLE_VIEW: TimerView = {
  status: "IDLE",
  kind: "WORK",
  task_id: null,
  task_title: null,
  project_id: null,
  project_title: null,
  started_at_ms: null,
  entry_id: null,
};

function startedAtMs(entry: TimeEntry): number | null {
  const ms = new Date(entry.startedAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { auth } = useApp();
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const userId = auth?.user?.id ?? null;

  const [active, setActive] = useState<TimeEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsedMsBase, setElapsedMsBase] = useState(0);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const mounted = useRef(true);
  const activeRef = useRef<TimeEntry | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Single convergence point: adopting a cloud entry (or none) resets the
   * elapsed anchor so the ticking display never jumps. */
  const apply = useCallback((entry: TimeEntry | null) => {
    if (!mounted.current) return;
    activeRef.current = entry;
    setActive(entry);
    const start = entry ? startedAtMs(entry) : null;
    const now = Date.now();
    setElapsedMsBase(start === null ? 0 : Math.max(0, now - start));
    setFetchedAt(now);
  }, []);

  // ---- Realtime is the source of truth for the running timer ----

  useEffect(() => {
    if (!userId) {
      apply(null);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const handleEvent = ({ eventType, entry }: TimeEntryEvent) => {
      const current = activeRef.current;

      if (eventType === "DELETE") {
        if (current && entry.id === current.id) apply(null);
        return;
      }
      if (!entry.endedAt) {
        // An entry opened anywhere becomes the running timer — adopt the
        // newest when two open entries coexist (time conflicts allowed).
        if (
          !current ||
          entry.id === current.id ||
          entry.startedAt >= current.startedAt
        ) {
          apply(entry);
        }
      } else if (current && entry.id === current.id) {
        apply(null);
      }
    };

    (async () => {
      // One API call at boot: pick the newest open entry (any device).
      try {
        const actives = await getActiveTimeEntries(userId);
        if (!cancelled) apply(actives[0] ?? null);
      } catch {
        // Offline at boot — realtime + refetches reconcile once connected.
      }
      if (cancelled) return;
      unsubscribe = subscribeToTimeEntries(userId, handleEvent);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId, apply]);

  // ---- Safety refetch: focus and a periodic net (realtime reconnects,
  // missed events, socket drops while throttled) ----

  useEffect(() => {
    if (!userId) return;
    const refetch = async () => {
      if (document.visibilityState !== "visible" || busyRef.current) return;
      try {
        const actives = await getActiveTimeEntries(userId);
        apply(actives[0] ?? null);
      } catch {
        // Keep last known state; retried on the next tick.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(() => void refetch(), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [userId, apply]);

  // ---- Actions: write to SQLite via IPC first, push to Supabase async;
  // realtime echoes back are idempotent ----

  const run = useCallback(
    async (action: string, fn: () => Promise<void>) => {
      busyRef.current = true;
      setBusy(true);
      try {
        await fn();
      } catch (err) {
        toast.error(`${action} failed`, {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [],
  );

  const start = useCallback(
    async (taskId: string | null, projectId: string | null) =>
      run("Start", async () => {
        if (!userId) throw new Error("You're signed out.");
        if (activeRef.current)
          throw new Error("A timer is already running — switch task instead.");
        const doc = await createOpenTimeEntry(userId, {
          task_id: taskId,
          project_id: projectId,
          type: "WORK" satisfies EntryType,
          started_at: new Date().toISOString(),
        });
        apply(doc);
      }),
    [run, userId, apply],
  );

  const takeBreak = useCallback(
    () =>
      run("Break", async () => {
        if (!userId) throw new Error("You're signed out.");
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        if (current.type === "BREAK")
          throw new Error("Already on a break.");
        await closeTimeEntry(current.id, new Date().toISOString());
        try {
          apply(
            await createOpenTimeEntry(userId, {
              task_id: current.taskId,
              project_id: current.projectId,
              type: "BREAK",
              started_at: new Date().toISOString(),
            }),
          );
        } catch (err) {
          apply(null); // truthful: the cloud has no open entry now
          throw err;
        }
      }),
    [run, userId, apply],
  );

  const resume = useCallback(
    () =>
      run("Resume", async () => {
        if (!userId) throw new Error("You're signed out.");
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        if (current.type !== "BREAK")
          throw new Error("Timer is not on a break.");
        await closeTimeEntry(current.id, new Date().toISOString());
        try {
          apply(
            await createOpenTimeEntry(userId, {
              task_id: current.taskId,
              project_id: current.projectId,
              type: "WORK",
              started_at: new Date().toISOString(),
            }),
          );
        } catch (err) {
          apply(null);
          throw err;
        }
      }),
    [run, userId, apply],
  );

  const stop = useCallback(
    () =>
      run("Stop", async () => {
        if (!userId) throw new Error("You're signed out.");
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        await closeTimeEntry(current.id, new Date().toISOString());
        apply(null);
      }),
    [run, userId, apply],
  );

  const switchTo = useCallback(
    async (taskId: string | null, projectId: string | null) =>
      run("Switch", async () => {
        if (!userId) throw new Error("You're signed out.");
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        await closeTimeEntry(current.id, new Date().toISOString());
        try {
          apply(
            await createOpenTimeEntry(userId, {
              task_id: taskId,
              project_id: projectId,
              type: "WORK",
              started_at: new Date().toISOString(),
            }),
          );
        } catch (err) {
          apply(null);
          throw err;
        }
      }),
    [run, userId, apply],
  );

  // ---- Derived view (titles resolved from the shared lists) ----

  const view = useMemo<TimerView>(() => {
    if (!active) return IDLE_VIEW;
    const taskTitle = active.taskId
      ? (tasks.find((t) => t.id === active.taskId)?.title ?? null)
      : null;
    const projectTitle = active.projectId
      ? (projects.find((p) => p.id === active.projectId)?.name ?? null)
      : null;
    const status: TimerStatus = active.type === "BREAK" ? "BREAK" : "WORKING";
    return {
      status,
      kind: active.type,
      task_id: active.taskId,
      task_title: taskTitle,
      project_id: active.projectId,
      project_title: projectTitle,
      started_at_ms: startedAtMs(active),
      entry_id: active.id,
    };
  }, [active, tasks, projects]);

  // ---- Tray mirror: Rust renders whatever we push; menu clicks come back
  // as events and run the same actions ----

  const pushTray = useCallback((v: TimerView, elapsed: number) => {
    void api
      .setTrayState({
        running: v.status !== "IDLE",
        on_break: v.status === "BREAK",
        title: v.task_title ?? v.project_title ?? null,
        elapsed_ms: elapsed,
      })
      .catch(() => {
        // Tray is cosmetic; never surface push failures.
      });
  }, []);

  useEffect(() => {
    if (!userId) {
      pushTray(IDLE_VIEW, 0);
      return;
    }
    const running = view.status !== "IDLE";
    pushTray(
      view,
      running ? Math.max(0, elapsedMsBase + Date.now() - fetchedAt) : 0,
    );
    if (!running) return;
    // Keep the tray's elapsed readout fresh (replaces the old Rust tick).
    const interval = setInterval(() => {
      pushTray(view, Math.max(0, elapsedMsBase + Date.now() - fetchedAt));
    }, 30_000);
    return () => clearInterval(interval);
  }, [view, elapsedMsBase, fetchedAt, userId, pushTray]);

  useEffect(() => {
    const unlisten = onTrayAction((action) => {
      if (action === "break") void takeBreak();
      else if (action === "resume") void resume();
      else void stop();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [takeBreak, resume, stop]);

  // ---- Legacy drain: upload closed segments queued by pre-realtime
  // versions in timer-state.json, then clear them from the file ----

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const pending = await api.getLegacyPending();
        if (cancelled || pending.length === 0) return;
        const uploads: PendingUpload[] = pending.map((e) => ({
          local_id: e.local_id,
          task_id: e.task_id,
          project_id: e.project_id,
          type: e.type,
          started_at: e.started_at,
          ended_at: e.ended_at,
          remote_id: e.remote_id,
        }));
        const ids = await uploadTimeEntries(userId, uploads);
        if (cancelled) return;
        await api.clearLegacyPending(ids);
      } catch {
        // Old file is untouched until upload succeeds — retried next boot.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value: TimerContextValue = {
    view,
    busy,
    elapsedMsBase,
    fetchedAt,
    start,
    takeBreak,
    resume,
    stop,
    switchTo,
  };

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (context === null) {
    throw new Error("useTimer must be used within TimerProvider");
  }
  return context;
}
