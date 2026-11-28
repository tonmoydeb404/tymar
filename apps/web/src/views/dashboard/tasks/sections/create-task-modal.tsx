"use client";

import { ProjectSelect } from "@/components/selectors/project-select";
import { useTasks } from "@/contexts/app/app-context";
import type { TaskPriority } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Input } from "@packages/ui/components/input";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@packages/ui/components/select";
import { Textarea } from "@packages/ui/components/textarea";
import { useEffect, useState } from "react";

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];

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
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <ProjectSelect value={projectId} onValueChange={setProjectId} />
        <Select
          value={priority}
          onValueChange={(v) => setPriority(v as TaskPriority)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DatePicker
        title="Due date"
        placeholder="Due date (optional)"
        value={dueDate}
        onChange={setDueDate}
        clearable
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Details (optional)"
        rows={3}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ResponsiveSheet>
  );
}
