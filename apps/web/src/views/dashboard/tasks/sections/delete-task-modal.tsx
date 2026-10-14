"use client";

import { useTasks } from "@/contexts/app/app-context";
import type { Task } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";

type Props = {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteTaskModal({ task, onOpenChange, onDeleted }: Props) {
  const { remove } = useTasks();

  async function handleConfirm() {
    if (!task) return;
    try {
      await remove.run(task.id);
      onOpenChange(false);
      onDeleted();
    } catch {
      // Surfaced via remove.error from the hook.
    }
  }

  return (
    <ResponsiveSheet
      open={task !== null}
      onOpenChange={onOpenChange}
      title="Delete this task?"
      description={`“${task?.title}” will be hidden everywhere. Tracked time is kept and can still be reviewed later.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={remove.isLoading}
          >
            {remove.isLoading ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      {remove.error && (
        <p className="text-sm text-destructive">{remove.error}</p>
      )}
    </ResponsiveSheet>
  );
}
