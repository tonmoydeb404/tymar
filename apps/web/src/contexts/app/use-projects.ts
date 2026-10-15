import { useAuth } from "@/lib/auth-context";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
  type ProjectInput,
} from "@/lib/db";
import { createSupabaseClient } from "@/lib/supabase";
import { useAsyncAction } from "@/lib/use-async-action";
import { TABLES, type Project, type ProjectStatus } from "@packages/domain/index";
import { useCallback, useEffect, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProject(row: Record<string, any>): Project {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    userId: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    status: (row.status as ProjectStatus) ?? "ACTIVE",
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
  };
}

/** Full project set (all statuses, incl. soft-deleted) — consumers filter locally. */
export function useProjectsData() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [projects, setProjects] = useState<Project[]>([]);

  const {
    run: reload,
    isLoading: loading,
    error,
  } = useAsyncAction(
    useCallback(async () => {
      if (!userId) return;
      setProjects(await listProjects(userId, true, true));
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
      .channel(`projects-rt-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLES.projects,
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) setProjects((prev) => prev.filter((p) => p.id !== id));
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          if (!row?.id) return;
          const item = rowToProject(row);
          setProjects((prev) => {
            const exists = prev.some((p) => p.id === item.id);
            return exists
              ? prev.map((p) => (p.id === item.id ? item : p))
              : [item, ...prev];
          });
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
  }, [userId]);

  const create = useAsyncAction(async (input: ProjectInput) => {
    if (!userId) throw new Error("Not signed in.");
    const saved = await createProject(userId, input);
    setProjects((prev) => [saved, ...prev]);
    return saved;
  });

  const update = useAsyncAction(
    async (
      projectId: string,
      patch: Partial<ProjectInput & { status: ProjectStatus }>,
    ) => {
      const saved = await updateProject(projectId, patch);
      setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      return saved;
    },
  );

  const remove = useAsyncAction(async (projectId: string) => {
    if (!userId) throw new Error("Not signed in.");
    await deleteProject(userId, projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  });

  return {
    projects,
    setProjects,
    loading,
    error,
    reload,
    create,
    update,
    remove,
  };
}
