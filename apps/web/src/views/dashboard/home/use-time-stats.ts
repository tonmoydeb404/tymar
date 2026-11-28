"use client";

import { useWorkspaceScope } from "@/contexts/app/app-context";
import { useAuth } from "@/lib/auth-context";
import { getTimeStats, type TimeStats } from "@/lib/db";
import { useAsyncAction } from "@/lib/use-async-action";
import { useQueryParams } from "@/lib/use-query-params";
import { useTimeZone } from "@/lib/use-time-zone";
import { defaultRange, rangeInstants } from "@/lib/range";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Worked/break stats for a user-selected date range, queried server-side. */
export function useTimeStats() {
  const { user } = useAuth();
  const { projectIds } = useWorkspaceScope();
  const { get, set } = useQueryParams();
  const timeZone = useTimeZone();
  const [stats, setStats] = useState<TimeStats | null>(null);

  const fallback = useMemo(() => defaultRange(timeZone), [timeZone]);
  const range = useMemo(
    () => ({
      from: get("from") ?? fallback.from,
      to: get("to") ?? fallback.to,
    }),
    [get, fallback],
  );
  const setRange = useCallback(
    (next: { from?: string; to?: string }) =>
      set({ from: next.from, to: next.to }),
    [set],
  );

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!user || !projectIds) return;
      const result = await getTimeStats(
        user.id,
        rangeInstants(range, timeZone),
        projectIds,
      );
      setStats(result);
    }, [user, range, timeZone, projectIds]),
  );

  useEffect(() => {
    if (!user || !projectIds) return;
    void reload();
  }, [user, projectIds, reload]);

  return {
    range,
    setRange,
    timeZone,
    stats,
    loading,
    error,
    reload,
  };
}
