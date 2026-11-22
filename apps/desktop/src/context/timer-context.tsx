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
  closeTimeEntryRemote,
  createOpenTimeEntry,
  getActiveTimeEntries,
  getActiveTimeEntriesFromCloud,
  mirrorCloudTimeEntryClosed,
  uploadTimeEntries,
  type PendingUpload,
} from "../lib/db";
import { onDataPulled } from "../lib/sync-bus";
import { subscribeToTimeEntries, type TimeEntryEvent } from "../lib/realtime";
import { setActionFailure } from "../lib/pending-notice";
import type { TimerStatus, TimerView } from "../types";

type TimerContextValue = {
  view: TimerView;
  /** True while a timer action is in flight. */
  busy: boolean;
  /** Elapsed ms of the open entry captured when `fetchedAt` was stamped —
   * add `Date.now() - fetchedAt` for the live value (clock-skew safe). */
  elapsedMsBase: number;
  /** Epoch ms when the current view/anchor was received. */
  fetchedAt: number;

  /** Timers running elsewhere (web / other devices) — display-only. */
  others: TimeEntry[];
  /** True when the last check for running timers failed (offline etc.). */
  checkFailed: boolean;
  /** Realtime channel state — drives the "Reconnecting…" hint. */
  connection: "connected" | "reconnecting" | "unknown";

  start: (taskId: string | null, projectId: string | null) => Promise<void>;
  takeBreak: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  switchTo: (taskId: string | null, projectId: string | null) => Promise<void>;
  /** Re-runs the check for running timers on other devices. */
  recheck: () => void;
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

function byNewestFirst(a: TimeEntry, b: TimeEntry): number {
  return b.startedAt.localeCompare(a.startedAt);
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { auth, settings } = useApp();
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const userId = auth?.user?.id ?? null;

  const [active, setActive] = useState<TimeEntry | null>(null);
  const [others, setOthers] = useState<TimeEntry[]>([]);
  const [checkFailed, setCheckFailed] = useState(false);
  const [connection, setConnection] = useState<
    "connected" | "reconnecting" | "unknown"
  >("unknown");
  const [busy, setBusy] = useState(false);
  const [elapsedMsBase, setElapsedMsBase] = useState(0);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const mounted = useRef(true);
  const activeRef = useRef<TimeEntry | null>(null);
  const busyRef = useRef(false);
  /** Every known open entry (active + elsewhere), by id — mirrors the
   * cloud's open list for the running-elsewhere banner. */
  const openMap = useRef<Map<string, TimeEntry>>(new Map());
  /** Entries created on THIS device whose create-push may not have landed
   * yet. The cloud won't list them as open, so the reconcile below must not
   * treat "missing from cloud" as "stopped elsewhere" for these. Cleared as
   * soon as the entry shows up in the cloud's open list. */
  const pendingLocalIds = useRef<Set<string>>(new Set());

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

  /** Mirrors the open-entries map (minus the active one) into state. */
  const syncOthers = useCallback(() => {
    if (!mounted.current) return;
    const activeId = activeRef.current?.id;
    const rest = [...openMap.current.values()].filter(
      (e) => e.id !== activeId,
    );
    rest.sort(byNewestFirst);
    setOthers(rest);
  }, []);

  /** Single convergence point: adopting an entry (or none) resets the
   * elapsed anchor so the ticking display never jumps. */
  const apply = useCallback(
    (entry: TimeEntry | null) => {
      if (!mounted.current) return;
      const previousId = activeRef.current?.id;
      activeRef.current = entry;
      setActive(entry);
      if (entry) {
        openMap.current.set(entry.id, entry);
      } else if (previousId) {
        // Closed/stopped — it's no longer an open entry anywhere.
        openMap.current.delete(previousId);
      }
      const start = entry ? startedAtMs(entry) : null;
      const now = Date.now();
      setElapsedMsBase(start === null ? 0 : Math.max(0, now - start));
      setFetchedAt(now);
      syncOthers();
    },
    [syncOthers],
  );

  const upsertOpen = useCallback(
    (entry: TimeEntry) => {
      // A realtime echo means the entry reached the cloud.
      pendingLocalIds.current.delete(entry.id);
      openMap.current.set(entry.id, entry);
      syncOthers();
    },
    [syncOthers],
  );

  const removeOpen = useCallback(
    (entryId: string) => {
      openMap.current.delete(entryId);
      syncOthers();
    },
    [syncOthers],
  );

  // ---- Running timers: local entry is ours; cloud entries are banner-only.
  // Every successful cloud check converges local state to the cloud's open
  // list, so a session stopped on another device disappears immediately —
  // even when the realtime event was missed (app closed, offline, socket
  // drop without a reconnect callback). ----

  const reconcileFromCloud = useCallback(
    (cloudEntries: TimeEntry[]) => {
      const cloudIds = new Set(cloudEntries.map((e) => e.id));
      for (const entry of cloudEntries) {
        pendingLocalIds.current.delete(entry.id);
        openMap.current.set(entry.id, entry);
      }
      const current = activeRef.current;
      if (current && !cloudIds.has(current.id)) {
        if (pendingLocalIds.current.has(current.id)) {
          // Created here, create-push still in flight — keep it running.
          openMap.current.set(current.id, current);
        } else {
          // The cloud no longer lists our running entry as open → it was
          // stopped or deleted elsewhere. Mirror the cloud's closed row
          // locally (never push a newer end time over it) and go idle.
          void mirrorCloudTimeEntryClosed(current).catch(() => {
            // Sync pull reconciles the local row later.
          });
          apply(null);
          toast.info("This timer was stopped on another device.");
        }
      } else if (current) {
        const fresh = cloudEntries.find((e) => e.id === current.id);
        if (fresh) apply(fresh);
      }
      // Drop everything the cloud no longer lists as open (stale banner
      // leftovers from missed events) — except the guarded local entry.
      for (const id of openMap.current.keys()) {
        if (!cloudIds.has(id) && !(current && id === current.id)) {
          openMap.current.delete(id);
        }
      }
      syncOthers();
    },
    [apply, syncOthers],
  );

  const fetchRunning = useCallback(async (): Promise<boolean> => {
    if (!userId) return true;
    try {
      const cloudEntries = await getActiveTimeEntriesFromCloud(userId);
      if (!mounted.current) return true;
      reconcileFromCloud(cloudEntries);
      setCheckFailed(false);
      return true;
    } catch {
      if (mounted.current) setCheckFailed(true);
      return false;
    }
  }, [userId, reconcileFromCloud]);

  useEffect(() => {
    if (!userId) {
      apply(null);
      openMap.current.clear();
      pendingLocalIds.current.clear();
      syncOthers();
      setCheckFailed(false);
      setConnection("unknown");
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const handleEvent = ({ eventType, entry }: TimeEntryEvent) => {
      const current = activeRef.current;

      const stoppedOrRemoved =
        eventType === "DELETE" || Boolean(entry.endedAt);
      if (stoppedOrRemoved) {
        removeOpen(entry.id);
        if (current && entry.id === current.id) {
          // Stopped/deleted on another device (a local stop never reaches
          // this branch — it flips `activeRef` synchronously before the
          // echo arrives). Mirror the closed row so a restart can't
          // resurrect the timer. Mirror `current`, not `entry`: DELETE
          // payloads carry the primary key only.
          void mirrorCloudTimeEntryClosed(current).catch(() => {});
          apply(null);
          toast.info("This timer was stopped on another device.");
        }
        return;
      }
      const known = openMap.current.get(entry.id);
      upsertOpen(entry);
      if (current && entry.id === current.id) {
        apply(entry);
      } else if (!known && current && entry.startedAt > current.startedAt) {
        // A newer timer appeared elsewhere while one runs locally — keep
        // both; the banner lists the other one. No silent adoption.
        toast.info("A timer was started on another device.", {
          description: "You can see it in the running list below.",
        });
      }
    };

    (async () => {
      // Adopt this device's own open entry (survives restarts, works
      // offline). Cloud entries stay display-only in the banner.
      try {
        const locals = await getActiveTimeEntries(userId);
        if (cancelled) return;
        for (const entry of locals) openMap.current.set(entry.id, entry);
        if (locals[0]) apply(locals[0]);
        syncOthers();
      } catch {
        // Local read failure is unexpected but non-fatal; cloud still flows.
      }
      await fetchRunning();
      if (cancelled) return;
      unsubscribe = subscribeToTimeEntries(
        userId,
        handleEvent,
        // Reconnected after a disconnect — single refetch to catch up.
        () => {
          if (cancelled || busyRef.current) return;
          void fetchRunning();
        },
        (status) => {
          if (cancelled) return;
          setConnection(status === "connected" ? "connected" : "reconnecting");
        },
        "timer",
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId, apply, upsertOpen, removeOpen, syncOthers, fetchRunning]);

  // ---- Safety refetch on visibility: catches up after the app was backgrounded ----

  useEffect(() => {
    if (!userId) return;
    const onVisibility = () => {
      if (document.visibilityState !== "visible" || busyRef.current) return;
      void fetchRunning();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [userId, fetchRunning]);

  // ---- Actions: write to SQLite via IPC first, push to Supabase async;
  // realtime echoes back are idempotent ----

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
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [],
  );

  /** Closes the current entry locally, falling back to a cloud close when
   * no local open row exists (restart edge cases, double-stops).
   * Guarantees the timer can never wedge in "running". `endedAt` overrides
   * the timestamp. When the row was already closed (the Rust sleep guard
   * beat us to it), its committed end time stands — nothing is pushed. */
  const closeCurrent = useCallback(
    async (current: TimeEntry, endedAt?: string) => {
      if (!userId) throw new Error("You're signed out.");
      const ended = endedAt ?? new Date().toISOString();
      try {
        // null = already closed elsewhere; keep that committed end time.
        await closeTimeEntry(current.id, ended);
      } catch {
        await closeTimeEntryRemote(userId, current.id, ended);
      }
    },
    [userId],
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
        pendingLocalIds.current.add(doc.id);
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
        if (current.type === "BREAK") throw new Error("Already on a break.");
        await closeCurrent(current);
        try {
          const doc = await createOpenTimeEntry(userId, {
            task_id: current.taskId,
            project_id: current.projectId,
            type: "BREAK",
            started_at: new Date().toISOString(),
          });
          pendingLocalIds.current.add(doc.id);
          apply(doc);
        } catch (err) {
          apply(null); // truthful: there is no open entry now
          throw err;
        }
      }),
    [run, userId, apply, closeCurrent],
  );

  const resume = useCallback(
    () =>
      run("Resume", async () => {
        if (!userId) throw new Error("You're signed out.");
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        if (current.type !== "BREAK")
          throw new Error("Timer is not on a break.");
        await closeCurrent(current);
        try {
          const doc = await createOpenTimeEntry(userId, {
            task_id: current.taskId,
            project_id: current.projectId,
            type: "WORK",
            started_at: new Date().toISOString(),
          });
          pendingLocalIds.current.add(doc.id);
          apply(doc);
        } catch (err) {
          apply(null);
          throw err;
        }
      }),
    [run, userId, apply, closeCurrent],
  );

  const stop = useCallback(
    () =>
      run("Stop", async () => {
        if (!userId) throw new Error("You're signed out.");
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        await closeCurrent(current);
        apply(null);
      }),
    [run, userId, apply, closeCurrent],
  );

  const switchTo = useCallback(
    async (taskId: string | null, projectId: string | null) =>
      run("Switch", async () => {
        if (!userId) throw new Error("You're signed out.");
        const current = activeRef.current;
        if (!current) throw new Error("No timer is running.");
        await closeCurrent(current);
        try {
          const doc = await createOpenTimeEntry(userId, {
            task_id: taskId,
            project_id: projectId,
            type: "WORK",
            started_at: new Date().toISOString(),
          });
          pendingLocalIds.current.add(doc.id);
          apply(doc);
        } catch (err) {
          apply(null);
          throw err;
        }
      }),
    [run, userId, apply, closeCurrent],
  );

  const recheck = useCallback(() => {
    void fetchRunning();
  }, [fetchRunning]);

  // ---- Sync-pull backstop: when a sync cycle writes remote rows into
  // SQLite, re-check the cloud's open list so sessions stopped elsewhere
  // are reflected even if the realtime socket missed the event. ----

  useEffect(() => {
    if (!userId) return;
    return onDataPulled(() => {
      if (busyRef.current) return;
      void fetchRunning();
    });
  }, [userId, fetchRunning]);

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
    others,
    checkFailed,
    connection,
    start,
    takeBreak,
    resume,
    stop,
    switchTo,
    recheck,
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
