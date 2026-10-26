import { useApp } from "@/context/app-context";
import { createTask as createTaskDoc, listTasks } from "@/lib/db";
import { onDataPulled } from "@/lib/sync-bus";
import { useAsyncAction } from "@/lib/use-async-action";
import type { Task } from "@packages/domain/index";
import { useCallback, useEffect, useState } from "react";

/** Full task set (all statuses, non-deleted) — consumers filter locally. */
export function useTasksData() {
  const { auth } = useApp();
  const userId = auth?.user?.id ?? null;
  const [tasks, setTasks] = useState<Task[]>([]);

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!userId) {
        setTasks([]);
        return;
      }
      setTasks(await listTasks(userId));
    }, [userId]),
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // A sync cycle just wrote pulled rows into SQLite — pick them up.
  useEffect(() => onDataPulled(() => void reload()), [reload]);

  const quickAdd = useCallback(
    async (projectId: string, title: string) => {
      if (!userId) throw new Error("You're signed out.");
      const created = await createTaskDoc(userId, projectId, title);
      setTasks((prev) => [created, ...prev]);
      return created;
    },
    [userId],
  );

  return { tasks, loading, error, reload, quickAdd };
}
