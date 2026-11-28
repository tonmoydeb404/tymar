"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useCurrentWorkspaceData } from "./use-current-workspace";
import { useProjectsData } from "./use-projects";
import { useTasksData } from "./use-tasks";
import { useTimeEntriesData } from "./use-time-entries";
import { useWorkspacesData } from "./use-workspaces";

type AppDataContextValue = {
  workspaces: ReturnType<typeof useWorkspacesData>;
  currentWorkspace: ReturnType<typeof useCurrentWorkspaceData>;
  projects: ReturnType<typeof useProjectsData>;
  tasks: ReturnType<typeof useTasksData>;
  timeEntries: ReturnType<typeof useTimeEntriesData>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

/** Shared workspaces/projects/tasks/time-entries state for the whole
 * dashboard app. */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const workspaces = useWorkspacesData();
  const currentWorkspace = useCurrentWorkspaceData(workspaces.workspaces);
  const projects = useProjectsData();
  const tasks = useTasksData();
  const timeEntries = useTimeEntriesData();

  const value = useMemo(
    () => ({ workspaces, currentWorkspace, projects, tasks, timeEntries }),
    [workspaces, currentWorkspace, projects, tasks, timeEntries],
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

/** The workspace the dashboard is scoped to, plus the switcher's options. */
export function useCurrentWorkspace() {
  return useAppDataContext().currentWorkspace;
}

/**
 * Everything a page needs to scope its queries to the current workspace.
 * `projectIds` is `null` until the workspace and its projects have loaded —
 * hooks should wait for it rather than query unscoped. Includes archived and
 * deleted projects so historical time stays visible.
 */
export function useWorkspaceScope() {
  const { current, currentId, hydrated } = useCurrentWorkspace();
  const { projects, loading: projectsLoading } = useProjects();
  const { loading: workspacesLoading } = useWorkspaces();
  const [loadedOnce, setLoadedOnce] = useState(false);

  const settled = !workspacesLoading && !projectsLoading;
  useEffect(() => {
    if (settled) setLoadedOnce(true);
  }, [settled]);

  // Keyed by content so project refreshes that change nothing don't make
  // dependent hooks refetch.
  const scopeKey =
    currentId && hydrated && loadedOnce
      ? projects
          .filter((p) => p.workspaceId === currentId)
          .map((p) => p.id)
          .sort()
          .join(",")
      : null;
  const projectIds = useMemo(
    () => (scopeKey === null ? null : scopeKey.split(",").filter(Boolean)),
    [scopeKey],
  );

  return { workspace: current, workspaceId: currentId, projectIds, scopeKey };
}
