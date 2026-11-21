"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useProjectsData } from "./use-projects";
import { useTasksData } from "./use-tasks";
import { useTimeEntriesData } from "./use-time-entries";
import { useWorkspacesData } from "./use-workspaces";

type AppDataContextValue = {
  workspaces: ReturnType<typeof useWorkspacesData>;
  projects: ReturnType<typeof useProjectsData>;
  tasks: ReturnType<typeof useTasksData>;
  timeEntries: ReturnType<typeof useTimeEntriesData>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

/** Shared workspaces/projects/tasks/time-entries state for the whole
 * dashboard app. */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const workspaces = useWorkspacesData();
  const projects = useProjectsData();
  const tasks = useTasksData();
  const timeEntries = useTimeEntriesData();

  const value = useMemo(
    () => ({ workspaces, projects, tasks, timeEntries }),
    [workspaces, projects, tasks, timeEntries],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

function useAppDataContext(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaces/useProjects/useTasks/useTimeEntries must be used within AppDataProvider",
    );
  }
  return ctx;
}

export function useWorkspaces() {
  return useAppDataContext().workspaces;
}

export function useProjects() {
  return useAppDataContext().projects;
}

export function useTasks() {
  return useAppDataContext().tasks;
}

export function useTimeEntries() {
  return useAppDataContext().timeEntries;
}
