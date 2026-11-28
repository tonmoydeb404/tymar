import { PageHeader } from "@/components/page-header";
import { Button } from "@packages/ui/components/button";
import { cn } from "@/lib/utils";
import { KanbanSquare, List, Plus } from "lucide-react";
import type { TasksView } from "../use-tasks-view";

type Props = {
  onNew: () => void;
  view: TasksView;
  onViewChange: (view: TasksView) => void;
};

const VIEWS = [
  { value: "list", label: "List", icon: List },
  { value: "board", label: "Board", icon: KanbanSquare },
] as const;

export function TasksHeaderSection({ onNew, view, onViewChange }: Props) {
  return (
    <PageHeader
      title="Tasks"
      description="Everything across this workspace's projects."
      actions={
        <>
          <div
            role="group"
            aria-label="Tasks layout"
            className="flex rounded-lg border border-border p-0.5"
          >
            {VIEWS.map((v) => (
              <Button
                key={v.value}
                size="sm"
                variant={view === v.value ? "secondary" : "ghost"}
                aria-pressed={view === v.value}
                onClick={() => onViewChange(v.value)}
                className={cn("gap-1.5", view !== v.value && "text-muted-foreground")}
              >
                <v.icon size={14} />
                {v.label}
              </Button>
            ))}
          </div>
        <Button onClick={onNew}>
          <Plus size={14} />
          New task
        </Button>
        </>
      }
    />
  );
}
