"use client";

import { Button } from "@packages/ui/components/button";
import { ArrowLeftRight, Coffee, Play, Square } from "lucide-react";
import { motion } from "framer-motion";
import type { WebTimerState } from "./use-web-timer";

type Props = Pick<WebTimerState, "status" | "busy" | "stop" | "takeBreak" | "resume"> & {
  onStart: () => void;
  onSwitch?: () => void;
};

const MotionButton = motion.create(Button);

const tapSwitch = { scale: 0.88, rotate: -8 };
const tapBreak  = { scale: 0.90 };
const tapResume = { scale: 1.08 };
const tapStop   = { scale: 0.86 };
const spring    = { type: "spring", stiffness: 500, damping: 22 } as const;

export function TimerControls({ status, busy, onStart, stop, takeBreak, resume, onSwitch }: Props) {
  if (status === "IDLE") {
    return (
      <MotionButton
        size="lg"
        className="min-w-36 h-12 text-base"
        disabled={busy}
        onClick={onStart}
        whileTap={{ scale: 0.94 }}
        transition={spring}
      >
        Start timer
      </MotionButton>
    );
  }

  if (status === "WORKING") {
    return (
      <div className="flex gap-2.5">
        <MotionButton
          size="lg"
          variant="outline"
          className="h-12 gap-2"
          disabled={busy}
          onClick={onSwitch}
          whileTap={tapSwitch}
          transition={spring}
        >
          <ArrowLeftRight className="size-4" />
          Switch
        </MotionButton>
        <MotionButton
          size="lg"
          variant="outline"
          className="h-12 gap-2"
          disabled={busy}
          onClick={() => void takeBreak()}
          whileTap={tapBreak}
          transition={spring}
        >
          <Coffee className="size-4" />
          Break
        </MotionButton>
        <MotionButton
          size="lg"
          variant="destructive"
          className="h-12 gap-2"
          disabled={busy}
          onClick={() => void stop()}
          whileTap={tapStop}
          transition={spring}
        >
          <Square className="size-4 fill-current" />
          Stop
        </MotionButton>
      </div>
    );
  }

  // BREAK
  return (
    <div className="flex gap-2.5">
      <MotionButton
        size="lg"
        variant="outline"
        className="h-12 gap-2"
        disabled={busy}
        onClick={onSwitch}
        whileTap={tapSwitch}
        transition={spring}
      >
        <ArrowLeftRight className="size-4" />
        Switch
      </MotionButton>
      <MotionButton
        size="lg"
        className="h-12 gap-2"
        disabled={busy}
        onClick={() => void resume()}
        whileTap={tapResume}
        transition={spring}
      >
        <Play className="size-4 fill-current" />
        Resume
      </MotionButton>
      <MotionButton
        size="lg"
        variant="destructive"
        className="h-12 gap-2"
        disabled={busy}
        onClick={() => void stop()}
        whileTap={tapStop}
        transition={spring}
      >
        <Square className="size-4 fill-current" />
        Stop
      </MotionButton>
    </div>
  );
}
