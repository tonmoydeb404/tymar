"use client";

import { useWorkspaces } from "@/contexts/app/app-context";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { Textarea } from "@packages/ui/components/textarea";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateWorkspaceModal({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const { create } = useWorkspaces();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValidationError(null);
    setName("");
    setDescription("");
  }, [open]);

  const error = validationError || create.error;

  async function handleSave() {
    if (!name.trim()) {
      setValidationError("A workspace name is required.");
      return;
    }
    setValidationError(null);
    try {
      await create.run({
        name: name.trim(),
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
      title="New workspace"
      description="Workspaces group related projects — e.g. one per client or area."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={create.isLoading}>
            {create.isLoading ? "Creating…" : "Create workspace"}
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
