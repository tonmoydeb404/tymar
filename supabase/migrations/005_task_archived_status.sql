-- ============================================================
-- Tasks can be archived: kept for the record, hidden from the
-- board and pickers until asked for.
-- ============================================================

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED'));
