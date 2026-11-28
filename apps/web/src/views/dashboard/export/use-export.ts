"use client";

import { useProjects, useWorkspaces } from "@/contexts/app/app-context";
import { useAuth } from "@/lib/auth-context";
import { queryTimeEntriesByRange } from "@/lib/db";
import { buildExport } from "@/lib/export/build";
import {
  defaultConfig,
  reconcileConfig,
  type ExportConfig,
} from "@/lib/export/columns";
import { toCsv } from "@/lib/export/csv";
import { defaultRange, rangeInstants } from "@/lib/range";
import { useAsyncAction } from "@/lib/use-async-action";
import { useQueryParams } from "@/lib/use-query-params";
import { useTimeZone } from "@/lib/use-time-zone";
import type { TimeEntryWithDetails } from "@packages/domain/index";
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "tymar:export-config:v1";
/** Hard ceiling on entries pulled for one export. */
const MAX_ENTRIES = 20_000;

/** Everything the export page needs: the saved layout, the selected range
 * and filters, the matching entries, and the built CSV. */
export function useExport() {
  const { user } = useAuth();
  const timeZone = useTimeZone();
  const { get, set } = useQueryParams();
  const { projects } = useProjects();
  const { workspaces } = useWorkspaces();

  const [config, setConfigState] = useState<ExportConfig>(defaultConfig);
  const [hydrated, setHydrated] = useState(false);
  const [entries, setEntries] = useState<TimeEntryWithDetails[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());

  // Saved layout — first visit gets the plain default export.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConfigState(reconcileConfig(JSON.parse(raw)));
    } catch {
      // Corrupt or unavailable storage — keep the defaults.
    }
    setHydrated(true);
  }, []);

  const setConfig = useCallback(
    (update: (prev: ExportConfig) => ExportConfig) => {
      setConfigState((prev) => {
        const next = update(prev);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Persisting is best-effort.
        }
        return next;
      });
    },
    [],
  );

  const resetConfig = useCallback(() => {
    const fresh = defaultConfig();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setConfigState((prev) => ({ ...fresh, mode: prev.mode }));
  }, []);

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

  const { type, projectIds } = config.filters;
  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!user) return;
      const result = await queryTimeEntriesByRange(
        user.id,
        timeZone,
        {
          type,
          projectIds: projectIds.length ? projectIds : undefined,
          ...rangeInstants(range, timeZone),
        },
        { pageSize: 500, maxEntries: MAX_ENTRIES },
      );
      setEntries(result.groups.flatMap((g) => g.entries));
      setTruncated(result.truncated);
      setFetchedAt(Date.now());
    }, [user, timeZone, type, projectIds, range]),
  );

  useEffect(() => {
    if (!user || !hydrated) return;
    void reload().catch(() => {});
  }, [user, hydrated, reload]);

  const workspaceByProject = useMemo(() => {
    const names = new Map(workspaces.map((w) => [w.id, w.name]));
    const map = new Map<string, string>();
    for (const p of projects) {
      const name = p.workspaceId ? names.get(p.workspaceId) : undefined;
      if (name) map.set(p.id, name);
    }
    return map;
  }, [projects, workspaces]);

  const built = useMemo(
    () =>
      buildExport(entries, config, {
        timeZone,
        nowMs: fetchedAt,
        range,
        workspaceByProject,
      }),
    [entries, config, timeZone, fetchedAt, range, workspaceByProject],
  );

  const download = useCallback(() => {
    const table = config.headerRow ? [built.headers, ...built.rows] : built.rows;
    const csv = toCsv(table, {
      delimiter: config.csv.delimiter,
      bom: config.csv.bom,
      protectFormulas: config.csv.protectFormulas,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tymar-${config.mode}-${range.from}_to_${range.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [built, config, range]);

  return {
    config,
    setConfig,
    resetConfig,
    range,
    setRange,
    timeZone,
    built,
    entryCount: entries.length,
    truncated,
    loading: loading || !hydrated,
    error,
    reload,
    download,
  };
}

export type ExportState = ReturnType<typeof useExport>;
