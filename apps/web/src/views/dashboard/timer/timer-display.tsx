"use client";

import { useEffect, useRef, useState } from "react";

const ANIM_OPTS = {
  duration: 300,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

// Single digit cell — slides previous value out upward, new value in from below.
function Digit({ value }: { value: number }) {
  const [prev, setPrev] = useState(value);
  const prevRef = useRef<HTMLSpanElement>(null);
  const nextRef = useRef<HTMLSpanElement>(null);
  const animsRef = useRef<Animation[]>([]);

  useEffect(() => {
    if (value === prev) return;
    animsRef.current.forEach((a) => a.cancel());

    const p = prevRef.current;
    const n = nextRef.current;
    if (!p || !n) { setPrev(value); return; }

    // prevRef rests at translateY(-100%) hidden above.
    // The animation keyframe brings it to 0% (visible) then exits to -100%.
    // nextRef rests at translateY(0%) visible.
    // The animation keyframe starts it at 100% (below) then slides to 0%.
    const anims: Animation[] = [
      p.animate(
        [{ transform: "translateY(0%)" }, { transform: "translateY(-100%)" }],
        ANIM_OPTS,
      ),
      n.animate(
        [{ transform: "translateY(100%)" }, { transform: "translateY(0%)" }],
        ANIM_OPTS,
      ),
    ];
    animsRef.current = anims;
    anims[0]!.addEventListener("finish", () => setPrev(value));

    return () => anims.forEach((a) => a.cancel());
  }, [value, prev]);

  return (
    <span
      className="relative inline-block overflow-hidden tabular-nums"
      style={{ width: "0.58em", height: "1em" }}
    >
      {/* Previous digit — rests hidden above */}
      <span
        ref={prevRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: "translateY(-100%)" }}
      >
        {prev}
      </span>
      {/* Current digit — rests visible */}
      <span
        ref={nextRef}
        className="absolute inset-0 flex items-center justify-center"
      >
        {value}
      </span>
    </span>
  );
}

type Props = { elapsedMs: number; size?: "md" | "lg" };

export function TimerDisplay({ elapsedMs, size = "lg" }: Props) {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const textSize = size === "lg" ? "text-8xl" : "text-4xl";
  const sepClass = `font-bold font-mono text-muted-foreground leading-none ${textSize}`;

  return (
    <div
      className={`flex items-center font-bold font-mono text-foreground select-none ${textSize}`}
    >
      <Digit value={Math.floor(hours / 10)} />
      <Digit value={hours % 10} />
      <span className={sepClass}>:</span>
      <Digit value={Math.floor(minutes / 10)} />
      <Digit value={minutes % 10} />
      <span className={sepClass}>:</span>
      <Digit value={Math.floor(seconds / 10)} />
      <Digit value={seconds % 10} />
    </div>
  );
}
