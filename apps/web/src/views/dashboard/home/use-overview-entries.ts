"use client";

import { useWorkspaceScope } from "@/contexts/app/app-context";
import { useAuth } from "@/lib/auth-context";
import { queryTimeEntriesByRange } from "@/lib/db";
import { useAsyncAction } from "@/lib/use-async-action";
import {
  entryDurationMs,
  type TimeEntryWithDetails,
} from "@packages/domain/index";
import { useCallback, useEffect, useMemo, useState } from "react";
import { rangeInstants } from "@/lib/range";

export type ProjectShare = {
  /** project name, or "No project". */
  name: string;
  workMs: number;
  /** 0–1 share of all worked time in the range. */
  share: number;
};

/** Entries in the selected range, reduced to what the overview needs: the
 * time split by project and the most recent sessions. */
export function useOverviewEntries(
  timeZone: string,
  range: { from: string; to: string },
) {
  const { user } = useAuth();
  const { projectIds } = useWorkspaceScope();
  const [entries, setEntries] = useState<TimeEntryWithDetails[]>([]);

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!user || !projectIds) return;
      const { groups } = await queryTimeEntriesByRange(
        user.id,
        timeZone,
        { ...rangeInstants(range, timeZone), projectIds },
        { maxEntries: 1000 },
      );
      setEntries(groups.flatMap((g) => g.entries));
    }, [user, timeZone, range, projectIds]),
  );

  useEffect(() => {
    if (!user || !projectIds) return;
    void reload();
  }, [user, projectIds, reload]);

  const byProject = useMemo<ProjectShare[]>(() => {
    const totals = new Map<string, number>();
    let all = 0;
    for (const e of entries) {
      if (e.type === "BREAK") continue;
      const ms = entryDurationMs(e.startedAt, e.endedAt);
      const name = e.projectName ?? "No project";
      totals.set(name, (totals.get(name) ?? 0) + ms);
      all += ms;
    }
    return [...totals.entries()]
      .map(([name, workMs]) => ({
        name,
        workMs,
        share: all > 0 ? workMs / all : 0,
      }))
      .sort((a, b) => b.workMs - a.workMs);
  }, [entries]);

  const recent = useMemo(
    () =>
      [...entries]
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 6),
    [entries],
  );

  return { byProject, recent, loading, error, reload };
}
