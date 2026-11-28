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

/** Edge gap kept when clamping a dragged position. */
const EDGE = 8;
/** Pointer travel (px) before a press counts as a drag, not a tap. */
const DRAG_THRESHOLD = 5;

export function TimerFab() {
  const timer = useTimerCtx();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ moved: false, ox: 0, oy: 0, sx: 0, sy: 0 });

  /** Keeps a position fully on screen using the button's real size. */
  function clamp(x: number, y: number) {
    const el = fabRef.current;
    const w = el?.offsetWidth ?? 148;
    const h = el?.offsetHeight ?? 56;
    return {
      x: Math.max(EDGE, Math.min(window.innerWidth - w - EDGE, x)),
      y: Math.max(EDGE, Math.min(window.innerHeight - h - EDGE, y)),
    };
  }

  // A saved position is only restored when it still fits; until the user
  // drags the button it sits in the corner via CSS (safe-area aware).
  useEffect(() => {
    try {
      const saved = localStorage.getItem("timer-fab-pos");
      if (saved) {
        const { x, y } = JSON.parse(saved) as { x: number; y: number };
        setPos(clamp(x, y));
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  // Rotation, window resize and the mobile browser bar changing height can
  // all strand a dragged position off-screen — pull it back in.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = fabRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragState.current = {
      moved: false,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      sx: e.clientX,
      sy: e.clientY,
    };
    el.setPointerCapture(e.pointerId);

    const onMove = (me: PointerEvent) => {
      const d = dragState.current;
      if (
        !d.moved &&
        Math.hypot(me.clientX - d.sx, me.clientY - d.sy) < DRAG_THRESHOLD
      ) {
        return;
      }
      d.moved = true;
      setPos(clamp(me.clientX - d.ox, me.clientY - d.oy));
    };

    const finish = (open: boolean) => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      if (!dragState.current.moved) {
        if (open) setOpen(true);
        return;
      }
      setPos((p) => {
        if (p) localStorage.setItem("timer-fab-pos", JSON.stringify(p));
        return p;
      });
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
  }

  return (
    <>
      <TimerScreen open={open} onClose={() => setOpen(false)} />

      <div
        ref={fabRef}
        className={cn(
          // touch-none: lets a finger drag the button instead of scrolling the
          // page. Until dragged it is pinned to the corner above the iOS
          // home indicator / Android gesture bar.
          "fixed z-40 flex touch-none items-center gap-3 select-none cursor-pointer",
          !pos &&
            "right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6",
          "rounded-full bg-secondary shadow-xl px-5 py-3.5",
          "hover:shadow-2xl hover:scale-105 transition-[shadow,transform] duration-150",
          open && "ring-2 ring-ring",
        )}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
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
