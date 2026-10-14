"use client";

import { cn } from "@/lib/utils";
import { Coffee, Play, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTimerCtx } from "./timer-context";
import { TimerScreen } from "./timer-screen";

function pad(n: number) {
  return String(Math.floor(n)).padStart(2, "0");
}

function compactTime(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

const STATUS_ICON = {
  IDLE: null,
  WORKING: Play,
  BREAK: Coffee,
} as const;

const STATUS_ICON_COLOR = {
  IDLE: "",
  WORKING: "text-emerald-500",
  BREAK: "text-amber-500",
} as const;

const INITIAL_RIGHT = 24;
const INITIAL_BOTTOM = 24;
const FAB_W = 148;
const FAB_H = 56;

export function TimerFab() {
  const timer = useTimerCtx();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ moved: false, ox: 0, oy: 0 });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("timer-fab-pos");
      if (saved) {
        const { x, y } = JSON.parse(saved) as { x: number; y: number };
        const cx = Math.max(0, Math.min(window.innerWidth - FAB_W, x));
        const cy = Math.max(0, Math.min(window.innerHeight - FAB_H, y));
        setPos({ x: cx, y: cy });
        return;
      }
    } catch {
      // ignore corrupt storage
    }
    setPos({
      x: window.innerWidth - INITIAL_RIGHT - FAB_W,
      y: window.innerHeight - INITIAL_BOTTOM - FAB_H,
    });
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!pos) return;
    dragState.current = { moved: false, ox: e.clientX - pos.x, oy: e.clientY - pos.y };
    fabRef.current?.setPointerCapture(e.pointerId);

    const onMove = (me: PointerEvent) => {
      dragState.current.moved = true;
      const nx = Math.max(0, Math.min(window.innerWidth - FAB_W, me.clientX - dragState.current.ox));
      const ny = Math.max(0, Math.min(window.innerHeight - FAB_H, me.clientY - dragState.current.oy));
      setPos({ x: nx, y: ny });
    };

    const onUp = () => {
      fabRef.current?.removeEventListener("pointermove", onMove);
      fabRef.current?.removeEventListener("pointerup", onUp);
      if (!dragState.current.moved) {
        setOpen(true);
      } else {
        setPos((p) => {
          if (p) localStorage.setItem("timer-fab-pos", JSON.stringify(p));
          return p;
        });
      }
    };

    fabRef.current?.addEventListener("pointermove", onMove);
    fabRef.current?.addEventListener("pointerup", onUp);
  }

  if (!pos) return null;

  return (
    <>
      <TimerScreen open={open} onClose={() => setOpen(false)} />

      <div
        ref={fabRef}
        className={cn(
          "fixed z-40 flex items-center gap-3 select-none cursor-pointer",
          "rounded-full bg-secondary shadow-xl px-5 py-3.5",
          "hover:shadow-2xl hover:scale-105 transition-[shadow,transform] duration-150",
          open && "ring-2 ring-ring",
        )}
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={onPointerDown}
        title="Open timer"
      >
        {(() => {
          const Icon = STATUS_ICON[timer.status];
          return Icon ? (
            <Icon
              className={cn(
                "size-5 shrink-0 fill-current",
                STATUS_ICON_COLOR[timer.status],
                timer.status === "WORKING" && "animate-pulse",
              )}
            />
          ) : (
            <Timer className="size-5 text-secondary-foreground/60 shrink-0" />
          );
        })()}
        {timer.status !== "IDLE" ? (
          <span className="text-base font-mono font-semibold tabular-nums text-secondary-foreground leading-none">
            {compactTime(timer.elapsedMs)}
          </span>
        ) : (
          <span className="text-base font-semibold text-secondary-foreground/70 leading-none">Timer</span>
        )}
      </div>
    </>
  );
}
