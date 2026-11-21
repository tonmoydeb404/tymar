"use client";

import { useAuth } from "@/lib/auth-context";
import { createTask, getTask, queryTasks } from "@/lib/db";
import { useCallback } from "react";
import { AsyncCombobox, type ComboboxOption } from "./async-combobox";
import type { Task } from "@packages/domain/index";

type Props = {
  /** Selected task id, empty string means nothing selected. */
  value: string;
  onValueChange: (taskId: string) => void;
  /** Restrict results to a single project. */
  projectId?: string;
  /** Enables the inline `Create "…"` row (requires projectId). */
  onCreate?: (title: string) => Promise<Task>;
  /** A pinned option (e.g. "All tasks") always shown above the search results. */
  extraOption?: ComboboxOption;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
};

/** Async, debounced task picker backed by `queryTasks`. */
export function TaskSelect({
  value,
  onValueChange,
  projectId,
  onCreate,
  extraOption,
  disabled,
  placeholder = "Search tasks…",
  className,
  id,
}: Props) {
  const { user } = useAuth();

  const search = useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      if (!user) return [];
      const { tasks } = await queryTasks(user.id, {
        search: query,
        projectId,
        limit: 20,
      });
      return tasks.map((t) => ({ value: t.id, label: t.title }));
    },
    [user, projectId],
  );

  const resolveLabel = useCallback(
    async (taskId: string): Promise<ComboboxOption | null> => {
      const task = await getTask(taskId);
      return task ? { value: task.id, label: task.title } : null;
    },
    [],
  );

  const handleCreate = useCallback(
    async (title: string): Promise<ComboboxOption> => {
      if (!user || !projectId) throw new Error("Pick a project first.");
      const task = await createTask(user.id, { projectId, title });
      return { value: task.id, label: task.title };
    },
    [user, projectId],
  );

  return (
    <AsyncCombobox
      id={id}
      value={value}
      onValueChange={onValueChange}
      search={search}
      resolveLabel={resolveLabel}
      onCreate={projectId && onCreate ? handleCreate : undefined}
      extraOption={extraOption}
      placeholder={placeholder}
      emptyText="No tasks found."
      disabled={disabled}
      className={className}
    />
  );
}
