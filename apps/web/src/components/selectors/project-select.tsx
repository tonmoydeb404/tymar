"use client";

import { useAuth } from "@/lib/auth-context";
import { getProject, queryProjects } from "@/lib/db";
import { useCallback } from "react";
import { AsyncCombobox, type ComboboxOption } from "./async-combobox";

type Props = {
  /** Selected project id, empty string means nothing selected. */
  value: string;
  onValueChange: (projectId: string) => void;
  /** A pinned option (e.g. "All projects") always shown above the search results. */
  extraOption?: ComboboxOption;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
};

/** Async, debounced project picker backed by `queryProjects`. */
export function ProjectSelect({
  value,
  onValueChange,
  extraOption,
  disabled,
  placeholder = "Search projects…",
  className,
  id,
}: Props) {
  const { user } = useAuth();

  const search = useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      if (!user) return [];
      const { projects } = await queryProjects(user.id, {
        search: query,
        limit: 20,
      });
      return projects.map((p) => ({ value: p.id, label: p.name }));
    },
    [user],
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
      onValueChange={onValueChange}
      search={search}
      resolveLabel={resolveLabel}
      extraOption={extraOption}
      placeholder={placeholder}
      emptyText="No projects found."
      disabled={disabled}
      className={className}
    />
  );
}
