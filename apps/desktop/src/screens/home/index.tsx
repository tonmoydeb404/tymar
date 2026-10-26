import { ManualEntrySheet } from "@/components/manual-entry-sheet";
import { StartSessionSheet } from "@/components/start-session-sheet";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { useApp } from "@/context/app-context";
import { useProjects, useTasks, useTimeEntries } from "@/context/db/db-context";
import { useTimer } from "@/context/timer-context";
import { onOpenSwitcher } from "@/lib/api";
import { consumeActionFailure } from "@/lib/pending-notice";
import { cn } from "@/lib/utils";
import {
    aggregateDayTotals,
    currentWeekBounds,
    dayKey,
    formatDuration,
    formatDurationShort,
    type TimeInterval,
} from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { EntryTypeBadge } from "@packages/ui/components/entry-type-badge";
import {
    ArrowLeftRight,
    CalendarDays,
    Clock,
    Coffee,
    NotebookPen,
    Pause,
    Play,
    Plus,
    RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// Home tab: live timer, today + week stats, today's sessions. Starting a
// timer or adding a manual entry opens a sheet where a project is required
// and a task is optional — projects are managed on the web dashboard, tasks
// can be quick-added here once a project is picked.
export function HomeScreen() {
  const { auth } = useApp();
  const { projects } = useProjects();
  const { tasks, quickAdd } = useTasks();
  const { entries, timeZone, addManualEntry } = useTimeEntries();
  const {
    view,
    busy,
    elapsedMsBase,
    fetchedAt,
    start,
    takeBreak,
    resume,
    stop,
    switchTo,
    others,
    checkFailed,
    connection,
    takeOver,
    recheck,
  } = useTimer();
  const [, setTick] = useState(0);
  const [startOpen, setStartOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [weekWorkMs, setWeekWorkMs] = useState(0);
  const [weekBreakMs, setWeekBreakMs] = useState(0);
  const [todayWorkMs, setTodayWorkMs] = useState(0);
  const [todayBreakMs, setTodayBreakMs] = useState(0);

  const userId = auth?.user?.id ?? null;
  const status = view?.status ?? "IDLE";
  const running = status !== "IDLE";
  const toggleOn = status !== "IDLE";
  const onBreak = status === "BREAK";

  // Existing entries + the running timer (if any) — the manual entry sheet
  // rejects anything that would overlap one of these.
  const conflicts = useMemo<TimeInterval[]>(() => {
    const list: TimeInterval[] = entries.map((e) => ({
      startedAt: e.startedAt,
      endedAt: e.endedAt,
    }));
    if (view?.started_at_ms) {
      list.push({
        startedAt: new Date(view.started_at_ms).toISOString(),
        endedAt: null,
      });
    }
    return list;
  }, [entries, view?.started_at_ms]);

  useEffect(() => {
    if (!running && others.length === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running, others.length]);

  // Surface timer-action failures that fired while the window was hidden
  // (e.g. a tray Stop click) — their toasts were never seen.
  useEffect(() => {
    const show = () => {
      const message = consumeActionFailure();
      if (message) toast.error(message);
    };
    show();
    document.addEventListener("visibilitychange", show);
    return () => document.removeEventListener("visibilitychange", show);
  }, []);

  // Tray "Switch Task" opens this screen's start/switch sheet.
  useEffect(() => {
    const unlisten = onOpenSwitcher(() => setStartOpen(true));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const { startMs, endMs } = currentWeekBounds(timeZone);
    const inWeek = entries.filter((e) => {
      const t = new Date(e.startedAt).getTime();
      return t >= startMs && t < endMs;
    });
    const perDay = aggregateDayTotals(inWeek, timeZone);
    setWeekWorkMs(perDay.reduce((sum, d) => sum + d.workMs, 0));
    setWeekBreakMs(perDay.reduce((sum, d) => sum + d.breakMs, 0));
    const today = perDay.find((d) => d.day === dayKey(Date.now(), timeZone));
    setTodayWorkMs(today?.workMs ?? 0);
    setTodayBreakMs(today?.breakMs ?? 0);
  }, [entries, timeZone]);

  // Live elapsed of the open entry, anchored at fetch time (clock-skew safe).
  const elapsed = running
    ? Math.max(0, elapsedMsBase + Date.now() - fetchedAt)
    : 0;
  const openIsWork = running && view.kind === "WORK";
  const openIsBreak = running && view.kind === "BREAK";
  const totalMs = elapsed;
  const workMs = todayWorkMs + (openIsWork ? elapsed : 0);
  const breakMs = todayBreakMs + (openIsBreak ? elapsed : 0);

  const taskById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks],
  );
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const runningTaskTitle =
    view?.task_title ??
    (view?.task_id ? (taskById.get(view.task_id)?.title ?? null) : null);
  const runningProjectTitle =
    view?.project_title ??
    (view?.project_id
      ? (projectById.get(view.project_id)?.name ?? null)
      : null);

  function handleToggle() {
    if (busy) return;
    if (status === "IDLE") setStartOpen(true);
    else void stop();
  }

  async function handleQuickAdd(projectId: string, title: string) {
    return quickAdd(projectId, title);
  }

  return (
    <section className="mx-auto grid h-full w-full max-w-[420px] gap-4 overflow-y-auto scrollbar-thin px-3.5 pt-4 pb-24">
      {/* Sync health + realtime connection */}
      <div className="flex items-center justify-between gap-2">
        <SyncStatusPill />
        {connection === "reconnecting" && (
          <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Reconnecting…
          </span>
        )}
      </div>

      {/* Timer card */}
      <section className="grid gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-1">
          <NotebookPen size={16} className="shrink-0 text-muted-foreground" />
          <span className="line-clamp-2 min-w-0 flex-1 break-words py-0.5 text-xs font-medium text-ink">
            {runningTaskTitle ??
              runningProjectTitle ??
              (running ? "Untitled session" : "No active session")}
          </span>
          {running && runningTaskTitle && runningProjectTitle && (
            <span className="max-w-[45%] shrink-0 truncate font-mono text-[10px] font-medium text-muted-foreground">
              {runningProjectTitle}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="grid">
            <span className="font-mono text-[38px] leading-none font-bold tracking-tight tabular-nums text-ink">
              {formatDuration(totalMs)}
            </span>

            {(() => {
              const isSwitching = startOpen && running;
              const cfg = isSwitching
                ? { Icon: ArrowLeftRight, cls: "text-primary", label: "Switching task" }
                : status === "WORKING"
                  ? { Icon: Play,   cls: "text-emerald-600 dark:text-emerald-400 fill-current animate-pulse", label: "Logging time" }
                  : status === "BREAK"
                    ? { Icon: Coffee, cls: "text-amber-600 dark:text-amber-400 fill-current", label: "On break" }
                    : { Icon: Clock,  cls: "text-muted-foreground", label: "Ready" };
              return (
                <span className="mt-2 flex items-center gap-1.5">
                  <cfg.Icon size={12} className={cfg.cls} />
                  <span className={cn("font-mono text-[10px] font-semibold tracking-wider uppercase", cfg.cls)}>
                    {cfg.label}
                  </span>
                </span>
              );
            })()}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggle}
              disabled={busy}
              title={status === "IDLE" ? "Start a timer" : "Stop timer"}
              aria-label={toggleOn ? "Stop timer" : "Start timer"}
              className={cn(
                "flex h-9 w-16 items-center rounded-full px-1 shadow-inner transition-colors",
                toggleOn
                  ? onBreak
                    ? "bg-amber-500"
                    : "bg-emerald-600"
                  : "bg-slate-300 dark:bg-slate-700",
                "not-disabled:cursor-pointer disabled:opacity-70",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md transition-transform",
                  toggleOn ? "translate-x-7" : "translate-x-0",
                )}
              >
                {toggleOn ? (
                  <Pause
                    size={18}
                    className={cn(
                      "font-bold",
                      onBreak ? "text-amber-700" : "text-emerald-700",
                    )}
                  />
                ) : (
                  <Play size={18} className="text-slate-500" />
                )}
              </span>
            </button>
            <span
              className={cn(
                "font-mono text-[11px] font-bold tracking-wide uppercase",
                status === "WORKING" &&
                  "text-emerald-700 dark:text-emerald-400",
                status === "BREAK" && "text-amber-700 dark:text-amber-400",
                status === "IDLE" && "text-muted-foreground",
              )}
            >
              {toggleOn ? "On" : "Off"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
          {onBreak ? (
            <Button
              onClick={() => void resume()}
              disabled={busy}
              variant="default"
            >
              <Play size={16} />
              Resume
            </Button>
          ) : (
            <Button
              onClick={() => void takeBreak()}
              disabled={busy || !running}
              variant="secondary"
            >
              <Coffee size={16} />
              Break
            </Button>
          )}
          <Button
            onClick={() => setStartOpen(true)}
            disabled={busy || !running}
            variant="outline"
          >
            <ArrowLeftRight size={16} />
            Switch
          </Button>
        </div>
      </section>

      {/* Timers running elsewhere (started on web / another device) —
          display-only: take one over explicitly, nothing auto-adopts. */}
      {(others.length > 0 || checkFailed) && (
        <section className="grid gap-2 rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {others.length > 0
                ? `Already running (${others.length})`
                : "Running timers"}
            </span>
            {checkFailed && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={recheck}
                disabled={busy}
              >
                <RefreshCw size={10} />
                Retry
              </Button>
            )}
          </div>
          {checkFailed && (
            <p className="text-xs text-muted-foreground">
              Couldn&apos;t check for timers running on other devices.
            </p>
          )}
          {others.length > 0 && (
            <ul className="grid gap-1.5">
              {others.map((entry) => {
                const task = entry.taskId
                  ? taskById.get(entry.taskId)
                  : undefined;
                const project = entry.projectId
                  ? projectById.get(entry.projectId)
                  : task
                    ? projectById.get(task.projectId)
                    : undefined;
                const startMs = new Date(entry.startedAt).getTime();
                const elapsed = Number.isFinite(startMs)
                  ? Math.max(0, Date.now() - startMs)
                  : 0;
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5"
                  >
                    <EntryTypeBadge
                      type={entry.type}
                      iconOnly
                      className="size-8 shrink-0 [&>svg]:size-4!"
                    />
                    <div className="grid min-w-0 flex-1">
                      <span className="line-clamp-2 break-words text-xs font-medium text-ink">
                        {task?.title ?? project?.name ?? "Untitled session"}
                      </span>
                      <span className="truncate font-mono text-[10px] text-muted-foreground tabular-nums">
                        {project?.name ? `${project.name} · ` : ""}
                        {formatDuration(elapsed)} running
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-[11px]"
                      disabled={busy || running}
                      title={
                        running
                          ? "Stop the timer on this device first."
                          : undefined
                      }
                      onClick={() => void takeOver(entry.id)}
                    >
                      Take over
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Summaries */}

      <div className="flex flex-col rounded-xl border border-border bg-card p-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Today
          </span>
          <Clock size={16} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <span className="font-mono text-xl font-bold tabular-nums text-ink">
            {formatDurationShort(workMs)}
          </span>
        </div>
        <div className="mt-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {breakMs > 0
              ? `${formatDurationShort(breakMs)} rest taken`
              : "No time logged yet"}
          </span>
        </div>
      </div>
      <div className="flex flex-col rounded-xl border border-border bg-card p-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            This week
          </span>
          <CalendarDays
            size={16}
            className="text-blue-600 dark:text-blue-400"
          />
        </div>
        <div>
          <span className="font-mono text-xl font-bold tabular-nums text-ink">
            {formatDurationShort(weekWorkMs)}
          </span>
        </div>
        <div className="mt-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {weekWorkMs > 0 || weekBreakMs > 0
              ? `${formatDurationShort(weekBreakMs)} rest this week`
              : "No time this week yet"}
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={() => setManualOpen(true)}
        className=""
      >
        <Plus size={13} />
        Add manual entry
      </Button>

      <StartSessionSheet
        open={startOpen}
        onOpenChange={setStartOpen}
        title={running ? "Switch task" : "Start timer"}
        submitLabel={running ? "Switch" : "Start"}
        busy={busy}
        onQuickAdd={handleQuickAdd}
        onSubmit={async ({ projectId, taskId }) => {
          if (running) {
            await switchTo(taskId, projectId);
          } else {
            await start(taskId, projectId);
          }
        }}
      />

      <ManualEntrySheet
        open={manualOpen}
        onOpenChange={setManualOpen}
        busy={false}
        onQuickAdd={handleQuickAdd}
        conflicts={conflicts}
        onSubmit={async ({ projectId, taskId, type, startedAt, endedAt }) => {
          if (!userId) {
            toast.error("Sign in to add a manual entry.");
            return;
          }
          try {
            await addManualEntry({
              taskId,
              projectId,
              type,
              startedAt,
              endedAt,
            });
            toast.success("Manual entry added.");
          } catch (err) {
            toast.error("Failed to add entry", {
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }}
      />
    </section>
  );
}
