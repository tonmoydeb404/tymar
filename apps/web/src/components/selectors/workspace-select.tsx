"use client";

import { useWorkspaces } from "@/contexts/app/app-context";
import { FolderKanban } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@packages/ui/components/select";

/** Sentinel for "All workspaces" (no filtering). */
export const ALL_WORKSPACES = "";

type Props = {
  id?: string;
  /** Selected workspace id, or ALL_WORKSPACES (""). */
  value: string;
  onValueChange: (workspaceId: string) => void;
  /** Shows the "All workspaces" option (default true). */
  withAll?: boolean;
  /** Label for the empty option. */
  allLabel?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/** Workspace picker backed by the shared workspaces cache. Workspaces are
 * managed on the Projects page; this only selects among them. */
export function WorkspaceSelect({
  id,
  value,
  onValueChange,
  withAll = true,
  allLabel = "All workspaces",
  placeholder = "Workspace",
  className,
  disabled,
}: Props) {
  const { workspaces } = useWorkspaces();
  const active = workspaces.filter((w) => w.status === "ACTIVE" && !w.deletedAt);

  return (
    <Select
      value={value || ALL_WORKSPACES}
      onValueChange={(v) => onValueChange(v && v !== ALL_WORKSPACES ? v : "")}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className}>
        <span className="flex min-w-0 items-center gap-1.5">
          <FolderKanban size={13} className="shrink-0 text-muted-foreground" />
          <SelectValue placeholder={placeholder} />
        </span>
      </SelectTrigger>
      <SelectContent>
        {withAll && (
          <SelectItem value={ALL_WORKSPACES}>{allLabel}</SelectItem>
        )}
        {active.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
