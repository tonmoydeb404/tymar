"use client";

import { ProjectSelect } from "@/components/selectors/project-select";
import { TaskSelect } from "@/components/selectors/task-select";
import { useTimeEntries } from "@/contexts/app/app-context";
import type { EntryType } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@packages/ui/components/select";
import { useEffect, useState } from "react";
import { localInputToIso } from "../lib/time-input";

const TYPES: EntryType[] = ["WORK", "BREAK"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateTimeEntryModal({ open, onOpenChange, onCreated }: Props) {
  const { create } = useTimeEntries();
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

  function handleProjectChange(id: string) {
    setProjectId(id);
    setTaskId("");
  }

  const error = validationError || create.error;

  async function handleSave() {
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
    setValidationError(null);
    try {
      await create.run({
        taskId: taskId || null,
        projectId: projectId || null,
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
      <div className="grid gap-1.5">
        <Label htmlFor="entry-project">Project</Label>
        <ProjectSelect
          id="entry-project"
          value={projectId}
          onValueChange={handleProjectChange}
          placeholder="Project (optional)"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="entry-task">Task</Label>
        <TaskSelect
          id="entry-task"
          value={taskId}
          onValueChange={setTaskId}
          projectId={projectId || undefined}
          placeholder="Task (optional)"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="entry-type">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
          <SelectTrigger id="entry-type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "WORK" ? "Work" : "Break"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="entry-start">Start</Label>
          <Input
            id="entry-start"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="entry-end">End (optional)</Label>
          <Input
            id="entry-end"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Times use your browser&apos;s timezone; day totals group by your profile
        timezone.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ResponsiveSheet>
  );
}
