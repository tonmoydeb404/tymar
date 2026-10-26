import { useSync, type SyncStatus } from "@/context/sync-context";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

function relative(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const STATUS_STYLE: Record<SyncStatus, { dot: string; text: string }> = {
  idle: { dot: "bg-slate-400", text: "text-muted-foreground" },
  synced: { dot: "bg-emerald-500", text: "text-muted-foreground" },
  offline: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  error: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
};

/** Compact sync-health indicator for the Home header: shows the last cycle
 * outcome, pending changes, and offers a manual retry on trouble. Tap-to-
 * retry ignores the per-row failure cap. */
export function SyncStatusPill() {
  const { status, pendingCount, lastSyncAt, lastError, syncing, retry } =
    useSync();
  // Re-render periodically so "2m ago" stays honest.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const style = STATUS_STYLE[status];
  const trouble = status === "error" || status === "offline";

  let label: string;
  if (syncing) {
    label = "Syncing…";
  } else if (status === "idle") {
    label = "Not syncing";
  } else if (status === "synced") {
    label = lastSyncAt ? `Synced ${relative(lastSyncAt)}` : "Synced";
  } else if (status === "offline") {
    label = "Offline";
  } else {
    label = "Sync failed";
  }

  const hint =
    status === "error" && lastError
      ? lastError
      : status === "offline"
        ? "Changes are saved locally and will sync when you reconnect."
        : pendingCount > 0
          ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync.`
          : lastSyncAt
            ? `Last synced ${relative(lastSyncAt)}.`
            : undefined;

  return (
    <button
      type="button"
      onClick={() => {
        if (!syncing) retry();
      }}
      disabled={syncing}
      title={hint}
      aria-label={`Sync status: ${label}. Click to retry.`}
      className={cn(
        "flex w-fit items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide transition-colors",
        "not-disabled:cursor-pointer not-disabled:hover:bg-muted",
        style.text,
      )}
    >
      {syncing ? (
        <Loader2 size={10} className="shrink-0 animate-spin" />
      ) : (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", style.dot)}
          aria-hidden
        />
      )}
      <span className="whitespace-nowrap">{label}</span>
      {pendingCount > 0 && !syncing && (
        <span className="whitespace-nowrap">· {pendingCount}</span>
      )}
      {trouble && !syncing && (
        <RefreshCw size={10} className="shrink-0" aria-hidden />
      )}
    </button>
  );
}
