"use client";

import { useWorkspaces } from "@/contexts/app/app-context";
import type { Workspace } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";

type Props = {
  workspace: Workspace | null;
  onOpenChange: (open: boolean) => void;
  onArchived: () => void;
};

export function ArchiveWorkspaceModal({
  workspace,
  onOpenChange,
  onArchived,
}: Props) {
  const { update } = useWorkspaces();
  const archiving = workspace?.status !== "ARCHIVED";

  async function handleConfirm() {
    if (!workspace) return;
    try {
      await update.run(workspace.id, {
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
      open={workspace !== null}
      onOpenChange={onOpenChange}
      title={
        archiving
          ? `Archive “${workspace?.name}”?`
          : `Unarchive “${workspace?.name}”?`
      }
      description={
        archiving
          ? "Archived workspaces are hidden from the timer app and selectors, but their projects stay untouched."
          : "This workspace will show up in the timer app again."
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
