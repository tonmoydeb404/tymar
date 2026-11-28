"use client";

import { useAuth } from "@/lib/auth-context";
import type { Workspace } from "@packages/domain/index";
import { useCallback, useEffect, useMemo, useState } from "react";

const storageKey = (userId: string) => `tymar:workspace:v1:${userId}`;

/** Tab-local choice (survives reloads, not shared) wins over the last one
 * picked anywhere, which only seeds tabs that haven't chosen yet. */
function readStored(userId: string): string | null {
  const key = storageKey(userId);
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null; // storage blocked — fall back to the first workspace
  }
}

function writeStored(userId: string, id: string) {
  const key = storageKey(userId);
  try {
    sessionStorage.setItem(key, id);
    localStorage.setItem(key, id);
  } catch {
    // Persisting is best-effort.
  }
}

/** The workspace the whole dashboard is scoped to. Each browser tab keeps its
 * own choice, so different tabs can show different workspaces; the most
 * recent pick is also saved per user in localStorage and opens in new tabs.
 * When nothing valid is remembered (first visit, or the saved one was
 * archived/deleted) the first active workspace wins. */
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
