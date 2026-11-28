"use client";

import { useRef } from "react";
import {
  TaskListSection,
  type TaskListSectionHandle,
} from "./sections/task-list-section";
import { TasksHeaderSection } from "./sections/tasks-header-section";
import { useTasksView } from "./use-tasks-view";

export function TasksView() {
  const listRef = useRef<TaskListSectionHandle>(null);
  const { view, setView, ready } = useTasksView();

  return (
    <div className="grid gap-6">
      <TasksHeaderSection
        onNew={() => listRef.current?.openCreate()}
        view={view}
        onViewChange={setView}
      />
      {/* Wait for the saved layout so a board user never sees the list flash. */}
      {ready && <TaskListSection ref={listRef} view={view} />}
    </div>
  );
}
