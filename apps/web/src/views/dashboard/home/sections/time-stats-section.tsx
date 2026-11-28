import type { TimeStats } from "@/lib/db";
import { formatDuration, formatDurationShort } from "@packages/domain/index";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/card";
import { DataState } from "@packages/ui/components/data-state";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Briefcase, Coffee, ListChecks, TrendingUp } from "lucide-react";

type Props = {
  stats: TimeStats | null;
  /** Number of days in the range that have any work (for the daily average). */
  activeDays: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center justify-between">
          {label}
          <Icon className="size-4 text-muted-foreground" />
        </CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function TimeStatsSection({
  stats,
  activeDays,
  loading,
  error,
  onRetry,
}: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <DataState
        loading={loading}
        error={error}
        data={stats ? [stats] : []}
        onRetry={onRetry}
        emptyTitle="No tracked time in this range"
        loadingComponent={(i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        )}
        skeletonCount={4}
      >
        {([s]) => {
          if (!s) return null;
          const avg = activeDays > 0 ? s.workedMs / activeDays : 0;
          return (
            <>
              <StatCard
                label="Worked"
                value={formatDurationShort(s.workedMs)}
                hint={formatDuration(s.workedMs)}
                icon={Briefcase}
              />
              <StatCard
                label="Daily average"
                value={formatDurationShort(avg)}
                hint={
                  activeDays > 0
                    ? `Across ${activeDays} active day${activeDays === 1 ? "" : "s"}`
                    : "No active days yet"
                }
                icon={TrendingUp}
              />
              <StatCard
                label="Breaks"
                value={formatDurationShort(s.breakMs)}
                hint={formatDuration(s.breakMs)}
                icon={Coffee}
              />
              <StatCard
                label="Sessions"
                value={String(s.entryCount)}
                hint="Closed entries in range"
                icon={ListChecks}
              />
            </>
          );
        }}
      </DataState>
    </div>
  );
}
