"use client";

import { createContext, useContext } from "react";
import { useWebTimer, type WebTimerState } from "./use-web-timer";

const TimerCtx = createContext<WebTimerState | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const timer = useWebTimer();
  return <TimerCtx.Provider value={timer}>{children}</TimerCtx.Provider>;
}

export function useTimerCtx(): WebTimerState {
  const ctx = useContext(TimerCtx);
  if (!ctx) throw new Error("useTimerCtx must be inside TimerProvider");
  return ctx;
}
