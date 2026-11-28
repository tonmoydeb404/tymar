import { SessionFields } from "@/components/session-fields";
import type { Task } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  busy: boolean;
  onQuickAdd: (projectId: string, title: string) => Promise<Task>;
  onSubmit: (input: {
    projectId: string | null;
    projectTitle: string | null;
    taskId: string | null;
    taskTitle: string | null;
  }) => Promise<void>;
};

// Shared sheet for both "Start timer" and "Switch task" — the only
// difference is copy and which timer-context action gets called.
export function StartSessionSheet({
  open,
  onOpenChange,
  title,
  submitLabel,
  busy,
  onQuickAdd,
  onSubmit,
}: Props) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProjectId(null);
    setProjectTitle(null);
    setTaskId(null);
    setTaskTitle(null);
    setError(null);
  }, [open]);

  async function handleSubmit() {
    if (!projectId) {
      setError("Pick a project to continue.");
      return;
    }
    setError(null);
    await onSubmit({ projectId, projectTitle, taskId, taskTitle });
    onOpenChange(false);
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        <span className="text-sm">
          A project is required — task is optional.
        </span>
      }
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="lg" onClick={() => void handleSubmit()} disabled={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <SessionFields
        projectId={projectId}
        taskId={taskId}
        onProjectChange={(id, name) => {
          setProjectId(id);
          setProjectTitle(name);
        }}
        onTaskChange={(id, title) => {
          setTaskId(id);
          setTaskTitle(title);
        }}
        onQuickAdd={onQuickAdd}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </ResponsiveSheet>
  );
}
