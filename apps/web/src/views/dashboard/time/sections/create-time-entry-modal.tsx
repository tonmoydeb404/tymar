"use client";

import { ProjectSelect } from "@/components/selectors/project-select";
import { TaskSelect } from "@/components/selectors/task-select";
import { useTasks, useTimeEntries } from "@/contexts/app/app-context";
import type { EntryType, TimeInterval } from "@packages/domain/index";
import { findOverlap } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { DateTimePicker } from "@packages/ui/components/date-time-picker";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { FieldControl, SelectField } from "@packages/ui/fields/core";
import { useEffect, useMemo, useState } from "react";
import { localInputToIso } from "../lib/time-input";

const TYPE_OPTIONS = [
  { value: "WORK", label: "Work" },
  { value: "BREAK", label: "Break" },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

// "Log time" modal — same fields as the desktop app: the project search is
// scoped to the current workspace, project is required, task is optional (inline "Create"
// supported), and entries that would overlap the running timer or another
// existing entry are rejected.
export function CreateTimeEntryModal({ open, onOpenChange, onCreated }: Props) {
  const { create } = useTimeEntries();
  const { create: createTask } = useTasks();
  const { timeEntries } = useTimeEntries();
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [type, setType] = useState<EntryType>("WORK");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValidationError(null);
    setProjectId("");
    setTaskId("");
    setType("WORK");
    setStart("");
    setEnd("");
  }, [open]);

  // Existing entries + any open entry behave exactly like the desktop's
  // conflict list for overlap validation.
  const conflicts = useMemo<TimeInterval[]>(
    () =>
      timeEntries.map((e) => ({ startedAt: e.startedAt, endedAt: e.endedAt })),
    [timeEntries],
  );

  async function handleQuickAdd(project: string, title: string) {
    return createTask.run({ projectId: project, title });
  }

  const error = validationError || create.error;

  async function handleSave() {
    if (!projectId) {
      setValidationError("Pick a project to continue.");
      return;
    }
    const startedAt = localInputToIso(start);
    if (!startedAt) {
      setValidationError("Start time is invalid.");
      return;
    }
    const endedAt = localInputToIso(end);
    if (end && !endedAt) {
      setValidationError("End time is invalid.");
      return;
    }
    if (
      endedAt &&
      new Date(endedAt).getTime() <= new Date(startedAt).getTime()
    ) {
      setValidationError("End must be after start.");
      return;
    }
    if (!endedAt && conflicts.some((c) => c.endedAt === null)) {
      setValidationError(
        "A timer or entry is already running — stop it before adding another open entry.",
      );
      return;
    }
    if (findOverlap({ startedAt, endedAt }, conflicts)) {
      setValidationError("This overlaps the running timer or another entry.");
      return;
    }
    setValidationError(null);
    try {
      await create.run({
        taskId: taskId || null,
        projectId,
        type,
        startedAt,
        endedAt,
      });
      onOpenChange(false);
      onCreated();
    } catch {
      // Surfaced via create.error from the hook.
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      variant="dialog"
      title="Log time"
      description="Timestamps are edited — duration is always derived from them. Leave end blank to log an open (still running) entry."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={create.isLoading}>
            {create.isLoading ? "Saving…" : "Log time"}
          </Button>
        </>
      }
    >
      <FieldControl label="Project" htmlFor="entry-project" required>
        <ProjectSelect
          id="entry-project"
          value={projectId}
          onValueChange={(id) => {
            setProjectId(id);
            setTaskId("");
          }}
          placeholder="Pick a project"
          className="w-full"
        />
      </FieldControl>
      <FieldControl label="Task" htmlFor="entry-task">
        <TaskSelect
          id="entry-task"
          value={taskId}
          onValueChange={setTaskId}
          projectId={projectId || undefined}
          onCreate={projectId ? (title) => handleQuickAdd(projectId, title) : undefined}
          placeholder={projectId ? "No task" : "Pick a project first"}
          className="w-full"
        />
      </FieldControl>
      <SelectField
        id="entry-type"
        label="Type"
        value={type}
        onValueChange={setType}
        options={TYPE_OPTIONS}
        placeholder="Type"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldControl label="Start" htmlFor="entry-start">
          <DateTimePicker
            id="entry-start"
            title="Start"
            placeholder="Pick start"
            value={start}
            onChange={(iso) => setStart(iso ?? "")}
            toDate={new Date()}
          />
        </FieldControl>
        <FieldControl label="End (optional)" htmlFor="entry-end">
          <DateTimePicker
            id="entry-end"
            title="End"
            placeholder="Still running"
            value={end}
            onChange={(iso) => setEnd(iso ?? "")}
            clearable
            fromDate={start ? new Date(start) : undefined}
          />
        </FieldControl>
      </div>
      <p className="text-xs text-muted-foreground">
        Times use your browser&apos;s timezone; day totals group by your profile
        timezone.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ResponsiveSheet>
  );
}
