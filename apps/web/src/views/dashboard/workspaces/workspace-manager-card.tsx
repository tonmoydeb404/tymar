"use client";

import { useCurrentWorkspace, useWorkspaces } from "@/contexts/app/app-context";
import type { Workspace } from "@packages/domain/index";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/card";
import { DataState } from "@packages/ui/components/data-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  FolderKanban,
  FolderPen,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { ArchiveWorkspaceModal } from "./archive-workspace-modal";
import { CreateWorkspaceModal } from "./create-workspace-modal";
import { DeleteWorkspaceModal } from "./delete-workspace-modal";
import { UpdateWorkspaceModal } from "./update-workspace-modal";

/** Settings card for creating, renaming, archiving and deleting workspaces.
 * At least one workspace always remains: the last active one can't be
 * archived or deleted. */
export function WorkspaceManagerCard() {
  const { workspaces, loading, error, reload } = useWorkspaces();
  const { currentId, setCurrentId } = useCurrentWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [archiving, setArchiving] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState<Workspace | null>(null);

  const visible = workspaces.filter((w) => !w.deletedAt);
  const activeCount = visible.filter((w) => w.status === "ACTIVE").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <FolderKanban className="size-3.5" />
            Workspaces
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} />
            New workspace
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Projects, tasks and time are organised per workspace — switch between
          them from the sidebar. You always need at least one.
        </p>
        <DataState
          loading={loading && visible.length === 0}
          error={error}
          data={visible}
          emptyTitle="No workspaces"
          emptyHint="Create one to start tracking time."
          onRetry={() => void reload().catch(() => {})}
          loadingComponent={<Skeleton className="h-28" />}
        >
          {(items) => (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {items.map((w) => {
                const isCurrent = w.id === currentId;
                const isActive = w.status === "ACTIVE";
                // The last active workspace is the one that must stay.
                const isLastActive = isActive && activeCount <= 1;
                return (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="grid min-w-0 gap-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {w.name}
                        </span>
                        {isCurrent && <Badge variant="outline">Current</Badge>}
                        {!isActive && (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </div>
                      {w.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {w.description}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Manage ${w.name}`}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isActive && !isCurrent && (
                          <DropdownMenuItem onClick={() => setCurrentId(w.id)}>
                            <ArrowRightLeft size={12} />
                            Switch to
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setEditing(w)}>
                          <FolderPen size={12} />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isLastActive}
                          onClick={() => setArchiving(w)}
                        >
                          {isActive ? (
                            <Archive size={12} />
                          ) : (
                            <ArchiveRestore size={12} />
                          )}
                          {isActive ? "Archive" : "Unarchive"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={isLastActive}
                          onClick={() => setDeleting(w)}
                        >
                          <Trash2 size={12} />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </DataState>
        {activeCount <= 1 && visible.length > 0 && (
          <p className="text-xs text-muted-foreground">
            This is your only active workspace, so it can&apos;t be archived or
            deleted. Create another one first.
          </p>
        )}
      </CardContent>

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
      <ArchiveWorkspaceModal
        workspace={archiving}
        onOpenChange={(open) => !open && setArchiving(null)}
        onArchived={() => {}}
      />
      <DeleteWorkspaceModal
        workspace={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => {}}
      />
    </Card>
  );
}
