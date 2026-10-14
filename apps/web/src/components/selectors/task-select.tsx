"use client";

import { useAuth } from "@/lib/auth-context";
import { getTask, queryTasks } from "@/lib/db";
import { useCallback } from "react";
import { AsyncCombobox, type ComboboxOption } from "./async-combobox";

type Props = {
  /** Selected task id, empty string means nothing selected. */
  value: string;
  onValueChange: (taskId: string) => void;
  /** Restrict results to a single project. */
  projectId?: string;
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

  return (
    <AsyncCombobox
      id={id}
      value={value}
      onValueChange={onValueChange}
      search={search}
      resolveLabel={resolveLabel}
      extraOption={extraOption}
      placeholder={placeholder}
      emptyText="No tasks found."
      disabled={disabled}
      className={className}
    />
  );
}
