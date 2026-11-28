import { useWorkspaces } from "@/context/db/db-context";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@packages/ui/components/select";
import { FolderKanban } from "lucide-react";

type Props = {
  id?: string;
  /** Selected workspace id (always one — there is no "all"). */
  value: string;
  onValueChange: (workspaceId: string) => void;
  className?: string;
  disabled?: boolean;
};

/** Workspace picker backed by the shared workspaces cache. Workspaces are
 * managed on the web dashboard; this only switches among active ones. */
export function WorkspaceSelect({
  id,
  value,
  onValueChange,
  className,
  disabled,
}: Props) {
  const { workspaces, activeWorkspaces } = useWorkspaces();

  // Resolve the label ourselves — Base UI's SelectValue renders the raw
  // value whenever the popup's items aren't mounted (portal + async load).
  const label = workspaces.find((w) => w.id === value)?.name ?? "Workspace";

  return (
    <Select
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} size="sm">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <FolderKanban size={13} className="shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {activeWorkspaces.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
