"use client";

import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@packages/domain/index";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Archive, CalendarDays, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "DONE", label: "Done" },
];
const ARCHIVED_COLUMN = { status: "ARCHIVED", label: "Archived" } as const;

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-destructive/10 text-destructive border-destructive/20",
  MEDIUM: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  LOW: "bg-muted text-muted-foreground",
};

type Props = {
  tasks: Task[];
  loading: boolean;
  /** Adds the Archived column; hidden by default. */
  showArchived: boolean;
  projectName: (projectId: string) => string;
  onMove: (task: Task, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

/** Kanban layout: one column per status. Cards drag between columns (or use
 * the card menu — drag and drop isn't available on touch or by keyboard). */
export function TaskBoard({
  tasks,
  loading,
  showArchived,
  projectName,
  onMove,
  onEdit,
  onDelete,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);

  const byStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
      ARCHIVED: [],
    };
    for (const t of tasks) groups[t.status]?.push(t);
    return groups;
  }, [tasks]);

  function endDrag() {
    setDragId(null);
    setOverStatus(null);
  }

  function handleDrop(status: TaskStatus) {
    const task = tasks.find((t) => t.id === dragId);
    endDrag();
    if (task && task.status !== status) onMove(task, status);
  }

  const columns = showArchived ? [...COLUMNS, ARCHIVED_COLUMN] : COLUMNS;

  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-3",
        showArchived && "xl:grid-cols-4",
      )}
    >
      {columns.map(({ status, label }) => {
        const items = byStatus[status];
        return (
          <section
            key={status}
            aria-label={label}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverStatus(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setOverStatus((s) => (s === status ? null : s));
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(status);
            }}
            className={cn(
              "flex min-h-48 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2 transition-colors",
              overStatus === status && "border-primary/50 bg-primary/5",
            )}
          >
            <header className="flex items-center justify-between px-1.5 py-1">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {loading ? "–" : items.length}
              </span>
            </header>

            {loading ? (
              <>
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </>
            ) : items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {dragId ? "Drop here" : "Nothing here"}
              </p>
            ) : (
              items.map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", task.id);
                    setDragId(task.id);
                  }}
                  onDragEnd={endDrag}
                  className={cn(
                    "grid cursor-grab gap-2 rounded-lg border border-border bg-card p-3 shadow-xs active:cursor-grabbing",
                    dragId === task.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "min-w-0 break-words text-sm font-medium",
                        (task.status === "DONE" || task.status === "ARCHIVED") &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {task.title}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Actions for ${task.title}`}
                            className="-mr-1 -mt-0.5 shrink-0"
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {COLUMNS.filter((c) => c.status !== task.status).map(
                          (c) => (
                            <DropdownMenuItem
                              key={c.status}
                              onClick={() => onMove(task, c.status)}
                            >
                              Move to {c.label}
                            </DropdownMenuItem>
                          ),
                        )}
                        {task.status !== "ARCHIVED" && (
                          <DropdownMenuItem
                            onClick={() => onMove(task, "ARCHIVED")}
                          >
                            <Archive size={14} />
                            Archive
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEdit(task)}>
                          <Pencil size={14} />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(task)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="max-w-full truncate">
                      {projectName(task.projectId)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={PRIORITY_STYLES[task.priority]}
                    >
                      {task.priority.charAt(0) +
                        task.priority.slice(1).toLowerCase()}
                    </Badge>
                    {task.dueDate && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays size={12} />
                        {task.dueDate.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
