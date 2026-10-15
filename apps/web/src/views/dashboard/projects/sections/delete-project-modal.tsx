"use client";

import { useProjects } from "@/contexts/app/app-context";
import type { Project } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";

type Props = {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteProjectModal({
  project,
  onOpenChange,
  onDeleted,
}: Props) {
  const { remove } = useProjects();

  async function handleConfirm() {
    if (!project) return;
    try {
      await remove.run(project.id);
      onOpenChange(false);
      onDeleted();
    } catch {
      // Surfaced via remove.error from the hook.
    }
  }

  return (
    <ResponsiveSheet
      open={project !== null}
      onOpenChange={onOpenChange}
      title={`Delete “${project?.name}”?`}
      description="The project will be hidden everywhere. Projects with active tasks can't be deleted — archive them instead."
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
