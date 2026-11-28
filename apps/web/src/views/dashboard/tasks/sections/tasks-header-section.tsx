import { PageHeader } from "@/components/page-header";
import { Button } from "@packages/ui/components/button";
import { Plus } from "lucide-react";

type Props = {
  onNew: () => void;
};

export function TasksHeaderSection({ onNew }: Props) {
  return (
    <PageHeader
      title="Tasks"
      description="Everything across all projects."
      actions={
        <Button onClick={onNew}>
          <Plus size={14} />
          New task
        </Button>
      }
    />
  );
}
