import { useAuth } from "@/lib/auth-context";
import { useDayTotals } from "@/lib/use-day-totals";
import { WorkPerDayChart } from "@/components/charts/work-per-day-chart";
import { GreetingSection } from "./sections/greeting-section";
import { TimeStatsSection } from "./sections/time-stats-section";
import { useTimeStats } from "./use-time-stats";

export function DashboardHomeView() {
  const { user } = useAuth();
  const { range, setRange, timeZone, stats, loading, error, reload } =
    useTimeStats();
  const {
    data: dayTotals,
    loading: chartLoading,
    error: chartError,
    reload: reloadChart,
  } = useDayTotals(timeZone, range);

  return (
    <div className="grid gap-6">
      <GreetingSection name={user?.user_metadata?.full_name ?? user?.email} range={range} onRangeChange={setRange} />

      <TimeStatsSection
        stats={stats}
        loading={loading}
        error={error}
        onRetry={reload}
      />

      <WorkPerDayChart
        data={dayTotals}
        loading={chartLoading}
        error={chartError}
        onRetry={reloadChart}
      />
    </div>
  );
}

