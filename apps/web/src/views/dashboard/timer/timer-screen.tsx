"use client";

import { ProjectSelect } from "@/components/selectors/project-select";
import { TaskSelect } from "@/components/selectors/task-select";
import { useProjects, useTasks } from "@/contexts/app/app-context";
import { Button } from "@packages/ui/components/button";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Coffee, Play, Timer, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useTimerCtx } from "./timer-context";
import { TimerControls } from "./timer-controls";
import { TimerDisplay } from "./timer-display";

type Props = {
  open: boolean;
  onClose: () => void;
};

const STATUS_CONFIG = {
  IDLE:      { Icon: Timer,          color: "text-muted-foreground", label: "Ready to track" },
  WORKING:   { Icon: Play,           color: "text-emerald-500",      label: "Working"        },
  BREAK:     { Icon: Coffee,         color: "text-amber-500",        label: "On a break"     },
  SWITCHING: { Icon: ArrowLeftRight, color: "text-primary",          label: "Switching task" },
} as const;

type DisplayStatus = keyof typeof STATUS_CONFIG;

function StatusIcon({ status }: { status: DisplayStatus }) {
  const { Icon, color, label } = STATUS_CONFIG[status];
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        className={`flex items-center gap-2 ${color}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <Icon className="size-4 fill-current" />
        <span className="text-xs font-semibold tracking-widest uppercase">{label}</span>
      </motion.div>
    </AnimatePresence>
  );
}

type BlobDef = {
  style: React.CSSProperties;
  drift: { x: string[]; y: string[]; scale: number[] };
  duration: number;
};

const BLOBS: BlobDef[] = [
  {
    style: {
      width: "55vw", height: "55vw", top: "-15vw", left: "-10vw",
      background: "radial-gradient(circle, color-mix(in oklch, var(--color-primary) 35%, transparent) 0%, transparent 70%)",
    },
    drift: { x: ["0%", "3%", "-2%", "2%"], y: ["0%", "4%", "2%", "-3%"], scale: [1, 1.06, 0.97, 1.04] },
    duration: 12,
  },
  {
    style: {
      width: "40vw", height: "40vw", bottom: "-8vw", right: "-5vw",
      background: "radial-gradient(circle, color-mix(in oklch, var(--color-primary) 25%, transparent) 0%, transparent 70%)",
    },
    drift: { x: ["0%", "-4%", "2%", "-2%"], y: ["0%", "-3%", "-2%", "3%"], scale: [1, 1.08, 0.95, 1.05] },
    duration: 15,
  },
  {
    style: {
      width: "28vw", height: "28vw", top: "30%", right: "5%",
      background: "radial-gradient(circle, color-mix(in oklch, var(--color-primary) 18%, transparent) 0%, transparent 65%)",
    },
    drift: { x: ["0%", "-5%", "4%"], y: ["0%", "5%", "-4%"], scale: [1, 1.12, 0.92] },
    duration: 18,
  },
];

export function TimerScreen({ open, onClose }: Props) {
  const timer = useTimerCtx();
  const { projects } = useProjects();
  const { tasks } = useTasks();

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");

  const [switching, setSwitching] = useState(false);
  const [switchProjectId, setSwitchProjectId] = useState("");
  const [switchTaskId, setSwitchTaskId] = useState("");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (switching) setSwitching(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, switching]);

  useEffect(() => {
    if (timer.status === "IDLE") setSwitching(false);
  }, [timer.status]);

  const activeTask = useMemo(
    () => timer.activeEntry?.taskId
      ? (tasks.find((t) => t.id === timer.activeEntry!.taskId) ?? null)
      : null,
    [timer.activeEntry, tasks],
  );
  const activeProject = useMemo(
    () => timer.activeEntry?.projectId
      ? (projects.find((p) => p.id === timer.activeEntry!.projectId) ?? null)
      : null,
    [timer.activeEntry, projects],
  );

  function handleStart() {
    void timer.start(selectedTaskId || null, selectedProjectId || null);
  }

  function openSwitcher() {
    setSwitchProjectId(timer.activeEntry?.projectId ?? "");
    setSwitchTaskId(timer.activeEntry?.taskId ?? "");
    setSwitching(true);
  }

  function handleSwitch() {
    void timer.switchTo(switchTaskId || null, switchProjectId || null)
      .then(() => setSwitching(false));
  }

  const contentSpring = { type: "spring", stiffness: 360, damping: 32 } as const;

  return (
    // Always mounted — pointerEvents controlled directly from `open` (no stale closure)
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/88 backdrop-blur-xl"
      style={{ pointerEvents: open ? "auto" : "none" }}
      animate={{ opacity: open ? 1 : 0 }}
      initial={false}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      {/* Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {BLOBS.map((blob, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full blur-[80px]"
            style={blob.style}
            animate={open
              ? { opacity: 1, scale: blob.drift.scale, x: blob.drift.x, y: blob.drift.y }
              : { opacity: 0, scale: 0.75 }
            }
            transition={open
              ? {
                  opacity: { duration: 0.4 },
                  scale: { duration: blob.duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                  x: { duration: blob.duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                  y: { duration: blob.duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                }
              : { duration: 0.3 }
            }
          />
        ))}
      </div>

      {/* Close */}
      <motion.div
        className="absolute top-5 right-5 z-10"
        animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.8 }}
        transition={{ delay: open ? 0.1 : 0, ...contentSpring }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="size-5" />
          <span className="sr-only">Close timer</span>
        </Button>
      </motion.div>

      {/* Content — slides up on open, down on close */}
      <motion.div
        layout
        className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-6"
        animate={{ opacity: open ? 1 : 0, y: open ? 0 : 28 }}
        transition={{ delay: open ? 0.06 : 0, layout: { type: "spring", stiffness: 340, damping: 30 }, ...contentSpring }}
      >
        {/* Status */}
        <StatusIcon status={switching ? "SWITCHING" : timer.status} />

        {/* Timer display */}
        <TimerDisplay elapsedMs={timer.elapsedMs} size="lg" />

        {/* IDLE: selectors */}
        <AnimatePresence mode="wait">
          {timer.status === "IDLE" && (
            <motion.div
              key="idle-selectors"
              layout
              className="grid w-full gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <ProjectSelect
                value={selectedProjectId}
                onValueChange={(id) => { setSelectedProjectId(id); setSelectedTaskId(""); }}
                placeholder="Project (optional)"
              />
              <TaskSelect
                value={selectedTaskId}
                onValueChange={setSelectedTaskId}
                projectId={selectedProjectId || undefined}
                placeholder="Task (optional)"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active context label */}
        <AnimatePresence>
          {timer.activeEntry && timer.status !== "IDLE" && !switching && (
            <motion.p
              key="active-context"
              layout
              className="text-sm text-muted-foreground text-center truncate max-w-xs"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {activeTask ? activeTask.title : activeProject ? activeProject.name : "No task"}
              {activeProject && activeTask && (
                <span className="opacity-60"> · {activeProject.name}</span>
              )}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Switch selectors */}
        <AnimatePresence>
          {switching && (
            <motion.div
              key="switch-selectors"
              layout
              className="grid w-full gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <ProjectSelect
                value={switchProjectId}
                onValueChange={(id) => { setSwitchProjectId(id); setSwitchTaskId(""); }}
                placeholder="Project (optional)"
              />
              <TaskSelect
                value={switchTaskId}
                onValueChange={setSwitchTaskId}
                projectId={switchProjectId || undefined}
                placeholder="Task (optional)"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSwitching(false)} disabled={timer.busy}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSwitch} disabled={timer.busy}>
                  Switch
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <AnimatePresence>
          {!switching && (
            <motion.div
              key="controls"
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <TimerControls
                status={timer.status}
                busy={timer.busy}
                onStart={handleStart}
                onSwitch={openSwitcher}
                stop={timer.stop}
                takeBreak={timer.takeBreak}
                resume={timer.resume}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
