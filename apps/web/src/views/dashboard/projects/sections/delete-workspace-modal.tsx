"use client";

import { useWorkspaces } from "@/contexts/app/app-context";
import type { Workspace } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";

type Props = {
  workspace: Workspace | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteWorkspaceModal({
  workspace,
  onOpenChange,
  onDeleted,
}: Props) {
  const { remove } = useWorkspaces();

  async function handleConfirm() {
    if (!workspace) return;
    try {
      await remove.run(workspace.id);
      onOpenChange(false);
      onDeleted();
    } catch {
      // Surfaced via remove.error from the hook.
    }
  }

  return (
    <ResponsiveSheet
      open={workspace !== null}
      onOpenChange={onOpenChange}
      title={`Delete “${workspace?.name}”?`}
      description="The workspace is removed, but its projects are kept — they become ungrouped (no workspace) rather than being deleted."
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
            {remove.isLoading ? "Deleting…" : "Delete workspace"}
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
