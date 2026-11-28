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
import { entryDurationMs, formatDuration, type EntryType, type TimeEntry } from "@packages/domain/index";
import { toast } from "sonner";
import { useApp } from "./app-context";
import { useProjects, useTasks } from "./db/db-context";
import { api, onPowerGap, onSlept, onTrayAction, onWoke, type PowerGapEvent, type SleptEvent } from "../lib/api";
import {
  closeTimeEntry,
  createOpenTimeEntry,
  getActiveTimeEntries,
} from "../lib/db";
import { notifyLocalMutation, onDataPulled } from "../lib/sync-bus";
import { setActionFailure } from "../lib/pending-notice";
import type { TimerStatus, TimerView } from "../types";

// The timer is local-first: SQLite is the only thing it reads or writes.
// Starting, stopping, breaking and switching are instant local commits; the
// sync engine carries them to the cloud (and brings other devices' changes
// back into SQLite, where `reload` picks them up). No action ever waits on
// the network and no network state can stop or hide a running timer.

type TimerContextValue = {
  view: TimerView;
  /** True while a timer action is in flight. */
  busy: boolean;
  /** Elapsed ms of the open entry captured when `fetchedAt` was stamped —
   * add `Date.now() - fetchedAt` for the live value. */
  elapsedMsBase: number;
  /** Epoch ms when the current view/anchor was received. */
  fetchedAt: number;

  /** Extra open entries besides the active one (e.g. started on another
   * device while this one was offline) — display-only. */
  others: TimeEntry[];

  start: (taskId: string | null, projectId: string | null) => Promise<void>;
  takeBreak: () => Promise<void>;
  resume: () => Promise<void>;
  /** `at` (epoch ms) is the moment the user decided to stop — pass it when
   * confirmation happens later (e.g. a dialog left open) so the entry ends
   * when they asked, not when they confirmed. */
  stop: (at?: number) => Promise<void>;
  /** `at` works like `stop`'s: the old entry ends and the new one starts
   * at the moment the switch was initiated. */
  switchTo: (
    taskId: string | null,
    projectId: string | null,
    at?: number,
  ) => Promise<void>;
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

/** Wall-clock jump the watchdog treats as missed sleep — far above any
 * GC or tab-throttle stall, far below a real nap. */
const SLEEP_WATCHDOG_GAP_MS = 120_000;
const SLEEP_WATCHDOG_TICK_MS = 15_000;

/** Every automatic stop (sleep event, boot gap, watchdog) surfaces the
 * same deduped toast, so concurrent paths collapse into one message. */
const GAP_STOP_TOAST_ID = "gap-stop";

function startedAtMs(entry: TimeEntry): number | null {
  const ms = new Date(entry.startedAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { auth, settings } = useApp();
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const userId = auth?.user?.id ?? null;

  const [active, setActive] = useState<TimeEntry | null>(null);
  const [others, setOthers] = useState<TimeEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [elapsedMsBase, setElapsedMsBase] = useState(0);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const mounted = useRef(true);
  const activeRef = useRef<TimeEntry | null>(null);
  const busyRef = useRef(false);

  // ---- Sleep / power-gap state (see the sleep effects below) ----
  /** Wall clock of the last watchdog tick — a jump between ticks means the
   * process was suspended without any sleep event arriving. */
  const lastTickWall = useRef(Date.now());
  /** Settings mirrored into a ref so interval/event handlers always read
   * fresh values without re-subscribing. */
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Adopts an entry (or none) as the active one and resets the elapsed
   * anchor so the ticking display never jumps. Nothing but a real change
   * of entry touches the anchor. */
  const apply = useCallback((entry: TimeEntry | null) => {
    if (!mounted.current) return;
    const unchanged =
      activeRef.current?.id === entry?.id &&
      activeRef.current?.type === entry?.type;
    activeRef.current = entry;
    setActive(entry);
    if (unchanged && entry) return;
    const start = entry ? startedAtMs(entry) : null;
    const now = Date.now();
    setElapsedMsBase(start === null ? 0 : Math.max(0, now - start));
    setFetchedAt(now);
  }, []);

  /** Re-reads the open entries from SQLite — the single path by which the
   * UI learns anything. `announce` explains an unexpected stop (the entry
   * closed by a sync pull from another device). */
  const reload = useCallback(
    async (announce = true) => {
      if (!userId) {
        apply(null);
        setOthers([]);
        return;
      }
      let open: TimeEntry[];
      try {
        open = await getActiveTimeEntries(userId);
      } catch {
        return; // keep showing what we have; never blank a running timer
      }
      if (!mounted.current) return;
      const previous = activeRef.current;
      const next = open.find((e) => e.id === previous?.id) ?? open[0] ?? null;
      if (previous && !next && announce) {
        toast.info("This timer was stopped on another device.");
      }
      apply(next);
      setOthers(open.filter((e) => e.id !== next?.id));
    },
    [userId, apply],
  );

  useEffect(() => {
    void reload(false);
  }, [reload]);

  // Remote changes land in SQLite via sync/realtime — pick them up.
  useEffect(() => {
    if (!userId) return;
    return onDataPulled(() => {
      if (busyRef.current) return;
      void reload();
    });
  }, [userId, reload]);

  // ---- Actions: one local commit each, then the sync engine takes over ----

  const run = useCallback(
    async (action: string, fn: () => Promise<void>) => {
      busyRef.current = true;
      setBusy(true);
      try {
        await fn();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`${action} failed`, { description: message });
        // The window may be hidden (tray click) — surface it again when the
        // user next looks at the app.
        setActionFailure(`${action} failed: ${message}`);
        await reload(false); // show the truth after a partial failure
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [reload],
  );

  /** Closes the current entry in SQLite. `endedAt` overrides the timestamp.
   * When the row was already closed (the Rust sleep guard beat us to it),
   * its committed end time stands. */
  const closeCurrent = useCallback(
    async (current: TimeEntry, endedAt?: string) => {
      await closeTimeEntry(current.id, endedAt ?? new Date().toISOString());
    },
    [],
  );

  /** Resolves a user-supplied action moment to an ISO end/start time:
   * never in the future, never before the running entry began. */
  const momentIso = useCallback((current: TimeEntry, at?: number) => {
    const now = Date.now();
    const started = startedAtMs(current) ?? now;
    const ms = Math.min(now, Math.max(started, at ?? now));
    return new Date(ms).toISOString();
  }, []);

  const openEntry = useCallback(
    async (
      taskId: string | null,
      projectId: string | null,
      type: EntryType,
      startedAt: string = new Date().toISOString(),
    ) => {
      if (!userId) throw new Error("You're signed out.");
      const doc = await createOpenTimeEntry(userId, {
        task_id: taskId,
        project_id: projectId,
        type,
        started_at: startedAt,
      });
      apply(doc);
      setOthers([]);
    },
    [userId, apply],
  );

  const start = useCallback(
    async (taskId: string | null, projectId: string | null) =>
      run("Start", async () => {
        if (activeRef.current)
          throw new Error("A timer is already running — switch task instead.");
        await openEntry(taskId, projectId, "WORK");
      }),
    [run, openEntry],
  );

  const takeBreak = useCallback(
    () =>
      run("Break", async () => {
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        if (current.type === "BREAK") throw new Error("Already on a break.");
        await closeCurrent(current);
        await openEntry(current.taskId, current.projectId, "BREAK");
      }),
    [run, closeCurrent, openEntry],
  );

  const resume = useCallback(
    () =>
      run("Resume", async () => {
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        if (current.type !== "BREAK")
          throw new Error("Timer is not on a break.");
        await closeCurrent(current);
        await openEntry(current.taskId, current.projectId, "WORK");
      }),
    [run, closeCurrent, openEntry],
  );

  const stop = useCallback(
    (at?: number) =>
      run("Stop", async () => {
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        await closeCurrent(current, momentIso(current, at));
        apply(null);
        notifyLocalMutation();
      }),
    [run, apply, closeCurrent, momentIso],
  );

  const switchTo = useCallback(
    async (taskId: string | null, projectId: string | null, at?: number) =>
      run("Switch", async () => {
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        // One instant ends the old entry and starts the new one, so the
        // switch leaves no gap and no overlap.
        const moment = momentIso(current, at);
        await closeCurrent(current, moment);
        await openEntry(taskId, projectId, "WORK", moment);
      }),
    [run, closeCurrent, openEntry, momentIso],
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

  // ---- Tray mirror: Rust renders whatever we push and its own native
  // ticker keeps the menubar readout live, so we only push on state
  // changes. Menu clicks come back as events and run the same actions ----

  const pushTray = useCallback((v: TimerView, elapsed: number) => {
    void api
      .setTrayState({
        running: v.status !== "IDLE",
        on_break: v.status === "BREAK",
        title: v.task_title ?? v.project_title ?? null,
        elapsed_ms: elapsed,
        started_at_ms: v.started_at_ms,
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

  // ---- Sleep / power-off handling ----
  //
  // Rust is the source of truth for the sleep moment: on system suspend it
  // closes the open entries in SQLite itself (the webview may already be
  // frozen) and on boot it closes entries left open across a long absence
  // at their last heartbeat. Here we mirror those stops into UI state and
  // tell the user what was committed. There is no auto-resume — the next
  // timer is started manually; every path is local-first, so the committed
  // segments sync whenever the machine is back online.

  /** Announces an automatic stop (deduped — the slept event, the boot
   * power-gap payload and the watchdog can all fire for the same stop). */
  const stopToast = useCallback((committedMs: number) => {
    if (!mounted.current) return;
    toast.info("Timer stopped while you were away.", {
      id: GAP_STOP_TOAST_ID,
      description:
        committedMs > 60_000
          ? `Logged ${formatDuration(committedMs)} before that.`
          : "The away time is not counted.",
    });
  }, []);

  /** Sum of the committed durations in a closed-entries payload. */
  const committedMsOf = useCallback(
    (entries: SleptEvent["entries"]) =>
      entries.reduce((sum, e) => sum + entryDurationMs(e.started_at, e.ended_at), 0),
    [],
  );

  useEffect(() => {
    if (!userId) return;

    const unlistenSlept = onSlept(({ entries }) => {
      if (activeRef.current) apply(null); // Rust already closed the row in SQLite
      stopToast(committedMsOf(entries));
    });

    const unlistenWoke = onWoke(async () => {
      if (!mounted.current || busyRef.current) return;
      const current = activeRef.current;
      if (!current) return;
      // Missed the slept event (rare): if the entry we still hold open has
      // vanished from the local DB, Rust closed it during sleep after all —
      // adopt the stop. If it's still open, the watchdog (which knows the
      // real suspend moment) decides whether the gap was sleep.
      try {
        const locals = await getActiveTimeEntries(userId);
        if (!mounted.current || busyRef.current) return;
        if (activeRef.current === current && !locals.some((e) => e.id === current.id)) {
          apply(null);
          stopToast(entryDurationMs(current.startedAt, current.endedAt));
        }
      } catch {
        // Offline at wake — the sync pull / watchdog backstop reconciles later.
      }
    });

    const handlePowerGap = (payload: PowerGapEvent) => {
      const ours = payload.entries.filter((e) => e.user_id === userId);
      if (ours.length === 0) return;
      apply(null); // Rust closed these at the last heartbeat before boot
      stopToast(committedMsOf(ours));
    };

    const unlistenGap = onPowerGap(handlePowerGap);

    // The boot power-gap event fires before this webview has listeners, so
    // Rust parks the payload — pull it once when the user is known.
    void api
      .takePowerGap()
      .then((payload) => {
        if (!payload || !mounted.current) return;
        handlePowerGap(payload);
      })
      .catch(() => {});

    return () => {
      unlistenSlept.then((fn) => fn());
      unlistenWoke.then((fn) => fn());
      unlistenGap.then((fn) => fn());
    };
  }, [userId, apply, stopToast, committedMsOf]);

  // Mirror the active timer into the Rust sleep guard: while armed, Rust
  // stops the timer itself on system sleep and a heartbeat file lets the
  // next boot detect a power-off.
  useEffect(() => {
    if (!userId) {
      void api.setSleepGuard(null).catch(() => {});
      return;
    }
    void api.setSleepGuard(activeRef.current ? userId : null).catch(() => {});
  }, [userId, active]);

  // Watchdog backstop: when no native sleep event arrived (unsupported
  // platform, or delivery failed) a big wall-clock jump between ticks means
  // the process was suspended. But JS timers also stall without any sleep
  // (hidden-window throttling / App Nap before the Rust-side nap guard),
  // so a gap alone is not proof: ask Rust whether a native suspend really
  // happened inside the gap, and only then close — at the suspend moment,
  // never at the stale tick. On macOS, Windows and Linux the native path
  // usually closed the entry already — this then no-ops.
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => {
      const now = Date.now();
      const last = lastTickWall.current;
      lastTickWall.current = now;
      const current = activeRef.current;
      if (!current || busyRef.current) return;
      const gap = now - last;
      if (gap <= SLEEP_WATCHDOG_GAP_MS) return;
      if (settingsRef.current.sleep_stop_enabled === "false") return;
      void run("Sleep", async () => {
        let suspendMs: number | null = null;
        let nativeSupported = false;
        try {
          const info = await api.takeSleepInfo();
          suspendMs = info.last_suspend_ms;
          nativeSupported = info.native_sleep_supported;
        } catch {
          // IPC hiccup — fall back to the old tick-based heuristic below.
        }
        if (nativeSupported && (suspendMs == null || suspendMs <= last)) {
          // No suspend inside the gap: the stall was throttling, not sleep —
          // the time counted in between is real and stays on the entry.
          return;
        }
        const startedMs = new Date(current.startedAt).getTime();
        // Commit point: the observed suspend moment (never the stale tick —
        // the tick may be hours older than the actual sleep), clamped so an
        // entry never ends before it started.
        const closedMs = Math.max(
          nativeSupported && suspendMs != null ? suspendMs : last,
          startedMs,
        );
        await closeCurrent(current, new Date(closedMs).toISOString());
        if (!mounted.current) return;
        apply(null);
        stopToast(Math.max(0, closedMs - startedMs));
      });
    }, SLEEP_WATCHDOG_TICK_MS);
    return () => clearInterval(id);
  }, [userId, run, closeCurrent, apply, stopToast]);

  const value: TimerContextValue = {
    view,
    busy,
    elapsedMsBase,
    fetchedAt,
    others,
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
