import type { TimeEntry } from "@packages/domain/index";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useProjectsData } from "./use-projects";
import { useTasksData } from "./use-tasks";
import { useTimeEntriesData } from "./use-time-entries";
import { useWorkspacesData } from "./use-workspaces";

type DbContextValue = {
  workspaces: ReturnType<typeof useWorkspacesData>;
  projects: ReturnType<typeof useProjectsData>;
  tasks: ReturnType<typeof useTasksData>;
  timeEntries: ReturnType<typeof useTimeEntriesData>;
};

const DbContext = createContext<DbContextValue | null>(null);

/** Shared workspaces/projects/tasks/time-entries cache for the whole
 * desktop app — one fetch per entity regardless of how many screens read
 * it. */
export function DbProvider({ children }: { children: ReactNode }) {
  const workspaces = useWorkspacesData();
  const projects = useProjectsData();
  const tasks = useTasksData();
  const timeEntries = useTimeEntriesData();

  const value = useMemo(
    () => ({ workspaces, projects, tasks, timeEntries }),
    [workspaces, projects, tasks, timeEntries],
  );

  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

function useDbContext(): DbContextValue {
  const ctx = useContext(DbContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaces/useProjects/useTasks/useTimeEntries must be used within DbProvider",
    );
  }
  return ctx;
}

export function useWorkspaces() {
  return useDbContext().workspaces;
}

export function useProjects() {
  return useDbContext().projects;
}

export function useTasks() {
  return useDbContext().tasks;
}

export function useTimeEntries() {
  return useDbContext().timeEntries;
}

/** Time entries of the active workspace (lists, stats). The full set stays
 * on `useTimeEntries()` for checks that span workspaces, like overlap
 * detection — time can't overlap across workspaces either. */
export function useWorkspaceEntries(): TimeEntry[] {
  const { entries } = useTimeEntries();
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const { activeWorkspaceId } = useWorkspaces();

  return useMemo(() => {
    if (!activeWorkspaceId) return [];
    const workspaceByProject = new Map(
      projects.map((p) => [p.id, p.workspaceId]),
    );
    const projectByTask = new Map(tasks.map((t) => [t.id, t.projectId]));
    return entries.filter((e) => {
      const projectId =
        e.projectId ?? (e.taskId ? projectByTask.get(e.taskId) : undefined);
      return projectId
        ? workspaceByProject.get(projectId) === activeWorkspaceId
        : false;
    });
  }, [entries, projects, tasks, activeWorkspaceId]);
}
