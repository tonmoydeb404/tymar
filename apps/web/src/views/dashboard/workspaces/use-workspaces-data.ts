"use client";

import { useProjects, useWorkspaces } from "@/contexts/app/app-context";
import { useEffect, useMemo, useState } from "react";
import type { WorkspaceStatusFilter } from "./types";

const PAGE_SIZE = 8;

/** Workspaces already live in the app context, so search / filter / paging run client-side. */
export function useWorkspacesData() {
  const { workspaces, loading, error, reload } = useWorkspaces();
  const { projects } = useProjects();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<WorkspaceStatusFilter>("ALL");
  const [page, setPage] = useState(1);

  const visible = useMemo(
    () => workspaces.filter((w) => !w.deletedAt),
    [workspaces],
  );
  const activeCount = visible.filter((w) => w.status === "ACTIVE").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visible.filter(
      (w) =>
        (statusFilter === "ALL" || w.status === statusFilter) &&
        (!q ||
          w.name.toLowerCase().includes(q) ||
          (w.description ?? "").toLowerCase().includes(q)),
    );
  }, [visible, search, statusFilter]);

  const projectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      if (p.deletedAt || !p.workspaceId) continue;
      counts[p.workspaceId] = (counts[p.workspaceId] ?? 0) + 1;
    }
    return counts;
  }, [projects]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const rows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  return {
    workspaces: rows,
    total: visible.length,
    activeCount,
    loading: loading && visible.length === 0,
    error,
    projectCounts,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    pageCount,
    reload,
  };
}
