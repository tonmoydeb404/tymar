"use client";

import { ProjectSelect } from "@/components/selectors/project-select";
import { useTasks } from "@/contexts/app/app-context";
import type { Task, TaskPriority } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
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
  /** Edit target; modal is open whenever this is non-null. */
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function UpdateTaskModal({ task, onOpenChange, onUpdated }: Props) {
  const { update } = useTasks();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setValidationError(null);
    setTitle(task.title);
    setProjectId(task.projectId);
    setPriority(task.priority);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setDescription(task.description ?? "");
  }, [task]);

  const error = validationError || update.error;

  async function handleSave() {
    if (!task) return;
    if (!title.trim() || !projectId) {
      setValidationError("A title and a project are required.");
      return;
    }
    setValidationError(null);
    try {
      await update.run(task.id, {
        title: title.trim(),
        projectId,
        priority,
        dueDate: dueDate || null,
        description: description.trim() || null,
      });
      onOpenChange(false);
      onUpdated();
    } catch {
      // Surfaced via update.error from the hook.
    }
  }

  return (
    <ResponsiveSheet
      open={task !== null}
      onOpenChange={onOpenChange}
      title="Edit task"
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
      <Input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
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
