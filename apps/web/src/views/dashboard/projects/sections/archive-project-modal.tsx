"use client";

import { useProjects } from "@/contexts/app/app-context";
import type { Project } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";

type Props = {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
  onArchived: () => void;
};

export function ArchiveProjectModal({
  project,
  onOpenChange,
  onArchived,
}: Props) {
  const { update } = useProjects();
  const archiving = project?.status !== "ARCHIVED";

  async function handleConfirm() {
    if (!project) return;
    try {
      await update.run(project.id, {
        status: archiving ? "ARCHIVED" : "ACTIVE",
      });
      onOpenChange(false);
      onArchived();
    } catch {
      // Surfaced via update.error from the hook.
    }
  }

  return (
    <ResponsiveSheet
      open={project !== null}
      onOpenChange={onOpenChange}
      title={
        archiving
          ? `Archive “${project?.name}”?`
          : `Unarchive “${project?.name}”?`
      }
      description={
        archiving
          ? "Archived projects are hidden from the active list but kept for history."
          : "This project will show up in the active list again."
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={update.isLoading}
          >
            {update.isLoading ? "Saving…" : archiving ? "Archive" : "Unarchive"}
          </Button>
        </>
      }
    >
      {update.error && (
        <p className="text-sm text-destructive">{update.error}</p>
      )}
    </ResponsiveSheet>
  );
}
