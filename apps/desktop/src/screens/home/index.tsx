import { ManualEntrySheet } from "@/components/manual-entry-sheet";
import { StartSessionSheet } from "@/components/start-session-sheet";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { WorkspaceSelect } from "@/components/selectors/workspace-select";
import { useApp } from "@/context/app-context";
import { useProjects, useTasks, useTimeEntries, useWorkspaces } from "@/context/db/db-context";
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
    Play,
    Plus,
    Square,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function StatCard({
  label,
  icon,
  value,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  hint: string;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        {icon}
      </div>
      <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
        {value}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">{hint}</span>
    </div>
  );
}

// Home tab: live timer, today + week stats, today's sessions. Starting a
// timer or adding a manual entry opens a sheet where a project is required
// and a task is optional — projects are managed on the web dashboard, tasks
// can be quick-added here once a project is picked.
export function HomeScreen() {
  const { auth } = useApp();
  const { activeWorkspaces, activeWorkspaceId, setActiveWorkspaceId } =
    useWorkspaces();
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
  const onBreak = status === "BREAK";
  const hasWorkspace = activeWorkspaceId !== null;
  const noWorkspaces = activeWorkspaces.length === 0;

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
  const isSwitching = startOpen && running;
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

  const statusLabel = isSwitching
    ? "Switching task"
    : status === "WORKING"
      ? "Logging time"
      : status === "BREAK"
        ? "On break"
        : "Ready";

  return (
    <section className="mx-auto grid h-full w-full max-w-[420px] content-start gap-6 overflow-y-auto scrollbar-thin px-5 pt-5 pb-28">
      {/* Workspace scope on the left, live sync state on the right */}
      <div className="flex items-center justify-between gap-3">
        {hasWorkspace ? (
          <WorkspaceSelect
            value={activeWorkspaceId}
            onValueChange={setActiveWorkspaceId}
            className="max-w-[58%] min-w-0 flex-1"
          />
        ) : (
          <span />
        )}
        <SyncStatusPill />
      </div>

      {/* Hero timer */}
      <section
        className={cn(
          "grid gap-6 rounded-3xl border p-6 transition-colors",
          onBreak
            ? "border-amber-500/30 bg-amber-500/5"
            : running
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-card",
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              status === "WORKING" && "animate-pulse bg-primary",
              status === "BREAK" && "bg-amber-500",
              status === "IDLE" && "bg-muted-foreground/40",
            )}
            aria-hidden
          />
          <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {statusLabel}
          </span>
        </div>

        <div className="grid gap-2">
          <span
            className="font-mono text-[56px] leading-none font-semibold tracking-tight tabular-nums text-ink"
            aria-live="off"
          >
            {formatDuration(totalMs)}
          </span>
          <p className="min-h-10 text-sm leading-snug text-muted-foreground">
            {running ? (
              <>
                <span className="line-clamp-2 font-medium text-ink">
                  {runningTaskTitle ?? runningProjectTitle ?? "Untitled session"}
                </span>
                {runningTaskTitle && runningProjectTitle && (
                  <span className="block truncate text-xs">
                    {runningProjectTitle}
                  </span>
                )}
              </>
            ) : (
              noWorkspaces
                ? "Create a workspace on the web dashboard to start tracking."
                : "Pick a project and start tracking."
            )}
          </p>
        </div>

        <div className="grid gap-3">
          <Button
            size="lg"
            variant={running ? "outline" : "default"}
            onClick={handleToggle}
            disabled={busy || (!running && !hasWorkspace)}
            className="h-12 w-full rounded-2xl text-sm font-semibold"
          >
            {running ? (
              <>
                <Square className="fill-current" />
                Stop
              </>
            ) : (
              <>
                <Play className="fill-current" />
                Start timer
              </>
            )}
          </Button>

          {running && (
            <div className="grid grid-cols-2 gap-3">
              {onBreak ? (
                <Button
                  onClick={() => void resume()}
                  disabled={busy}
                  variant="secondary"
                  className="h-10 rounded-xl"
                >
                  <Play className="fill-current" />
                  Resume
                </Button>
              ) : (
                <Button
                  onClick={() => void takeBreak()}
                  disabled={busy}
                  variant="secondary"
                  className="h-10 rounded-xl"
                >
                  <Coffee />
                  Break
                </Button>
              )}
              <Button
                onClick={() => setStartOpen(true)}
                disabled={busy}
                variant="outline"
                className="h-10 rounded-xl"
              >
                <ArrowLeftRight />
                Switch
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Extra open entries (e.g. started elsewhere while this device was
          offline) — view-only. */}
      {others.length > 0 && (
        <section className="grid gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Also running ({others.length})
          </span>
          <ul className="grid gap-2">
            {others.map((entry) => {
              const task = entry.taskId ? taskById.get(entry.taskId) : undefined;
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
                  className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"
                >
                  <EntryTypeBadge
                    type={entry.type}
                    iconOnly
                    className="size-8 shrink-0 [&>svg]:size-4!"
                  />
                  <div className="grid min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs font-medium break-words text-ink">
                      {task?.title ?? project?.name ?? "Untitled session"}
                    </span>
                    <span className="truncate font-mono text-[10px] text-muted-foreground tabular-nums">
                      {project?.name ? `${project.name} · ` : ""}
                      {formatDuration(elapsed)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Summaries */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Today"
          icon={<Clock className="size-4 text-primary" />}
          value={formatDurationShort(workMs)}
          hint={
            breakMs > 0
              ? `${formatDurationShort(breakMs)} break`
              : "No breaks yet"
          }
        />
        <StatCard
          label="This week"
          icon={<CalendarDays className="size-4 text-chart-4" />}
          value={formatDurationShort(weekWorkMs)}
          hint={
            weekBreakMs > 0
              ? `${formatDurationShort(weekBreakMs)} break`
              : "No breaks yet"
          }
        />
      </div>

      <Button
        variant="ghost"
        onClick={() => setManualOpen(true)}
        disabled={!hasWorkspace}
        className="h-10 rounded-xl text-muted-foreground"
      >
        <Plus />
        Add manual entry
      </Button>

      <StartSessionSheet
        open={startOpen}
        onOpenChange={setStartOpen}
        title={running ? "Switch task" : "Start timer"}
        submitLabel={running ? "Switch" : "Start"}
        busy={busy}
        onQuickAdd={handleQuickAdd}
        onSubmit={async ({ projectId, taskId, openedAt }) => {
          if (running) {
            await switchTo(taskId, projectId, openedAt);
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
