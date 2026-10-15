"use client";

import { useAuth } from "@/lib/auth-context";
import { getDayTotals } from "@/lib/db";
import { useAsyncAction } from "@/lib/use-async-action";
import type { DayTotal } from "@packages/domain/index";
import { useCallback, useEffect, useMemo, useState } from "react";

/** All "YYYY-MM-DD" day keys from `from` to `to` (inclusive), ascending. */
function dayKeysInRange(from: string, to: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(end.getTime())) {
    return keys;
  }
  while (cursor.getTime() <= end.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/** Per-day work/break totals for a date range, zero-filled for gap days. */
export function useDayTotals(
  timeZone: string,
  range: { from: string; to: string },
) {
  const { user } = useAuth();
  const [totals, setTotals] = useState<DayTotal[]>([]);

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!user) return;
      const from = `${range.from}T00:00:00.000Z`;
      const to = new Date(
        new Date(`${range.to}T00:00:00.000Z`).getTime() + 24 * 3600 * 1000,
      ).toISOString();
      const rows = await getDayTotals(user.id, timeZone, { from, to });
      setTotals(rows);
    }, [user, timeZone, range.from, range.to]),
  );

  useEffect(() => {
    if (!user) return;
    void reload();
  }, [user, reload]);

  const data = useMemo(() => {
    const byDay = new Map(totals.map((d) => [d.day, d]));
    return dayKeysInRange(range.from, range.to).map(
      (day) => byDay.get(day) ?? { day, workMs: 0, breakMs: 0, totalMs: 0 },
    );
  }, [totals, range.from, range.to]);

  return { data, loading, error, reload };
}
