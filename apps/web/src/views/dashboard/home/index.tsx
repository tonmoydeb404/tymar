import { WorkPerDayChart } from "@/components/charts/work-per-day-chart";
import { useAuth } from "@/lib/auth-context";
import { useDayTotals } from "@/lib/use-day-totals";
import { GreetingSection } from "./sections/greeting-section";
import { ProjectBreakdownSection } from "./sections/project-breakdown-section";
import { RecentSessionsSection } from "./sections/recent-sessions-section";
import { TimeStatsSection } from "./sections/time-stats-section";
import { useOverviewEntries } from "./use-overview-entries";
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
  const entries = useOverviewEntries(timeZone, range);

  const activeDays = dayTotals.filter((d) => d.workMs > 0).length;

  return (
    <>
      <GreetingSection
        name={user?.user_metadata?.full_name ?? user?.email}
        range={range}
        onRangeChange={setRange}
      />

      <TimeStatsSection
        stats={stats}
        activeDays={activeDays}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <ProjectBreakdownSection
          data={entries.byProject}
          loading={entries.loading}
          error={entries.error}
          onRetry={entries.reload}
        />
        <RecentSessionsSection
          entries={entries.recent}
          loading={entries.loading}
          error={entries.error}
          onRetry={entries.reload}
        />
      </div>
    </>
  );
}
