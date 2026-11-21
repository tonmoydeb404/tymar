import { useApp } from "@/context/app-context";
import { listWorkspaces } from "@/lib/db";
import { onDataPulled } from "@/lib/sync-bus";
import { useAsyncAction } from "@/lib/use-async-action";
import type { Workspace } from "@packages/domain/index";
import { useCallback, useEffect, useState } from "react";

/** Full workspace set (all statuses, non-deleted) — consumers filter
 * locally. Workspaces are managed on the web dashboard; the desktop reads
 * them for the timer's workspace selector. */
export function useWorkspacesData() {
  const { auth } = useApp();
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

  return { workspaces, loading, error, reload };
}
