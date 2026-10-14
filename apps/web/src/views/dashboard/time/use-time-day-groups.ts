"use client";

import { useAuth } from "@/lib/auth-context";
import { getProfile, queryTimeEntriesByRange } from "@/lib/db";
import { useAsyncAction } from "@/lib/use-async-action";
import { useQueryParams } from "@/lib/use-query-params";
import type { TimeEntryWithDetails } from "@packages/domain/index";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dayAfter, defaultRange } from "./lib/date-range";
import type { EntryTypeFilter } from "./types";

/** Fixed entry budget per table page — date separators are free rows. */
const ROWS_PER_PAGE = 20;

function isEntryTypeFilter(value: string): value is EntryTypeFilter {
  return value === "ALL" || value === "WORK" || value === "BREAK";
}

export type TimeGroupSummary = {
  day: string;
  entries: TimeEntryWithDetails[];
  workMs: number;
  breakMs: number;
};

/** One visible entry row paired with its full-day group (for separators). */
export type VisibleTimeRow = {
  entry: TimeEntryWithDetails;
  group: TimeGroupSummary;
};

/**
 * Top-level state for the grouped time table: one range query for all
 * entries in the selected date range, grouped by start-day, with entry-row
 * pagination in memory. A date split across pages repeats its separator row.
 * Every filter is read from/written to URL search params so the list stays
 * shareable and survives refreshes.
 */
export function useTimeDayGroups() {
  const { user } = useAuth();
  const { get, set } = useQueryParams();
  const [timeZone, setTimeZone] = useState("UTC");
  const [groups, setGroups] = useState<TimeGroupSummary[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const fallbackRange = useMemo(defaultRange, []);

  const typeParam = get("type") ?? "ALL";
  const typeFilter: EntryTypeFilter = isEntryTypeFilter(typeParam)
    ? typeParam
    : "ALL";
  const projectFilter = get("project") ?? "";
  const taskFilter = get("task") ?? "";
  const range = useMemo(
    () => ({
      from: get("from") ?? fallbackRange.from,
      to: get("to") ?? fallbackRange.to,
    }),
    [get, fallbackRange],
  );
  const page = Number(get("page") ?? "1") || 1;

  const setTypeFilter = useCallback(
    (value: EntryTypeFilter) =>
      set({ type: value === "ALL" ? undefined : value, page: undefined }),
    [set],
  );
  const setProjectFilter = useCallback(
    (value: string) => set({ project: value || undefined, page: undefined }),
    [set],
  );
  const setTaskFilter = useCallback(
    (value: string) => set({ task: value || undefined, page: undefined }),
    [set],
  );
  const setRange = useCallback(
    (next: { from?: string; to?: string }) =>
      set({ from: next.from, to: next.to, page: undefined }),
    [set],
  );
  const setPage = useCallback(
    (value: number) => set({ page: value > 1 ? String(value) : undefined }),
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
    isLoading: isFetching,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!user) return;
      const { groups: rows, totalEntries: count, truncated: hitCap } =
        await queryTimeEntriesByRange(user.id, timeZone, {
          type: typeFilter,
          taskId: taskFilter || undefined,
          projectId: taskFilter ? undefined : projectFilter || undefined,
          from: range.from ? `${range.from}T00:00:00.000Z` : undefined,
          to: range.to ? dayAfter(range.to) : undefined,
        });
      setGroups(rows);
      setTotalEntries(count);
      setTruncated(hitCap);
      setHasLoadedOnce(true);
    }, [user, timeZone, typeFilter, taskFilter, projectFilter, range]),
  );

  // Only the very first fetch should show the full skeleton — later refetches
  // keep existing rows with a top bar loader (same as useTasksData).

  useEffect(() => {
    void reload();
  }, [reload, refreshSignal]);

  const loading = isFetching && !hasLoadedOnce;

  const pageCount = Math.max(1, Math.ceil(totalEntries / ROWS_PER_PAGE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  // Visible entry rows for the current page, each paired with its full-day
  // group (separators show full-day totals even when a date splits pages).
  const visible = useMemo<VisibleTimeRow[]>(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return groups
      .flatMap((group) => group.entries.map((entry) => ({ entry, group })))
      .slice(start, start + ROWS_PER_PAGE);
  }, [groups, page]);

  const notifyChanged = useCallback(() => setRefreshSignal((n) => n + 1), []);

  return useMemo(
    () => ({
      groups,
      visible,
      totalEntries,
      truncated,
      loading,
      isFetching,
      error,
      timeZone,
      typeFilter,
      setTypeFilter,
      projectFilter,
      setProjectFilter,
      taskFilter,
      setTaskFilter,
      range,
      setRange,
      page,
      setPage,
      pageCount,
      reload,
      refreshSignal,
      notifyChanged,
    }),
    [
      groups,
      visible,
      totalEntries,
      truncated,
      loading,
      isFetching,
      error,
      timeZone,
      typeFilter,
      setTypeFilter,
      projectFilter,
      setProjectFilter,
      taskFilter,
      setTaskFilter,
      range,
      setRange,
      page,
      setPage,
      pageCount,
      reload,
      refreshSignal,
      notifyChanged,
    ],
  );
}
