import { ProjectSelect } from "@/components/selectors/project-select";
import { TaskSelect } from "@/components/selectors/task-select";
import { useWorkspaces } from "@/context/db/db-context";
import { webUrl } from "@/lib/config";
import type { Task } from "@packages/domain/index";
import { Label } from "@packages/ui/components/label";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, FolderKanban } from "lucide-react";

type Props = {
  projectId: string | null;
  taskId: string | null;
  onProjectChange: (id: string | null, name: string | null) => void;
  onTaskChange: (id: string | null, title: string | null) => void;
  /** Creates a task in the given project; powers the task select's
   * inline "Create" option. */
  onQuickAdd: (projectId: string, title: string) => Promise<Task>;
};

// Project → task pickers shared by the "start timer" and "manual entry"
// sheets. The workspace is never asked for here: it comes from the global
// active workspace (switched on Home), and projects are scoped to it.
// Project is required, task is optional and can be created right from the
// task select once a project is chosen. Projects are managed on the web
// dashboard.
export function SessionFields({
  projectId,
  taskId,
  onProjectChange,
  onTaskChange,
  onQuickAdd,
}: Props) {
  const { workspaces, activeWorkspaceId } = useWorkspaces();
  const workspaceName = workspaces.find((w) => w.id === activeWorkspaceId)?.name;

  return (
    <div className="grid gap-5">
      {workspaceName && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderKanban size={13} className="shrink-0" />
          <span className="truncate">
            Workspace: <span className="font-medium text-ink">{workspaceName}</span>
          </span>
        </p>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="session-project">
          Project <span className="text-danger">*</span>
        </Label>
        <ProjectSelect
          id="session-project"
          value={projectId ?? ""}
          workspaceId={activeWorkspaceId ?? undefined}
          onValueChange={(id, name) => {
            onProjectChange(id || null, name);
            onTaskChange(null, null); // reset task when project changes
          }}
          placeholder="Pick a project"
          className="w-full"
        />
        <p className="text-[11px] text-muted-foreground">
          Don&apos;t see a project?{" "}
          <button
            type="button"
            onClick={() =>
              openUrl(`${webUrl}/dashboard/projects`).catch(() => {})
            }
            className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
          >
            Create one
            <ExternalLink size={10} />
          </button>
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="session-task">Task</Label>
        <TaskSelect
          id="session-task"
          value={taskId ?? ""}
          projectId={projectId ?? undefined}
          onValueChange={(id, title) => onTaskChange(id || null, title)}
          onCreate={projectId ? (title) => onQuickAdd(projectId, title) : undefined}
          placeholder={projectId ? "No task" : "Pick a project first"}
          className="w-full"
        />
      </div>
    </div>
  );
}
