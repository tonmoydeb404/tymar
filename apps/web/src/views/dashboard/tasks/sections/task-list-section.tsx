"use client";

import { ProjectSelect } from "@/components/selectors/project-select";
import { useProjects, useTasks } from "@/contexts/app/app-context";
import type { Task, TaskStatus } from "@packages/domain/index";
import { DataState } from "@packages/ui/components/data-state";
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import { Input } from "@packages/ui/components/input";
import { PaginationControl } from "@packages/ui/components/pagination-control";
import { Archive } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TaskStatusFilter } from "../types";
import type { TasksView } from "../use-tasks-view";
import { useTasksData } from "../use-tasks-data";
import { CreateTaskModal } from "./create-task-modal";
import { DeleteTaskModal } from "./delete-task-modal";
import { buildTaskColumns } from "./task-columns";
import { TaskBoard } from "./task-board";
import { UpdateTaskModal } from "./update-task-modal";

const STATUS_FILTERS: { value: TaskStatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
  { value: "ARCHIVED", label: "Archived" },
];

export type TaskListSectionHandle = {
  openCreate: () => void;
};

type Props = {
  view: TasksView;
};

/** Filters + either the paginated table or the kanban board. */
export const TaskListSection = forwardRef<TaskListSectionHandle, Props>(
  function TaskListSection({ view }, ref) {
    const [showArchived, setShowArchived] = useState(false);
    const {
      tasks,
      setTasks,
      total,
      loading,
      isFetching,
      error,
      search,
      setSearch,
      statusFilter,
      setStatusFilter,
      projectFilter,
      setProjectFilter,
      page,
      setPage,
      pageCount,
      reload,
    } = useTasksData(view, showArchived);
    const { projects: allProjects } = useProjects();
    const { update: updateTask } = useTasks();

    const projects = useMemo(
      () => allProjects.filter((p) => !p.deletedAt),
      [allProjects],
    );
    const projectName = useCallback(
      (projectId: string) =>
        projects.find((p) => p.id === projectId)?.name ?? "Unknown",
      [projects],
    );

    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);
    const [deleting, setDeleting] = useState<Task | null>(null);

    useImperativeHandle(ref, () => ({
      openCreate: () => setCreateOpen(true),
    }));

    async function toggleDone(task: Task) {
      try {
        await updateTask.run(task.id, {
          status: task.status === "DONE" ? "TODO" : "DONE",
        });
        void reload();
      } catch {
        // Surfaced via updateTask.error from the hook.
      }
    }
    const [moveError, setMoveError] = useState<string | null>(null);

    // Optimistic: the card jumps columns immediately and snaps back if the
    // save fails.
    async function moveTask(task: Task, status: TaskStatus) {
      setMoveError(null);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status } : t)),
      );
      try {
        await updateTask.run(task.id, { status });
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: task.status } : t,
          ),
        );
        setMoveError(
          err instanceof Error
            ? `Couldn't move “${task.title}”: ${err.message}`
            : `Couldn't move “${task.title}”.`,
        );
      }
    }

    const toggleDoneRef = useRef(toggleDone);
    toggleDoneRef.current = toggleDone;

    const columns = useMemo(
      () =>
        buildTaskColumns({
          projectName,
          onToggleDone: (task) => void toggleDoneRef.current(task),
          onEdit: setEditing,
          onDelete: setDeleting,
        }),
      [projectName],
    );

    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-9 max-w-56"
          />
          <ProjectSelect
            value={projectFilter}
            onValueChange={(v) => setProjectFilter(v || "ALL")}
            extraOption={{ value: "ALL", label: "All projects" }}
            placeholder="Project"
            className="h-9 w-44"
          />
          {view === "list" && (
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
          )}
          {view === "board" && (
            <Button
              variant={showArchived ? "secondary" : "ghost"}
              aria-pressed={showArchived}
              onClick={() => setShowArchived((v) => !v)}
            >
              <Archive size={14} />
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
          )}
        </div>

        {view === "list" ? (
          <>
            <DataTable
              columns={columns}
              data={tasks}
              loading={loading}
              isFetching={isFetching}
              error={error}
              onRetry={() => void reload()}
              emptyTitle={total === 0 ? "No tasks yet" : "No matching tasks"}
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
          </>
        ) : (
          <DataState
            loading={false}
            error={error}
            data={[true]}
            emptyTitle=""
            onRetry={() => void reload()}
          >
            {() => (
              <div className="grid gap-3">
                {moveError && (
                  <p className="text-sm text-destructive">{moveError}</p>
                )}
                {total > tasks.length && (
                  <p className="text-xs text-muted-foreground">
                    Showing the {tasks.length} most recently updated of {total}{" "}
                    tasks — narrow it with search or a project.
                  </p>
                )}
                <TaskBoard
                  tasks={tasks}
                  loading={loading}
                  showArchived={showArchived}
                  projectName={projectName}
                  onMove={(task, status) => void moveTask(task, status)}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              </div>
            )}
          </DataState>
        )}

        <CreateTaskModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => void reload()}
        />
        <UpdateTaskModal
          task={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onUpdated={() => void reload()}
        />
        <DeleteTaskModal
          task={deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          onDeleted={() => void reload()}
        />
      </div>
    );
  },
);
