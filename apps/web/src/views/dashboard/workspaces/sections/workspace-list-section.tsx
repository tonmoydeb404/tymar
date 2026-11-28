import { useCurrentWorkspace } from "@/contexts/app/app-context";
import type { Workspace } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import { Input } from "@packages/ui/components/input";
import { PaginationControl } from "@packages/ui/components/pagination-control";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import type { WorkspaceStatusFilter } from "../types";
import { useWorkspacesData } from "../use-workspaces-data";
import { ArchiveWorkspaceModal } from "./archive-workspace-modal";
import { CreateWorkspaceModal } from "./create-workspace-modal";
import { DeleteWorkspaceModal } from "./delete-workspace-modal";
import { buildWorkspaceColumns } from "./workspace-columns";
import { UpdateWorkspaceModal } from "./update-workspace-modal";

const STATUS_FILTERS: { value: WorkspaceStatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "ARCHIVED", label: "Archived" },
];

export type WorkspaceListSectionHandle = {
  openCreate: () => void;
};

export const WorkspaceListSection = forwardRef<
  WorkspaceListSectionHandle,
  object
>(function WorkspaceListSection(_props, ref) {
  const {
    workspaces,
    total,
    activeCount,
    loading,
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
  } = useWorkspacesData();
  const { currentId, setCurrentId } = useCurrentWorkspace();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [archiving, setArchiving] = useState<Workspace | null>(null);

  useImperativeHandle(ref, () => ({
    openCreate: () => setCreateOpen(true),
  }));

  const columns = useMemo(
    () =>
      buildWorkspaceColumns({
        currentId,
        projectCounts,
        isLastActive: (w) => w.status === "ACTIVE" && activeCount <= 1,
        onSwitch: (w) => setCurrentId(w.id),
        onEdit: setEditing,
        onToggleArchive: setArchiving,
        onDelete: setDeleting,
      }),
    [currentId, projectCounts, activeCount, setCurrentId],
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workspaces…"
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
        data={workspaces}
        loading={loading}
        error={error}
        onRetry={() => void reload().catch(() => {})}
        emptyTitle={
          total === 0 ? "No workspaces yet" : "No matching workspaces"
        }
        emptyHint={
          total === 0
            ? "Create one to start tracking time."
            : "Try a different search or filter."
        }
      />

      <PaginationControl
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
      />

      {total > 0 && activeCount <= 1 && (
        <p className="text-xs text-muted-foreground">
          This is your only active workspace, so it can&apos;t be archived or
          deleted. Create another one first.
        </p>
      )}

      <CreateWorkspaceModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {}}
      />
      <UpdateWorkspaceModal
        workspace={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onUpdated={() => {}}
      />
      <DeleteWorkspaceModal
        workspace={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => {}}
      />
      <ArchiveWorkspaceModal
        workspace={archiving}
        onOpenChange={(open) => !open && setArchiving(null)}
        onArchived={() => {}}
      />
    </div>
  );
});
