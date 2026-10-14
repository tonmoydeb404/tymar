import type { Project } from "@packages/domain/index";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { DataTableFeatures } from "@packages/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Archive,
  ArchiveRestore,
  FolderPen,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

type ProjectColumnsOptions = {
  taskCounts: Record<string, number>;
  onEdit: (project: Project) => void;
  onToggleArchive: (project: Project) => void;
  onDelete: (project: Project) => void;
};

export function buildProjectColumns({
  taskCounts,
  onEdit,
  onToggleArchive,
  onDelete,
}: ProjectColumnsOptions): ColumnDef<DataTableFeatures, Project>[] {
  return [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
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
      id: "tasks",
      header: "Tasks",
      cell: ({ row }) => taskCounts[row.original.id] ?? 0,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Project actions"
                  >
                    <MoreHorizontal size={14} />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(project)}>
                  <FolderPen size={12} />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleArchive(project)}>
                  {project.status === "ARCHIVED" ? (
                    <ArchiveRestore size={12} />
                  ) : (
                    <Archive size={12} />
                  )}
                  {project.status === "ARCHIVED" ? "Unarchive" : "Archive"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(project)}
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
