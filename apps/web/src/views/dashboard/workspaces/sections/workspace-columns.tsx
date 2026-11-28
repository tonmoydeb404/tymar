import type { Workspace } from "@packages/domain/index";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { DataTableFeatures } from "@packages/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  FolderPen,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

type WorkspaceColumnsOptions = {
  currentId: string | null;
  projectCounts: Record<string, number>;
  /** The last active workspace must stay, so it can't be archived or deleted. */
  isLastActive: (workspace: Workspace) => boolean;
  onSwitch: (workspace: Workspace) => void;
  onEdit: (workspace: Workspace) => void;
  onToggleArchive: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
};

export function buildWorkspaceColumns({
  currentId,
  projectCounts,
  isLastActive,
  onSwitch,
  onEdit,
  onToggleArchive,
  onDelete,
}: WorkspaceColumnsOptions): ColumnDef<DataTableFeatures, Workspace>[] {
  return [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.id === currentId && (
            <Badge variant="outline">Current</Badge>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.status === "ARCHIVED" ? (
          <Badge variant="secondary">Archived</Badge>
        ) : (
          <Badge variant="outline">Active</Badge>
        ),
    },
    {
      id: "projects",
      header: "Projects",
      cell: ({ row }) => projectCounts[row.original.id] ?? 0,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const workspace = row.original;
        const isActive = workspace.status === "ACTIVE";
        const locked = isLastActive(workspace);
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Workspace actions"
                  >
                    <MoreHorizontal size={14} />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {isActive && workspace.id !== currentId && (
                  <DropdownMenuItem onClick={() => onSwitch(workspace)}>
                    <ArrowRightLeft size={12} />
                    Switch to
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onEdit(workspace)}>
                  <FolderPen size={12} />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={locked}
                  onClick={() => onToggleArchive(workspace)}
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
                  disabled={locked}
                  onClick={() => onDelete(workspace)}
                >
                  <Trash2 size={12} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
