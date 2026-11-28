"use client";

import { useCurrentWorkspace, useProjects } from "@/contexts/app/app-context";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { TextField, TextareaField } from "@packages/ui/fields/core";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateProjectModal({ open, onOpenChange, onCreated }: Props) {
  const { create } = useProjects();
  const { current } = useCurrentWorkspace();
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
      setValidationError("A project name is required.");
      return;
    }
    if (!current) {
      setValidationError("Create a workspace in Settings first.");
      return;
    }
    setValidationError(null);
    try {
      await create.run({
        workspaceId: current.id,
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
      variant="dialog"
      open={open}
      onOpenChange={onOpenChange}
      title="New project"
      description={current ? `Created in ${current.name}.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={create.isLoading}>
            {create.isLoading ? "Creating…" : "Create project"}
          </Button>
        </>
      }
    >
      <TextField
        id="new-project-name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Client Website"
        autoFocus
      />
      <TextareaField
        id="new-project-description"
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What is this about? (optional)"
        rows={3}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ResponsiveSheet>
  );
}
