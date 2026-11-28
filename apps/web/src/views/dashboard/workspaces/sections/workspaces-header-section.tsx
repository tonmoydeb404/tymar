import { PageHeader } from "@/components/page-header";
import { Button } from "@packages/ui/components/button";
import { Plus } from "lucide-react";

type Props = {
  onNew: () => void;
};

export function WorkspacesHeaderSection({ onNew }: Props) {
  return (
    <PageHeader
      title="Workspaces"
      description="Group your projects — e.g. one workspace per client or area."
      actions={
        <Button onClick={onNew}>
          <Plus size={14} />
          New workspace
        </Button>
      }
    />
  );
}
