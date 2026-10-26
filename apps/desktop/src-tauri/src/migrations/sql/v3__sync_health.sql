-- Sync health: track per-row push failures so the sync engine can retry with
-- a cap and surface stuck rows to the UI instead of failing silently forever.
--   sync_attempts    = consecutive failed push attempts since last success
--   last_sync_error  = error message from the most recent failed push

ALTER TABLE projects ADD COLUMN sync_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN last_sync_error TEXT;

ALTER TABLE tasks ADD COLUMN sync_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN last_sync_error TEXT;

ALTER TABLE time_entries ADD COLUMN sync_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN last_sync_error TEXT;
