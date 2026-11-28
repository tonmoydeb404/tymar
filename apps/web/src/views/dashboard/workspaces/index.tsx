"use client";

import { useRef } from "react";
import {
  WorkspaceListSection,
  type WorkspaceListSectionHandle,
} from "./sections/workspace-list-section";
import { WorkspacesHeaderSection } from "./sections/workspaces-header-section";

export function WorkspacesView() {
  const listRef = useRef<WorkspaceListSectionHandle>(null);

  return (
    <div className="grid gap-6">
      <WorkspacesHeaderSection onNew={() => listRef.current?.openCreate()} />
      <WorkspaceListSection ref={listRef} />
    </div>
  );
}
