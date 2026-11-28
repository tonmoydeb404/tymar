import { appPaths } from "@/config/paths-config";
import {
  entryDurationMs,
  formatDuration,
  type TimeEntryWithDetails,
} from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/card";
import { DataState } from "@packages/ui/components/data-state";
import { EntryTypeBadge } from "@packages/ui/components/entry-type-badge";
import { Skeleton } from "@packages/ui/components/skeleton";
import Link from "next/link";

type Props = {
  entries: TimeEntryWithDetails[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

function when(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The latest sessions in the range, newest first. */
export function RecentSessionsSection({
  entries,
  loading,
  error,
  onRetry,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent sessions</CardTitle>
        <CardDescription>Your latest entries in this range.</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={appPaths.time} />}
          >
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataState
          loading={loading}
          error={error}
          data={entries}
          onRetry={onRetry}
          emptyTitle="No sessions yet"
          emptyHint="Entries you track will show up here."
          loadingComponent={<Skeleton className="h-48 w-full" />}
        >
          {(rows) => (
            <ul className="grid gap-1">
              {rows.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/50"
                >
                  <EntryTypeBadge
                    type={e.type}
                    iconOnly
                    className="size-8 shrink-0 [&>svg]:size-4"
                  />
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">
                      {e.taskTitle ?? e.projectName ?? "No task"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {e.taskTitle && e.projectName
                        ? `${e.projectName} · `
                        : ""}
                      {when(e.startedAt)}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
                    {e.endedAt
                      ? formatDuration(entryDurationMs(e.startedAt, e.endedAt))
                      : "Running"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
