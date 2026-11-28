import { useApp } from "@/context/app-context";
import { listWorkspaces } from "@/lib/db";
import { onDataPulled } from "@/lib/sync-bus";
import { useAsyncAction } from "@/lib/use-async-action";
import type { Workspace } from "@packages/domain/index";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Full workspace set (all statuses, non-deleted) — consumers filter
 * locally. Workspaces are managed on the web dashboard; the desktop reads
 * them for the timer's workspace selector. */
export function useWorkspacesData() {
  const { auth, settings, updateSetting } = useApp();
  const userId = auth?.user?.id ?? null;
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!userId) {
        setWorkspaces([]);
        return;
      }
      setWorkspaces(await listWorkspaces(userId));
    }, [userId]),
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // A sync cycle just wrote pulled rows into SQLite — pick them up.
  useEffect(() => onDataPulled(() => void reload()), [reload]);

  // The timer app always works inside exactly one workspace — there is no
  // "all workspaces" view. The choice is persisted; when it is missing or
  // points at a workspace that is gone/archived we fall back to the first
  // active one, so forms can rely on it being set whenever any exists.
  const activeWorkspaces = useMemo(
    () => workspaces.filter((w) => w.status === "ACTIVE" && !w.deletedAt),
    [workspaces],
  );
  const stored = settings.last_workspace_id;
  const activeWorkspaceId =
    activeWorkspaces.find((w) => w.id === stored)?.id ??
    activeWorkspaces[0]?.id ??
    null;
  const setActiveWorkspaceId = useCallback(
    (id: string) => void updateSetting("last_workspace_id", id).catch(() => {}),
    [updateSetting],
  );

  return {
    workspaces,
    activeWorkspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loading,
    error,
    reload,
  };
}
