import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { getSupabaseClient } from "../lib/supabase";
import { runSync, type SyncOutcome } from "../lib/sync";
import { notifyDataPulled, onLocalMutation } from "../lib/sync-bus";
import { useApp } from "./app-context";

export type SyncStatus = "idle" | "synced" | "offline" | "error";

type SyncContextValue = {
  /** Outcome of the last completed sync cycle. */
  status: SyncStatus;
  /** Rows still waiting to reach Supabase (pending_create/update/delete). */
  pendingCount: number;
  /** Epoch ms of the last completed cycle (success or failure). */
  lastSyncAt: number | null;
  /** First failure message from the last unsuccessful cycle. */
  lastError: string | null;
  /** True while a cycle is in flight. */
  syncing: boolean;
  /** Manual retry — re-pushes every pending row, ignoring the per-row
   * failure cap. */
  retry: () => void;
};

const SYNC_INTERVAL_MS = 5 * 60_000;
const MUTATION_DEBOUNCE_MS = 3_000;
const BACKOFF_STEPS_MS = [15_000, 30_000, 60_000, 120_000];
const TOAST_COOLDOWN_MS = 5 * 60_000;

const SyncContext = createContext<SyncContextValue | null>(null);

/** Owns the background Supabase sync loop and its observable health.
 * Failures are never swallowed here: they land in `status`/`lastError`
 * (surfaced by the Home status pill) and toast at most once per cooldown. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { auth } = useApp();
  const userId = auth?.user?.id ?? null;

  const [status, setStatus] = useState<SyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const cycle = useRef(0); // invalidates in-flight cycles after re-login
  const failureCount = useRef(0);
  const backoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastToastAt = useRef(0);
  /** Always points at the latest `runCycle` — backoff timers survive re-renders. */
  const runCycleRef = useRef<(force: boolean) => Promise<void> | void>(null);

  const clearBackoff = useCallback(() => {
    if (backoffTimer.current) {
      clearTimeout(backoffTimer.current);
      backoffTimer.current = null;
    }
  }, []);

  const scheduleRetry = useCallback(() => {
    clearBackoff();
    const step = Math.min(failureCount.current - 1, BACKOFF_STEPS_MS.length - 1);
    const delay = BACKOFF_STEPS_MS[Math.max(step, 0)];
    backoffTimer.current = setTimeout(() => void runCycleRef.current?.(false), delay);
  }, [clearBackoff]);

  const maybeToast = useCallback((outcome: SyncOutcome) => {
    if (outcome.ok) return;
    const now = Date.now();
    if (now - lastToastAt.current < TOAST_COOLDOWN_MS) return;
    lastToastAt.current = now;
    if (outcome.offline) {
      toast.info("Working offline", {
        description: "Changes are saved locally and will sync when you reconnect.",
      });
    } else {
      toast.error("Sync problem", {
        description: outcome.error ?? "Some changes couldn't reach the server.",
      });
    }
  }, []);

  const runCycle = useCallback(
    async (force: boolean) => {
      const sb = getSupabaseClient();
      if (!sb || !userId) return;
      const id = ++cycle.current;
      setSyncing(true);
      try {
        // Touch open entries first so the sync publishes a fresh updated_at
        // — the web treats stale open entries as offline.
        await api.touchActiveTimeEntries(userId).catch(() => {});
        const outcome = await runSync(sb, userId, { force });
        if (id !== cycle.current) return;

        // The cycle just wrote pulled rows into SQLite — refresh on-screen
        // caches so they don't show stale data until a remount.
        if (!outcome.offline) notifyDataPulled();

        setLastSyncAt(Date.now());
        if (outcome.ok) {
          failureCount.current = 0;
          setStatus("synced");
          setLastError(null);
        } else {
          failureCount.current += 1;
          if (outcome.offline) {
            setStatus("offline");
            setLastError(outcome.error ?? "You're offline.");
          } else {
            setStatus("error");
            setLastError(outcome.error ?? "Sync failed.");
          }
          scheduleRetry();
          maybeToast(outcome);
        }

        try {
          const pending = await api.getPendingSync(userId);
          if (id === cycle.current) {
            setPendingCount(
              pending.projects.length +
                pending.tasks.length +
                pending.time_entries.length,
            );
          }
        } catch {
          // Pending count is cosmetic — never fail the cycle for it.
        }
      } finally {
        if (id === cycle.current) setSyncing(false);
      }
    },
    [userId, scheduleRetry, maybeToast],
  );

  // Keep the backoff timer pointed at the latest cycle closure.
  useEffect(() => {
    runCycleRef.current = runCycle;
  }, [runCycle]);

  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      setPendingCount(0);
      setLastError(null);
      return;
    }
    failureCount.current = 0;
    clearBackoff();
    void runCycle(false);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void runCycle(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(() => void runCycle(false), SYNC_INTERVAL_MS);

    // Local mutations (timer start/stop, manual entries, quick-added tasks)
    // trigger a prompt debounced sync so the web stays close behind.
    const unsubscribe = onLocalMutation(() => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(
        () => void runCycle(false),
        MUTATION_DEBOUNCE_MS,
      );
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
      unsubscribe();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      clearBackoff();
    };
  }, [userId, runCycle, clearBackoff]);

  const retry = useCallback(() => {
    failureCount.current = 0;
    clearBackoff();
    void runCycle(true);
  }, [runCycle, clearBackoff]);

  const value: SyncContextValue = {
    status,
    pendingCount,
    lastSyncAt,
    lastError,
    syncing,
    retry,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (ctx === null) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}
