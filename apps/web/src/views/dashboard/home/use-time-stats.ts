"use client";

import { useAuth } from "@/lib/auth-context";
import { getProfile, getTimeStats, type TimeStats } from "@/lib/db";
import { useAsyncAction } from "@/lib/use-async-action";
import { useQueryParams } from "@/lib/use-query-params";
import { dayAfter, defaultRange } from "../time/lib/date-range";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Worked/break stats for a user-selected date range, queried server-side. */
export function useTimeStats() {
  const { user } = useAuth();
  const { get, set } = useQueryParams();
  const [timeZone, setTimeZone] = useState("UTC");
  const [stats, setStats] = useState<TimeStats | null>(null);

  const fallback = useMemo(defaultRange, []);
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getProfile(user.id).then((profile) => {
      if (cancelled) return;
      setTimeZone(
        profile?.timezone ||
          (typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : "UTC"),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!user) return;
      const result = await getTimeStats(user.id, {
        from: `${range.from}T00:00:00.000Z`,
        to: dayAfter(range.to),
      });
      setStats(result);
    }, [user, range]),
  );

  useEffect(() => {
    if (!user) return;
    void reload();
  }, [user, reload]);

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
