import type { Project } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import { Input } from "@packages/ui/components/input";
import { PaginationControl } from "@packages/ui/components/pagination-control";
import { useWorkspaces } from "@/contexts/app/app-context";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import type { ProjectStatusFilter } from "../types";
import { useProjectsData } from "../use-projects-data";
import { ArchiveProjectModal } from "./archive-project-modal";
import { CreateProjectModal } from "./create-project-modal";
import { DeleteProjectModal } from "./delete-project-modal";
import { buildProjectColumns } from "./project-columns";
import { UpdateProjectModal } from "./update-project-modal";
import { WorkspacesBarSection } from "./workspaces-bar-section";

const STATUS_FILTERS: { value: ProjectStatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "ARCHIVED", label: "Archived" },
];

export type ProjectListSectionHandle = {
  openCreate: () => void;
};

export const ProjectListSection = forwardRef<ProjectListSectionHandle, object>(
  function ProjectListSection(_props, ref) {
    const {
      projects,
      total,
      loading,
      isFetching,
      error,
      taskCounts,
      search,
      setSearch,
      statusFilter,
      setStatusFilter,
      workspaceFilter,
      setWorkspaceFilter,
      page,
      setPage,
      pageCount,
      reload,
    } = useProjectsData();
    const { workspaces } = useWorkspaces();

    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Project | null>(null);
    const [deleting, setDeleting] = useState<Project | null>(null);
    const [archiving, setArchiving] = useState<Project | null>(null);

    useImperativeHandle(ref, () => ({
      openCreate: () => setCreateOpen(true),
    }));

    const columns = useMemo(
      () =>
        buildProjectColumns({
          taskCounts,
          workspaceNames: Object.fromEntries(
            workspaces.map((w) => [w.id, w.name]),
          ),
          onEdit: setEditing,
          onToggleArchive: setArchiving,
          onDelete: setDeleting,
        }),
      [taskCounts, workspaces],
    );

    // Workspaces bar changes (create/archive/delete + project moves) affect
    // both the chips and the table.
    const refreshAll = () => {
      void reload();
    };

    return (
      <div className="grid gap-4">
        <WorkspacesBarSection
          filter={workspaceFilter}
          onFilterChange={setWorkspaceFilter}
          onChanged={refreshAll}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="h-9 max-w-56"
          />
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={statusFilter === f.value ? "default" : "ghost"}
                size="default"
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={projects}
          loading={loading}
          isFetching={isFetching}
          error={error}
          onRetry={() => void reload()}
          emptyTitle={
            total === 0 ? "No projects yet" : "No matching projects"
          }
          emptyHint={
            total === 0
              ? "Create the first one to get started."
              : "Try a different search or filter."
          }
        />

        <PaginationControl
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
        />

        <CreateProjectModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={refreshAll}
        />
        <UpdateProjectModal
          project={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onUpdated={refreshAll}
        />
        <DeleteProjectModal
          project={deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          onDeleted={refreshAll}
        />
        <ArchiveProjectModal
          project={archiving}
          onOpenChange={(open) => !open && setArchiving(null)}
          onArchived={refreshAll}
        />
      </div>
    );
  },
);
