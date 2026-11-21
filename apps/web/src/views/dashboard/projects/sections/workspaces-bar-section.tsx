"use client";

import { useWorkspaces } from "@/contexts/app/app-context";
import type { Workspace } from "@packages/domain/index";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Archive,
  ArchiveRestore,
  FolderKanban,
  FolderPen,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { ArchiveWorkspaceModal } from "./archive-workspace-modal";
import { CreateWorkspaceModal } from "./create-workspace-modal";
import { DeleteWorkspaceModal } from "./delete-workspace-modal";
import { UpdateWorkspaceModal } from "./update-workspace-modal";

/** Filter value: "ALL", "NONE" (ungrouped projects) or a workspace id. */
export type WorkspaceFilter = string;

const NONE = "NONE";

export type WorkspacesBarHandle = {
  openCreate: () => void;
};

type Props = {
  filter: WorkspaceFilter;
  onFilterChange: (filter: WorkspaceFilter) => void;
  onChanged: () => void;
};

/** Workspace manager + filter row: every chip filters the project list;
 * the chip's menu renames/archives/deletes the workspace. */
export const WorkspacesBarSection = forwardRef<WorkspacesBarHandle, Props>(
  function WorkspacesBarSection({ filter, onFilterChange, onChanged }, ref) {
    const { workspaces } = useWorkspaces();
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Workspace | null>(null);
    const [deleting, setDeleting] = useState<Workspace | null>(null);
    const [archiving, setArchiving] = useState<Workspace | null>(null);

    useImperativeHandle(ref, () => ({
      openCreate: () => setCreateOpen(true),
    }));

    const ordered = [...workspaces].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    function chip(value: WorkspaceFilter, label: React.ReactNode) {
      const selected = filter === value;
      return (
        <button
          key={value}
          type="button"
          onClick={() => onFilterChange(value)}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {chip("ALL", "All projects")}
        {ordered.map((w) => (
          <div key={w.id} className="group relative">
            {chip(w.id, (
              <>
                <FolderKanban size={12} />
                <span className="max-w-40 truncate">{w.name}</span>
                {w.status === "ARCHIVED" && (
                  <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                    Archived
                  </Badge>
                )}
              </>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Manage ${w.name}`}
                    className={cn(
                      "absolute top-1/2 right-1 -translate-y-1/2 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-foreground/10",
                      filter === w.id && "opacity-100",
                    )}
                  >
                    <MoreHorizontal size={12} />
                  </button>
                }
              />
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setEditing(w)}>
                  <FolderPen size={12} />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setArchiving(w)}>
                  {w.status === "ARCHIVED" ? (
                    <ArchiveRestore size={12} />
                  ) : (
                    <Archive size={12} />
                  )}
                  {w.status === "ARCHIVED" ? "Unarchive" : "Archive"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleting(w)}
                >
                  <Trash2 size={12} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {chip(NONE, "No workspace")}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 rounded-full px-3 text-xs"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={12} />
          New workspace
        </Button>

        <CreateWorkspaceModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={onChanged}
        />
        <UpdateWorkspaceModal
          workspace={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onUpdated={onChanged}
        />
        <ArchiveWorkspaceModal
          workspace={archiving}
          onOpenChange={(open) => !open && setArchiving(null)}
          onArchived={onChanged}
        />
        <DeleteWorkspaceModal
          workspace={deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          onDeleted={onChanged}
        />
      </div>
    );
  },
);
