"use client";

import { useWorkspaces } from "@/contexts/app/app-context";
import type { Workspace } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { Textarea } from "@packages/ui/components/textarea";
import { useEffect, useState } from "react";

type Props = {
  /** Edit target; modal is open whenever this is non-null. */
  workspace: Workspace | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function UpdateWorkspaceModal({
  workspace,
  onOpenChange,
  onUpdated,
}: Props) {
  const { update } = useWorkspaces();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    setValidationError(null);
    setName(workspace.name);
    setDescription(workspace.description ?? "");
  }, [workspace]);

  const error = validationError || update.error;

  async function handleSave() {
    if (!workspace) return;
    if (!name.trim()) {
      setValidationError("A workspace name is required.");
      return;
    }
    setValidationError(null);
    try {
      await update.run(workspace.id, {
        name: name.trim(),
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
      open={workspace !== null}
      onOpenChange={onOpenChange}
      title="Rename workspace"
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
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Client A"
        autoFocus
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What is this workspace for? (optional)"
        rows={3}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ResponsiveSheet>
  );
}
