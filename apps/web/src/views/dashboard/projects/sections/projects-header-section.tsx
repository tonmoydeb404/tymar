import { PageHeader } from "@/components/page-header";
import { Button } from "@packages/ui/components/button";
import { Plus } from "lucide-react";

type Props = {
  onNew: () => void;
};

export function ProjectsHeaderSection({ onNew }: Props) {
  return (
    <PageHeader
      title="Projects"
      description="Containers for related work in this workspace."
      actions={
        <Button onClick={onNew}>
          <Plus size={14} />
          New project
        </Button>
      }
    />
  );
}
