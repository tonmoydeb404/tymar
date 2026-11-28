"use client";

import { WorkspaceSelect } from "@/components/selectors/workspace-select";
import { useWorkspaces } from "@/contexts/app/app-context";
import type { Workspace } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { FieldControl } from "@packages/ui/fields/core";
import { useEffect, useState } from "react";

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
  const { workspaces, remove } = useWorkspaces();
  const [moveToId, setMoveToId] = useState("");

  const others = workspaces.filter(
    (w) => w.status === "ACTIVE" && !w.deletedAt && w.id !== workspace?.id,
  );
  const isLast = workspace !== null && others.length === 0;

  useEffect(() => {
    if (workspace) setMoveToId(others[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  async function handleConfirm() {
    if (!workspace || !moveToId) return;
    try {
      await remove.run(workspace.id, moveToId);
      onOpenChange(false);
      onDeleted();
    } catch {
      // Surfaced via remove.error from the hook.
    }
  }

  return (
    <ResponsiveSheet
      variant="dialog"
      size="sm"
      open={workspace !== null}
      onOpenChange={onOpenChange}
      title={
        isLast
          ? "Can't delete your last workspace"
          : `Delete “${workspace?.name}”?`
      }
      description={
        isLast
          ? "Every project needs a workspace, so you must keep at least one. Create another workspace first, then delete this one."
          : "The workspace is removed and its projects are moved to the workspace you pick below — nothing else is deleted."
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {isLast ? "Close" : "Cancel"}
          </Button>
          {!isLast && (
            <Button
              variant="destructive"
              onClick={() => void handleConfirm()}
              disabled={remove.isLoading || !moveToId}
            >
              {remove.isLoading ? "Deleting…" : "Delete workspace"}
            </Button>
          )}
        </>
      }
    >
      {!isLast && (
        <FieldControl label="Move projects to" htmlFor="delete-workspace-move-to">
          <WorkspaceSelect
            id="delete-workspace-move-to"
            value={moveToId}
            onValueChange={setMoveToId}
            withAll={false}
            excludeId={workspace?.id}
            placeholder="Pick a workspace"
            className="w-full"
          />
        </FieldControl>
      )}
      {remove.error && (
        <p className="text-sm text-destructive">{remove.error}</p>
      )}
    </ResponsiveSheet>
  );
}
