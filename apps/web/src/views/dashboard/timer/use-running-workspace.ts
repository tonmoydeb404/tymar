"use client";

import {
  useCurrentWorkspace,
  useProjects,
  useWorkspaces,
} from "@/contexts/app/app-context";
import { useMemo } from "react";
import { useTimerCtx } from "./timer-context";

/** The workspace the running timer belongs to. The timer is per user, so it
 * keeps running (and showing) whichever workspace this tab is scoped to;
 * `isOther` says it isn't the one currently open. */
export function useRunningWorkspace() {
  const timer = useTimerCtx();
  const { projects } = useProjects();
  const { workspaces } = useWorkspaces();
  const { currentId } = useCurrentWorkspace();

  return useMemo(() => {
    const projectId = timer.activeEntry?.projectId;
    const workspaceId = projectId
      ? (projects.find((p) => p.id === projectId)?.workspaceId ?? null)
      : null;
    const workspace = workspaceId
      ? (workspaces.find((w) => w.id === workspaceId) ?? null)
      : null;
    return {
      workspace,
      isOther: workspace !== null && workspace.id !== currentId,
    };
  }, [timer.activeEntry, projects, workspaces, currentId]);
}
