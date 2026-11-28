import { ManualEntrySheet } from "@/components/manual-entry-sheet";
import { ScreenHeader } from "@/components/screen-header";
import { useApp } from "@/context/app-context";
import {
  useProjects,
  useTasks,
  useTimeEntries,
  useWorkspaceEntries,
} from "@/context/db/db-context";
import { cn } from "@/lib/utils";
import { useTimer } from "@/context/timer-context";
import {
  currentWeekBounds,
  entryDurationMs,
  formatDuration,
  formatDurationShort,
  groupEntriesByStartDay,
  type TimeInterval,
} from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { DataState } from "@packages/ui/components/data-state";
import { EntryTypeBadge } from "@packages/ui/components/entry-type-badge";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// Mimics the shape of a day group + its entry rows so the loading state
// doesn't jump around once the real content lands.
function TimesLoadingSkeleton() {
  return (
    <div className="grid gap-4">
      {[0, 1].map((day) => (
        <section key={day} className="grid gap-2.5">
          <div className="flex items-baseline justify-between px-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <ul className="grid gap-1.5">
            {[0, 1, 2].map((row) => (
              <li
                key={row}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
              >
                <Skeleton className="aspect-square h-5 shrink-0 rounded-full" />
                <div className="grid min-w-0 flex-1 gap-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-40" />
                </div>
                <Skeleton className="h-3 w-10 shrink-0" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// Times tab: this week's sessions only (Mon–Sun), grouped by day. Editing
// existing entries lives on the web dashboard; this app can only add new
// manual entries.
export function TimesScreen() {
  const { auth } = useApp();
  const { projects } = useProjects();
  const { tasks, quickAdd } = useTasks();
  const { entries, timeZone, loading, error, reload, addManualEntry } =
    useTimeEntries();
  const workspaceEntries = useWorkspaceEntries();
  const [manualOpen, setManualOpen] = useState(false);
  const { view } = useTimer();

  const userId = auth?.user?.id ?? null;
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

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

  const weekEntries = useMemo(() => {
    const { startMs, endMs } = currentWeekBounds(timeZone);
    return workspaceEntries.filter((e) => {
      const t = new Date(e.startedAt).getTime();
      return t >= startMs && t < endMs;
    });
  }, [workspaceEntries, timeZone]);

  const { weekWorkMs, weekBreakMs } = useMemo(() => {
    let work = 0;
    let rest = 0;
    for (const e of weekEntries) {
      const ms = entryDurationMs(e.startedAt, e.endedAt);
      if (e.type === "BREAK") rest += ms;
      else work += ms;
    }
    return { weekWorkMs: work, weekBreakMs: rest };
  }, [weekEntries]);

  const groups = useMemo(
    () => groupEntriesByStartDay(weekEntries, timeZone),
    [weekEntries, timeZone],
  );

  function formatTime(iso: string): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return d.toISOString().slice(11, 16);
    }
  }

  async function handleQuickAdd(projectId: string, title: string) {
    return quickAdd(projectId, title);
  }

  return (
    <section className="mx-auto grid h-full w-full max-w-[420px] content-start gap-6 overflow-y-auto scrollbar-thin px-5 pt-5 pb-28">
      <ScreenHeader
        title="This week"
        subtitle={`${formatDurationShort(weekWorkMs)} worked${
          weekBreakMs > 0 ? ` · ${formatDurationShort(weekBreakMs)} break` : ""
        }`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManualOpen(true)}
            className="h-9 gap-1.5 rounded-xl px-3"
          >
            <Plus />
            Add entry
          </Button>
        }
      />

      <DataState
        loading={loading}
        error={error}
        data={groups}
        onRetry={() => void reload()}
        emptyTitle="No sessions this week"
        emptyHint="Start a timer or add a manual entry to see it here."
        loadingComponent={<TimesLoadingSkeleton />}
      >
        {(days) => (
          <div className="grid gap-6">
            {days.map(({ day, entries: rows }) => {
              let dayWorkMs = 0;
              let dayBreakMs = 0;
              for (const e of rows) {
                const ms = entryDurationMs(e.startedAt, e.endedAt);
                if (e.type === "BREAK") dayBreakMs += ms;
                else dayWorkMs += ms;
              }
              return (
                <section key={day} className="grid gap-2.5">
                  <div className="flex items-baseline justify-between px-1">
                    <span className="text-sm font-semibold text-foreground">
                      {day}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {formatDurationShort(dayWorkMs)}
                      {dayBreakMs > 0 &&
                        ` + ${formatDurationShort(dayBreakMs)} break`}
                    </span>
                  </div>
                  <ul className="grid gap-2">
                    {rows.map((entry) => {
                      const task = entry.taskId
                        ? taskById.get(entry.taskId)
                        : undefined;
                      const project = entry.projectId
                        ? projectById.get(entry.projectId)
                        : task
                          ? projectById.get(task.projectId)
                          : undefined;
                      return (
                        <li
                          key={entry.id}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
                        >
                          <EntryTypeBadge
                            type={entry.type}
                            iconOnly
                            className="size-9 shrink-0 [&>svg]:size-[18px]!"
                          />
                          <div className="grid min-w-0 flex-1">
                            <span className="truncate text-sm font-medium text-foreground">
                              {task?.title ?? project?.name ?? "No task"}
                            </span>
                            <span className="truncate font-mono text-[10px] text-muted-foreground tabular-nums">
                              {task && project ? `${project.name} · ` : ""}
                              {formatTime(entry.startedAt)}
                              {" → "}
                              {entry.endedAt
                                ? formatTime(entry.endedAt)
                                : "open"}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 font-mono text-xs font-semibold tabular-nums",
                              entry.endedAt
                                ? "text-foreground"
                                : "text-primary",
                            )}
                          >
                            {entry.endedAt
                              ? formatDuration(
                                  entryDurationMs(
                                    entry.startedAt,
                                    entry.endedAt,
                                  ),
                                )
                              : "Running"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </DataState>

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
