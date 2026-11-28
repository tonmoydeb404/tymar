"use client";

import { useRef } from "react";
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

  return (
    <div className="grid gap-6">
      <TimeHeaderSection
        range={range}
        onRangeChange={setRange}
        timeZone={timeZone}
        onNew={() => listRef.current?.openCreate()}
      />
      <TimeListSection ref={listRef} {...timeDayGroups} />
    </div>
  );
}
