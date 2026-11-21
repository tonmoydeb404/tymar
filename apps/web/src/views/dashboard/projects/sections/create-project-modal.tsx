"use client";

import { WorkspaceSelect } from "@/components/selectors/workspace-select";
import { useProjects } from "@/contexts/app/app-context";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { Textarea } from "@packages/ui/components/textarea";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateProjectModal({ open, onOpenChange, onCreated }: Props) {
  const { create } = useProjects();
  const [workspaceId, setWorkspaceId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValidationError(null);
    setWorkspaceId("");
    setName("");
    setDescription("");
  }, [open]);

  const error = validationError || create.error;

  async function handleSave() {
    if (!name.trim()) {
      setValidationError("A project name is required.");
      return;
    }
    setValidationError(null);
    try {
      await create.run({
        workspaceId: workspaceId || null,
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
      title="New project"
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
      <div className="grid gap-1.5">
        <Label htmlFor="new-project-workspace">Workspace</Label>
        <WorkspaceSelect
          id="new-project-workspace"
          value={workspaceId}
          onValueChange={setWorkspaceId}
          allLabel="No workspace"
          className="w-full"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new-project-name">Name</Label>
        <Input
          id="new-project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Client Website"
          autoFocus
        />
      </div>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What is this about? (optional)"
        rows={3}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ResponsiveSheet>
  );
}
