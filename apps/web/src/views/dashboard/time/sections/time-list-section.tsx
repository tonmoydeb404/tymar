"use client";

import { ProjectSelect } from "@/components/selectors/project-select";
import { TaskSelect } from "@/components/selectors/task-select";
import { useQueryParams } from "@/lib/use-query-params";
import type { TimeEntryWithDetails } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { PaginationControl } from "@packages/ui/components/pagination-control";
import { forwardRef, useImperativeHandle, useState } from "react";
import type { EntryTypeFilter } from "../types";
import type { useTimeDayGroups } from "../use-time-day-groups";
import { CreateTimeEntryModal } from "./create-time-entry-modal";
import { DeleteTimeEntryModal } from "./delete-time-entry-modal";
import { TimeGroupedTable } from "./time-grouped-table";
import { TimeTimelineView } from "./time-timeline-view";
import { UpdateTimeEntryModal } from "./update-time-entry-modal";

type ViewMode = "list" | "timeline";

const TYPE_FILTERS: { value: EntryTypeFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "WORK", label: "Work" },
  { value: "BREAK", label: "Break" },
];

export type TimeListSectionHandle = {
  openCreate: () => void;
};

type Props = ReturnType<typeof useTimeDayGroups>;

export const TimeListSection = forwardRef<TimeListSectionHandle, Props>(
  function TimeListSection(
    {
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
      page,
      setPage,
      pageCount,
      reload,
      notifyChanged,
    },
    ref,
  ) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<TimeEntryWithDetails | null>(null);
    const [deleting, setDeleting] = useState<TimeEntryWithDetails | null>(null);

    const { get, set } = useQueryParams();
    const viewParam = get("view");
    const view: ViewMode = viewParam === "timeline" ? "timeline" : "list";
    const setView = (v: ViewMode) => set({ view: v === "list" ? undefined : v });

    useImperativeHandle(ref, () => ({
      openCreate: () => setCreateOpen(true),
    }));

    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectSelect
            value={projectFilter}
            onValueChange={(id) => {
              setProjectFilter(id);
              setTaskFilter(""); // clear task when project changes
            }}
            placeholder="All projects"
            extraOption={{ value: "", label: "All projects" }}
            className="h-9 w-44"
          />
          <TaskSelect
            value={taskFilter}
            onValueChange={setTaskFilter}
            projectId={projectFilter || undefined}
            placeholder="All tasks"
            extraOption={{ value: "", label: "All tasks" }}
            className="h-9 w-44"
          />
          <div className="flex gap-1">
            {TYPE_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={typeFilter === f.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTypeFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
            >
              List
            </Button>
            <Button
              variant={view === "timeline" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("timeline")}
            >
              Timeline
            </Button>
          </div>
        </div>

        {view === "timeline" ? (
          <TimeTimelineView
            groups={groups}
            timeZone={timeZone}
            loading={loading}
            error={error}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <TimeGroupedTable
              visible={visible}
              totalEntries={totalEntries}
              timeZone={timeZone}
              onEdit={setEditing}
              onDelete={setDeleting}
              loading={loading}
              isFetching={isFetching}
              error={error}
              onRetry={() => void reload()}
              truncated={truncated}
            />

            <PaginationControl
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          </>
        )}

        <CreateTimeEntryModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={notifyChanged}
        />
        <UpdateTimeEntryModal
          entry={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onUpdated={notifyChanged}
        />
        <DeleteTimeEntryModal
          entry={deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          onDeleted={notifyChanged}
        />
      </div>
    );
  },
);
