"use client";

import { useAuth } from "@/lib/auth-context";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  updateWorkspace,
  type WorkspaceInput,
} from "@/lib/db";
import { createSupabaseClient } from "@/lib/supabase";
import { useAsyncAction } from "@/lib/use-async-action";
import {
  TABLES,
  type Workspace,
  type WorkspaceStatus,
} from "@packages/domain/index";
import { useCallback, useEffect, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToWorkspace(row: Record<string, any>): Workspace {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    userId: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    status: (row.status as WorkspaceStatus) ?? "ACTIVE",
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
  };
}

/** Full workspace set (all statuses, incl. soft-deleted) — consumers filter
 * locally. Workspaces group projects; the timer app picks among them. */
export function useWorkspacesData() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!userId) return;
      setWorkspaces(await listWorkspaces(userId));
    }, [userId]),
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live updates from Supabase — keeps other tabs and devices in sync.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const sb = createSupabaseClient();
    const channel = sb
      .channel(`workspaces-rt-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLES.workspaces,
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) setWorkspaces((prev) => prev.filter((w) => w.id !== id));
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          if (!row?.id) return;
          const item = rowToWorkspace(row);
          setWorkspaces((prev) => {
            const exists = prev.some((w) => w.id === item.id);
            return exists
              ? prev.map((w) => (w.id === item.id ? item : w))
              : [...prev, item];
          });
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
  }, [userId]);

  const create = useAsyncAction(async (input: WorkspaceInput) => {
    if (!userId) throw new Error("Not signed in.");
    const saved = await createWorkspace(userId, input);
    setWorkspaces((prev) => [...prev, saved]);
    return saved;
  });

  const update = useAsyncAction(
    async (
      workspaceId: string,
      patch: Partial<WorkspaceInput & { status: WorkspaceStatus }>,
    ) => {
      const saved = await updateWorkspace(workspaceId, patch);
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === saved.id ? saved : w)),
      );
      return saved;
    },
  );

  const remove = useAsyncAction(async (workspaceId: string) => {
    if (!userId) throw new Error("Not signed in.");
    await deleteWorkspace(userId, workspaceId);
    setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
  });

  return {
    workspaces,
    setWorkspaces,
    loading,
    error,
    reload,
    create,
    update,
    remove,
  };
}
