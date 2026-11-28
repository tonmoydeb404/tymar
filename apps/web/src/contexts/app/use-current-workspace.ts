"use client";

import { useAuth } from "@/lib/auth-context";
import type { Workspace } from "@packages/domain/index";
import { useCallback, useEffect, useMemo, useState } from "react";

const storageKey = (userId: string) => `tymar:workspace:v1:${userId}`;

function readStored(userId: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null; // storage blocked — fall back to the first workspace
  }
}

function writeStored(userId: string, id: string) {
  try {
    localStorage.setItem(storageKey(userId), id);
  } catch {
    // Persisting is best-effort.
  }
}

/** The workspace the whole dashboard is scoped to. Remembered in
 * localStorage per user; when nothing valid is remembered (first visit, or
 * the saved one was archived/deleted) the first active workspace wins. */
export function useCurrentWorkspaceData(workspaces: Workspace[]) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [storedId, setStoredId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStoredId(userId ? readStored(userId) : null);
    setHydrated(true);
  }, [userId]);

  const available = useMemo(
    () => workspaces.filter((w) => w.status === "ACTIVE" && !w.deletedAt),
    [workspaces],
  );

  const current = useMemo(
    () => available.find((w) => w.id === storedId) ?? available[0] ?? null,
    [available, storedId],
  );

  const setCurrentId = useCallback(
    (id: string) => {
      setStoredId(id);
      if (userId) writeStored(userId, id);
    },
    [userId],
  );

  return {
    /** Active workspaces the user can switch between. */
    available,
    current,
    currentId: current?.id ?? null,
    setCurrentId,
    /** False until the saved choice has been read from storage. */
    hydrated,
  };
}
