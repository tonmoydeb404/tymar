import { ManualEntrySheet } from "@/components/manual-entry-sheet";
import { ScreenHeader } from "@/components/screen-header";
import { useApp } from "@/context/app-context";
import { useProjects, useTasks, useTimeEntries } from "@/context/db/db-context";
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
        <section key={day} className="grid gap-1.5">
          <div className="flex items-baseline justify-between px-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <ul className="grid gap-1.5">
            {[0, 1, 2].map((row) => (
              <li
                key={row}
                className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5"
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
  const [manualOpen, setManualOpen] = useState(false);
  const { view } = useTimer();

  const userId = auth?.user?.id ?? null;
  const taskById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks],
  );
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
    return entries.filter((e) => {
      const t = new Date(e.startedAt).getTime();
      return t >= startMs && t < endMs;
    });
  }, [entries, timeZone]);

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
    <section className="mx-auto grid h-full w-full max-w-[420px] content-start gap-3 overflow-y-auto scrollbar-thin px-3.5 pt-4 pb-24">
      <ScreenHeader
        title="This week"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManualOpen(true)}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <Plus size={13} />
            Add manual
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
          <div className="grid gap-4">
            {days.map(({ day, entries: rows }) => {
              let dayWorkMs = 0;
              let dayBreakMs = 0;
              for (const e of rows) {
                const ms = entryDurationMs(e.startedAt, e.endedAt);
                if (e.type === "BREAK") dayBreakMs += ms;
                else dayWorkMs += ms;
              }
              return (
                <section key={day} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between px-1">
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                      {day}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {formatDurationShort(dayWorkMs)}
                      {dayBreakMs > 0 &&
                        ` + ${formatDurationShort(dayBreakMs)} break`}
                    </span>
                  </div>
                  <ul className="grid gap-1.5">
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
                          className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5"
                        >
                          <EntryTypeBadge
                            type={entry.type}
                            iconOnly
                            className="size-9 shrink-0 [&>svg]:size-[18px]!"
                          />
                          <div className="grid min-w-0 flex-1">
                            <span className="truncate text-xs font-medium text-ink">
                              {task?.title ?? "No task"}
                            </span>
                            <span className="truncate font-mono text-[10px] text-muted-foreground tabular-nums">
                              {project?.name ?? "No project"}
                              {" · "}
                              {formatTime(entry.startedAt)}
                              {" → "}
                              {entry.endedAt
                                ? formatTime(entry.endedAt)
                                : "open"}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] font-semibold text-ink tabular-nums">
                            {entry.endedAt
                              ? formatDuration(
                                  entryDurationMs(
                                    entry.startedAt,
                                    entry.endedAt,
                                  ),
                                )
                              : "open"}
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
