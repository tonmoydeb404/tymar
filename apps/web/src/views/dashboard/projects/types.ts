import type { ProjectStatus } from "@packages/domain/index";

export type ProjectStatusFilter = ProjectStatus | "ALL";

/** "ALL" · a workspace id. */
export type WorkspaceFilter = string;
