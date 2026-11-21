import { SessionFields } from "@/components/session-fields";
import type { EntryType, Task, TimeInterval } from "@packages/domain/index";
import { findOverlap } from "@packages/domain/index";
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

const TYPES: EntryType[] = ["WORK", "BREAK"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  /** Workspace preselected from the home screen ("" = all). */
  initialWorkspaceId?: string;
  onQuickAdd: (projectId: string, title: string) => Promise<Task>;
  /** Existing entries + the running timer (if any), used to reject overlaps. */
  conflicts: TimeInterval[];
  onSubmit: (input: {
    projectId: string | null;
    taskId: string | null;
    type: EntryType;
    startedAt: string;
    endedAt: string | null;
  }) => Promise<void>;
};

// Manual "add time entry" sheet — project is required, task and end time
// are optional (an entry left open behaves like a running timer). Rejects
// entries that would overlap the running timer or another existing entry.
export function ManualEntrySheet({
  open,
  onOpenChange,
  busy,
  initialWorkspaceId,
  onQuickAdd,
  conflicts,
  onSubmit,
}: Props) {
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [type, setType] = useState<EntryType>("WORK");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWorkspaceId(initialWorkspaceId ?? "");
    setProjectId(null);
    setTaskId(null);
    setType("WORK");
    setStart("");
    setEnd("");
    setError(null);
  }, [open, initialWorkspaceId]);

  async function handleSubmit() {
    if (!projectId) return setError("Pick a project to continue.");
    const startedAt = start ? new Date(start).toISOString() : null;
    const endedAt = end ? new Date(end).toISOString() : null;
    if (!startedAt) return setError("Start time is invalid.");
    if (endedAt && new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
      return setError("End must be after start.");
    }
    if (!endedAt && conflicts.some((c) => c.endedAt === null)) {
      return setError(
        "A timer or entry is already running — stop it before adding another open entry.",
      );
    }
    if (findOverlap({ startedAt, endedAt }, conflicts)) {
      return setError("This overlaps the running timer or another entry.");
    }
    setError(null);
    await onSubmit({ projectId, taskId, type, startedAt, endedAt });
    onOpenChange(false);
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add manual entry"
      description="A project is required — task and end time are optional. Leave end blank to add an open (still running) entry."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy}>
            Save entry
          </Button>
        </>
      }
    >
      <SessionFields
        workspaceId={workspaceId}
        projectId={projectId}
        taskId={taskId}
        onWorkspaceChange={setWorkspaceId}
        onProjectChange={(id) => setProjectId(id)}
        onTaskChange={(id) => setTaskId(id)}
        onQuickAdd={onQuickAdd}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="manual-entry-type">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
          <SelectTrigger id="manual-entry-type" className="w-full">
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
          <Label htmlFor="manual-entry-start">Start</Label>
          <Input
            id="manual-entry-start"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="manual-entry-end">End (optional)</Label>
          <Input
            id="manual-entry-end"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </ResponsiveSheet>
  );
}

