import { useApp } from "@/context/app-context";
import { getTask, queryTasks } from "@/lib/db";
import type { Task } from "@packages/domain/index";
import { useCallback } from "react";
import { AsyncCombobox, type ComboboxOption } from "./async-combobox";

type Props = {
  /** Selected task id, empty string means nothing selected. */
  value: string;
  onValueChange: (taskId: string, title: string | null) => void;
  /** Restrict results (and creation) to a single project. */
  projectId?: string;
  /** Creates a task from the typed query; enables the inline "Create" option. */
  onCreate?: (title: string) => Promise<Task>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
};

/** Async, debounced task picker backed by `queryTasks`, with an inline
 * create option when `onCreate` is provided. */
export function TaskSelect({
  value,
  onValueChange,
  projectId,
  onCreate,
  disabled,
  placeholder = "Search tasks…",
  className,
  id,
}: Props) {
  const { auth } = useApp();
  const userId = auth?.user?.id ?? null;

  const search = useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      if (!userId) return [];
      const tasks = await queryTasks(userId, { search: query, projectId });
      return tasks.map((t) => ({ value: t.id, label: t.title }));
    },
    [userId, projectId],
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
      if (!projectId || !onCreate) throw new Error("Pick a project first.");
      const task = await onCreate(title);
      return { value: task.id, label: task.title };
    },
    [onCreate, projectId],
  );

  return (
    <AsyncCombobox
      id={id}
      value={value}
      onValueChange={(v, option) => onValueChange(v, option?.label ?? null)}
      search={search}
      resolveLabel={resolveLabel}
      onCreate={onCreate && projectId ? handleCreate : undefined}
      searchPlaceholder={onCreate ? "Search or create…" : "Search tasks…"}
      emptyText="No tasks found."
      placeholder={placeholder}
      disabled={disabled || !userId || !projectId}
      className={className}
    />
  );
}
