"use client";

import { useCallback, useEffect, useState } from "react";

export type TasksView = "list" | "board";

const STORAGE_KEY = "tymar:tasks-view:v1";

function isTasksView(value: unknown): value is TasksView {
  return value === "list" || value === "board";
}

/** The chosen tasks layout, remembered across refreshes. `ready` is false
 * until the saved choice was read, so callers can avoid flashing the wrong
 * layout first. */
export function useTasksView() {
  const [view, setViewState] = useState<TasksView>("list");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isTasksView(saved)) setViewState(saved);
    } catch {
      // Storage blocked — stay on the default.
    }
    setReady(true);
  }, []);

  const setView = useCallback((next: TasksView) => {
    setViewState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persisting is best-effort.
    }
  }, []);

  return { view, setView, ready };
}
