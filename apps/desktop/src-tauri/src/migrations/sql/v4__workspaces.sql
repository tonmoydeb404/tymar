-- Workspaces: optional grouping level above projects (mirrors Supabase
-- migration 003). projects.workspace_id stays nullable — "no workspace".
--
-- No local backfill: the server migration already created the default
-- "Personal" workspace per user and assigned remote projects to it, so the
-- first sync pull brings the workspace and the assignments down with the
-- same ids. A local backfill would mint different ids and duplicate
-- "Personal" on the server.

CREATE TABLE IF NOT EXISTS workspaces (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  deleted_at   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  sync_status  TEXT NOT NULL DEFAULT 'pending_create',
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT
);

ALTER TABLE projects ADD COLUMN workspace_id TEXT;

CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
