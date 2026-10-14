"use client";

import { cn } from "@/lib/utils";
import type { TimeEntryWithDetails } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { ENTRY_TYPE_REGISTRY } from "@packages/ui/lib/entry-type";
import type { TimeGroupSummary } from "../use-time-day-groups";

// ─── row model ───────────────────────────────────────────────────────────────

type TerminalNode = { kind: "end"; time: string };
type EntryNode = {
  kind: "start" | "switch";
  time: string;
  entry: TimeEntryWithDetails;
  durationMs: number;
};
type TimelineNode = TerminalNode | EntryNode;

type TimelineRow =
  | { _tag: "node"; data: TimelineNode }
  | { _tag: "gap" };

function buildRows(entries: TimeEntryWithDetails[]): TimelineRow[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  const rows: TimelineRow[] = [];
  let needEndNode = true;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!;
    const next = sorted[i + 1];
    const endTime = entry.endedAt ?? new Date().toISOString();
    const durationMs = Math.max(
      0,
      new Date(endTime).getTime() - new Date(entry.startedAt).getTime(),
    );

    if (needEndNode) {
      rows.push({ _tag: "node", data: { kind: "end", time: endTime } });
    }

    const entryNode = (kind: "start" | "switch"): TimelineRow => ({
      _tag: "node",
      data: { kind, time: entry.startedAt, entry, durationMs },
    });

    if (next) {
      const nextEnd = next.endedAt ?? new Date().toISOString();
      const adjacent =
        Math.abs(
          new Date(entry.startedAt).getTime() - new Date(nextEnd).getTime(),
        ) < 60_000;
      if (adjacent) {
        rows.push(entryNode("switch"));
        needEndNode = false;
      } else {
        rows.push(entryNode("start"));
        rows.push({ _tag: "gap" });
        needEndNode = true;
      }
    } else {
      rows.push(entryNode("start"));
    }
  }

  return rows;
}

function splitGroups(rows: TimelineRow[]): TimelineNode[][] {
  const groups: TimelineNode[][] = [];
  let current: TimelineNode[] = [];
  for (const row of rows) {
    if (row._tag === "gap") {
      if (current.length) groups.push(current);
      current = [];
    } else {
      current.push(row.data);
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return "< 1m";
  const totalMinutes = Math.floor(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDayLabel(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  const d = new Date(year!, month! - 1, day!, 12, 0, 0);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// ─── connected group ─────────────────────────────────────────────────────────

function ConnectedGroup({
  nodes,
  timeZone,
}: {
  nodes: TimelineNode[];
  timeZone: string;
}) {
  return (
    <div>
      {nodes.map((node, ri) => {
        const isLast = ri === nodes.length - 1;

        /* ── end terminal ── */
        if (node.kind === "end") {
          return (
            <div key={ri} className="flex gap-4">
              {/* left col — self-stretch so flex-1 line has a height to fill */}
              <div className="flex w-8 shrink-0 flex-col items-center self-stretch">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-destructive/60 bg-destructive/10 text-destructive">
                  <div className="h-2 w-2 rounded-full bg-destructive/60" />
                </div>
                {!isLast && <div className="w-px flex-1 bg-border" />}
              </div>
              {/* right col */}
              <div className="flex-1 pb-6 pt-2 flex items-center justify-between gap-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-destructive/60">
                  end
                </span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                  {formatTime(node.time, timeZone)}
                </span>
              </div>
            </div>
          );
        }

        /* ── entry node (start / switch) ── */
        const { icon: Icon } = ENTRY_TYPE_REGISTRY[node.entry.type];
        const isWork = node.entry.type === "WORK";
        const title =
          node.entry.taskTitle ?? node.entry.projectName ?? "Untitled";
        const subtitle =
          node.entry.taskTitle && node.entry.projectName
            ? node.entry.projectName
            : undefined;

        return (
          <div key={ri} className="flex gap-4">
            {/* left col — self-stretch so flex-1 line has a height to fill */}
            <div className="flex w-8 shrink-0 flex-col items-center self-stretch">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                  isWork
                    ? "border-primary text-primary"
                    : "border-amber-500 text-amber-500",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border" />}
            </div>

            {/* right col */}
            <div className="flex-1 pb-6">
              <div className="flex items-start justify-between gap-4 pt-1">
                <p className="text-sm font-medium leading-tight">{title}</p>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatTime(node.time, timeZone)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                {subtitle && <span>{subtitle}</span>}
                {subtitle && <span>·</span>}
                <span>{formatDuration(node.durationMs)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── day group ────────────────────────────────────────────────────────────────

function DayGroup({ group, timeZone }: { group: TimeGroupSummary; timeZone: string }) {
  const groups = splitGroups(buildRows(group.entries));

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-medium">{formatDayLabel(group.day)}</span>
        <span className="text-xs text-muted-foreground">
          {formatDuration(group.workMs)} work
          {group.breakMs > 0 && ` · ${formatDuration(group.breakMs)} break`}
        </span>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3">
        {groups.map((nodes, gi) => (
          <ConnectedGroup key={gi} nodes={nodes} timeZone={timeZone} />
        ))}
      </div>
    </div>
  );
}

// ─── loading / empty ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-card" />
      ))}
    </div>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────

type Props = {
  groups: TimeGroupSummary[];
  timeZone: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function TimeTimelineView({ groups, timeZone, loading, error, onRetry }: Props) {
  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card py-16">
        <p className="text-sm text-muted-foreground">No entries found.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <DayGroup key={group.day} group={group} timeZone={timeZone} />
      ))}
    </div>
  );
}
