"use client";

import { useRef } from "react";
import { WorkPerDayChart } from "@/components/charts/work-per-day-chart";
import { useDayTotals } from "@/lib/use-day-totals";
import { TimeHeaderSection } from "./sections/time-header-section";
import {
  TimeListSection,
  type TimeListSectionHandle,
} from "./sections/time-list-section";
import { useTimeDayGroups } from "./use-time-day-groups";

export function TimeView() {
  const listRef = useRef<TimeListSectionHandle>(null);
  const timeDayGroups = useTimeDayGroups();
  const { range, setRange, timeZone } = timeDayGroups;
  const {
    data: dayTotals,
    loading: chartLoading,
    error: chartError,
    reload: reloadChart,
  } = useDayTotals(timeZone, range);

  return (
    <div className="grid gap-6">
      <TimeHeaderSection
        range={range}
        onRangeChange={setRange}
        timeZone={timeZone}
        onNew={() => listRef.current?.openCreate()}
      />
      <WorkPerDayChart
        data={dayTotals}
        loading={chartLoading}
        error={chartError}
        onRetry={reloadChart}
      />
      <TimeListSection ref={listRef} {...timeDayGroups} />
    </div>
  );
}
