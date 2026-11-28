"use client";

import { ProjectSelect } from "@/components/selectors/project-select";
import { useTasks } from "@/contexts/app/app-context";
import type { TaskPriority } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { DatePicker } from "@packages/ui/components/date-picker";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import {
  FieldControl,
  SelectField,
  TextField,
  TextareaField,
} from "@packages/ui/fields/core";
import { useEffect, useState } from "react";

const PRIORITY_OPTIONS = (["LOW", "MEDIUM", "HIGH"] as const).map((p) => ({
  value: p,
  label: p.charAt(0) + p.slice(1).toLowerCase(),
}));

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateTaskModal({ open, onOpenChange, onCreated }: Props) {
  const { create } = useTasks();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValidationError(null);
    setTitle("");
    setProjectId("");
    setPriority("MEDIUM");
    setDueDate("");
    setDescription("");
  }, [open]);

  const error = validationError || create.error;

  async function handleSave() {
    if (!title.trim() || !projectId) {
      setValidationError("A title and a project are required.");
      return;
    }
    setValidationError(null);
    try {
      await create.run({
        title: title.trim(),
        projectId,
        priority,
        dueDate: dueDate || null,
        description: description.trim() || null,
      });
      onOpenChange(false);
      onCreated();
    } catch {
      // Surfaced via create.error from the hook.
    }
  }

  return (
    <ResponsiveSheet
      variant="dialog"
      open={open}
      onOpenChange={onOpenChange}
      title="New task"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={create.isLoading}>
            {create.isLoading ? "Creating…" : "Create task"}
          </Button>
        </>
      }
    >
      <TextField
        id="new-task-title"
        label="Title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldControl label="Project" htmlFor="new-task-project" required>
          <ProjectSelect
            id="new-task-project"
            value={projectId}
            onValueChange={setProjectId}
            className="w-full"
          />
        </FieldControl>
        <SelectField
          id="new-task-priority"
          label="Priority"
          value={priority}
          onValueChange={setPriority}
          options={PRIORITY_OPTIONS}
          placeholder="Priority"
        />
      </div>
      <FieldControl label="Due date" htmlFor="new-task-due">
        <DatePicker
          id="new-task-due"
          title="Due date"
          placeholder="Due date (optional)"
          value={dueDate}
          onChange={setDueDate}
          clearable
        />
      </FieldControl>
      <TextareaField
        id="new-task-description"
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Details (optional)"
        rows={3}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ResponsiveSheet>
  );
}
