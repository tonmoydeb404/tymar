"use client";

import { WorkspaceSelect } from "@/components/selectors/workspace-select";
import { useCurrentWorkspace, useProjects } from "@/contexts/app/app-context";
import type { Project } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { FieldControl, TextField, TextareaField } from "@packages/ui/fields/core";
import { useEffect, useState } from "react";

type Props = {
  /** Edit target; modal is open whenever this is non-null. */
  project: Project | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function UpdateProjectModal({
  project,
  onOpenChange,
  onUpdated,
}: Props) {
  const { update } = useProjects();
  const { currentId } = useCurrentWorkspace();
  const [workspaceId, setWorkspaceId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setValidationError(null);
    setWorkspaceId(project.workspaceId ?? "");
    setName(project.name);
    setDescription(project.description ?? "");
  }, [project]);

  const error = validationError || update.error;

  async function handleSave() {
    if (!project) return;
    if (!name.trim()) {
      setValidationError("A project name is required.");
      return;
    }
    if (!workspaceId) {
      setValidationError("Pick a workspace for this project.");
      return;
    }
    setValidationError(null);
    try {
      await update.run(project.id, {
        workspaceId,
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
      variant="dialog"
      open={project !== null}
      onOpenChange={onOpenChange}
      title="Edit project"
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
      <FieldControl
        label="Workspace"
        htmlFor="edit-project-workspace"
        description={
          project && workspaceId && workspaceId !== project.workspaceId
            ? workspaceId !== currentId
              ? "Its tasks and time entries move with it, and it will leave this workspace's list."
              : "Its tasks and time entries move with it."
            : undefined
        }
      >
        <WorkspaceSelect
          id="edit-project-workspace"
          value={workspaceId}
          onValueChange={setWorkspaceId}
          withAll={false}
          placeholder="Pick a workspace"
          className="w-full"
        />
      </FieldControl>
      <TextField
        id="edit-project-name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Client Website"
        autoFocus
      />
      <TextareaField
        id="edit-project-description"
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
