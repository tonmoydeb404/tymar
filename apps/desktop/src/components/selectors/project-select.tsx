import { useApp } from "@/context/app-context";
import { getProject, queryProjects } from "@/lib/db";
import { useCallback } from "react";
import { AsyncCombobox, type ComboboxOption } from "./async-combobox";

type Props = {
  /** Selected project id, empty string means nothing selected. */
  value: string;
  onValueChange: (projectId: string, name: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
};

/** Async, debounced project picker backed by `queryProjects`. */
export function ProjectSelect({
  value,
  onValueChange,
  disabled,
  placeholder = "Search projects…",
  className,
  id,
}: Props) {
  const { auth } = useApp();
  const userId = auth?.user?.id ?? null;

  const search = useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      if (!userId) return [];
      const projects = await queryProjects(userId, { search: query });
      return projects.map((p) => ({ value: p.id, label: p.name }));
    },
    [userId],
  );

  const resolveLabel = useCallback(
    async (projectId: string): Promise<ComboboxOption | null> => {
      const project = await getProject(projectId);
      return project ? { value: project.id, label: project.name } : null;
    },
    [],
  );

  return (
    <AsyncCombobox
      id={id}
      value={value}
      onValueChange={(v, option) => onValueChange(v, option?.label ?? null)}
      search={search}
      resolveLabel={resolveLabel}
      emptyText="No projects found."
      placeholder={placeholder}
      disabled={disabled || !userId}
      className={className}
    />
  );
}
