"use client";

import { useProjects } from "@/contexts/app/app-context";
import type { Project } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { Textarea } from "@packages/ui/components/textarea";
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setValidationError(null);
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
    setValidationError(null);
    try {
      await update.run(project.id, {
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
      open={project !== null}
      onOpenChange={onOpenChange}
      title="Rename project"
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
        placeholder="e.g. Client Website"
        autoFocus
      />
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
