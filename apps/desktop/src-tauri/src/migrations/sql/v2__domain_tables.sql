-- Domain tables for local-first storage.
-- Each row has a sync_status dirty flag:
--   'synced'          = matches remote
--   'pending_create'  = not yet pushed to Supabase
--   'pending_update'  = modified locally, not yet synced
--   'pending_delete'  = soft-deleted locally, not yet synced

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  deleted_at   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  sync_status  TEXT NOT NULL DEFAULT 'pending_create'
);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  project_id   TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'TODO',
  priority     TEXT NOT NULL DEFAULT 'MEDIUM',
  due_date     TEXT,
  completed_at TEXT,
  deleted_at   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  sync_status  TEXT NOT NULL DEFAULT 'pending_create'
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

CREATE TABLE IF NOT EXISTS time_entries (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  task_id      TEXT,
  project_id   TEXT,
  type         TEXT NOT NULL DEFAULT 'WORK',
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  sync_status  TEXT NOT NULL DEFAULT 'pending_create'
);

CREATE INDEX IF NOT EXISTS idx_te_user_started ON time_entries(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_te_open ON time_entries(user_id, ended_at) WHERE ended_at IS NULL;
