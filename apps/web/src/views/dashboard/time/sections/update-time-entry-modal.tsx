"use client";

import { ProjectSelect } from "@/components/selectors/project-select";
import { TaskSelect } from "@/components/selectors/task-select";
import { WorkspaceSelect } from "@/components/selectors/workspace-select";
import {
  useProjects,
  useTasks,
  useTimeEntries,
  useWorkspaces,
} from "@/contexts/app/app-context";
import type { EntryType, TimeInterval, TimeEntry } from "@packages/domain/index";
import { findOverlap } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { DateTimePicker } from "@packages/ui/components/date-time-picker";
import { Label } from "@packages/ui/components/label";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@packages/ui/components/select";
import { useEffect, useMemo, useState } from "react";
import { localInputToIso } from "../lib/time-input";

const TYPES: EntryType[] = ["WORK", "BREAK"];

type Props = {
  /** Edit target; modal is open whenever this is non-null. */
  entry: TimeEntry | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

// "Edit time entry" modal — same fields as the desktop app: workspace
// narrows the project search, project is required, task is optional with
// inline "Create", and saving an entry that overlaps another (excluding
// this one) is rejected.
export function UpdateTimeEntryModal({
  entry,
  onOpenChange,
  onUpdated,
}: Props) {
  const { update, timeEntries } = useTimeEntries();
  const { create: createTask } = useTasks();
  const { workspaces } = useWorkspaces();
  const { projects } = useProjects();
  const hasWorkspaces = workspaces.some(
    (w) => w.status === "ACTIVE" && !w.deletedAt,
  );

  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [type, setType] = useState<EntryType>("WORK");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    setValidationError(null);
    // Scope the project picker to the entry's own workspace (never "all").
    const ownWorkspace = projects.find(
      (p) => p.id === entry.projectId,
    )?.workspaceId;
    setWorkspaceId(
      ownWorkspace ??
        workspaces.find((w) => w.status === "ACTIVE" && !w.deletedAt)?.id ??
        "",
    );
    setProjectId(entry.projectId ?? "");
    setTaskId(entry.taskId ?? "");
    setType(entry.type);
    setStart(entry.startedAt);
    setEnd(entry.endedAt ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  // Same conflict list as the create modal, minus the entry being edited.
  const conflicts = useMemo<TimeInterval[]>(
    () =>
      timeEntries
        .filter((e) => e.id !== entry?.id)
        .map((e) => ({ startedAt: e.startedAt, endedAt: e.endedAt })),
    [timeEntries, entry?.id],
  );

  async function handleQuickAdd(project: string, title: string) {
    return createTask.run({ projectId: project, title });
  }

  const error = validationError || update.error;

  async function handleSave() {
    if (!entry) return;
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
    if (findOverlap({ startedAt, endedAt }, conflicts)) {
      setValidationError("This overlaps the running timer or another entry.");
      return;
    }
    setValidationError(null);
    try {
      await update.run(entry.id, {
        taskId: taskId || null,
        projectId,
        type,
        startedAt,
        endedAt,
      });
      onOpenChange(false);
      onUpdated();
    } catch {
      // Surfaced via update.error from the hook.
    }
  }

  return (
    <ResponsiveSheet
      open={entry !== null}
      onOpenChange={onOpenChange}
      variant="dialog"
      title="Edit time entry"
      description="Timestamps are edited — duration is always derived from them. Leave end blank to make this entry open (still running)."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={update.isLoading}>
            {update.isLoading ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      {hasWorkspaces && (
        <div className="grid gap-1.5">
          <Label htmlFor="edit-entry-workspace">Workspace</Label>
          <WorkspaceSelect
            id="edit-entry-workspace"
            value={workspaceId}
            withAll={false}
            onValueChange={(id) => {
              setWorkspaceId(id);
              setProjectId("");
              setTaskId("");
            }}
            className="w-full"
          />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="edit-entry-project">
          Project <span className="text-destructive">*</span>
        </Label>
        <ProjectSelect
          id="edit-entry-project"
          value={projectId}
          workspaceId={workspaceId || undefined}
          onValueChange={(id) => {
            setProjectId(id);
            setTaskId("");
          }}
          placeholder="Pick a project"
          className="w-full"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-entry-task">Task</Label>
        <TaskSelect
          id="edit-entry-task"
          value={taskId}
          onValueChange={setTaskId}
          projectId={projectId || undefined}
          onCreate={projectId ? (title) => handleQuickAdd(projectId, title) : undefined}
          placeholder={projectId ? "No task" : "Pick a project first"}
          className="w-full"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-entry-type">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
          <SelectTrigger id="edit-entry-type" className="w-full">
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
          <Label htmlFor="edit-entry-start">Start</Label>
          <DateTimePicker
            id="edit-entry-start"
            title="Start"
            placeholder="Pick start"
            value={start}
            onChange={(iso) => setStart(iso ?? "")}
            toDate={new Date()}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="edit-entry-end">End (optional)</Label>
          <DateTimePicker
            id="edit-entry-end"
            title="End"
            placeholder="Still running"
            value={end}
            onChange={(iso) => setEnd(iso ?? "")}
            clearable
            fromDate={start ? new Date(start) : undefined}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ResponsiveSheet>
  );
}
