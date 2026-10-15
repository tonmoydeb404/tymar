import { useAuth } from "@/lib/auth-context";
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type TaskInput,
} from "@/lib/db";
import { createSupabaseClient } from "@/lib/supabase";
import { useAsyncAction } from "@/lib/use-async-action";
import {
  TABLES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@packages/domain/index";
import { useCallback, useEffect, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTask(row: Record<string, any>): Task {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    userId: String(row.user_id ?? ""),
    projectId: String(row.project_id ?? ""),
    title: String(row.title ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    status: (row.status as TaskStatus) ?? "TODO",
    priority: (row.priority as TaskPriority) ?? "MEDIUM",
    dueDate: typeof row.due_date === "string" ? row.due_date : null,
    completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
  };
}

/** Full task set (all statuses, incl. soft-deleted) — consumers filter locally. */
export function useTasksData() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [tasks, setTasks] = useState<Task[]>([]);

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!userId) return;
      setTasks(await listTasks(userId, { includeDeleted: true }));
    }, [userId]),
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live updates from Supabase — keeps other tabs and devices in sync.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const sb = createSupabaseClient();
    const channel = sb
      .channel(`tasks-rt-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLES.tasks,
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) setTasks((prev) => prev.filter((t) => t.id !== id));
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          if (!row?.id) return;
          const item = rowToTask(row);
          setTasks((prev) => {
            const exists = prev.some((t) => t.id === item.id);
            return exists
              ? prev.map((t) => (t.id === item.id ? item : t))
              : [item, ...prev];
          });
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
  }, [userId]);

  const create = useAsyncAction(async (input: TaskInput) => {
    if (!userId) throw new Error("Not signed in.");
    const saved = await createTask(userId, input);
    setTasks((prev) => [saved, ...prev]);
    return saved;
  });

  const update = useAsyncAction(
    async (
      taskId: string,
      patch: Partial<
        Pick<
          Task,
          "title" | "description" | "priority" | "dueDate" | "projectId"
        >
      > & { status?: TaskStatus },
    ) => {
      const saved = await updateTask(taskId, patch);
      setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      return saved;
    },
  );

  const remove = useAsyncAction(async (taskId: string) => {
    await deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  });

  return {
    tasks,
    setTasks,
    loading,
    error,
    reload,
    create,
    update,
    remove,
  };
}
