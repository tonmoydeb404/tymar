-- ============================================================
-- Workspaces become required.
--
-- * Every user has at least one active workspace (a "Personal" one is
--   created when they have none).
-- * Every project belongs to a workspace: orphans (workspace_id NULL, or
--   pointing at a soft-deleted workspace) are moved into the owner's
--   default workspace — "Personal" when present, else their oldest active
--   workspace. After this, projects.workspace_id is NOT NULL.
-- * Older clients that still send workspace_id = NULL keep working: a
--   trigger fills in the default workspace instead of rejecting the row.
-- * A user's last active workspace can't be deleted, soft-deleted or
--   archived. Removing any other workspace re-homes its projects first.
-- ============================================================

-- 1. Everyone gets an active workspace.
INSERT INTO public.workspaces (user_id, name)
SELECT u.id, 'Personal'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspaces w
  WHERE w.user_id = u.id AND w.deleted_at IS NULL AND w.status = 'ACTIVE'
);

-- 2. The workspace that adopts projects with nowhere else to go.
--    `p_exclude` lets a workspace being removed hand its projects over.
CREATE OR REPLACE FUNCTION public.default_workspace_id(
  p_user UUID,
  p_exclude UUID DEFAULT NULL
) RETURNS UUID LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT w.id
  FROM public.workspaces w
  WHERE w.user_id = p_user
    AND w.deleted_at IS NULL
    AND w.status = 'ACTIVE'
    AND (p_exclude IS NULL OR w.id <> p_exclude)
  ORDER BY (w.name = 'Personal') DESC, w.created_at ASC
  LIMIT 1;
$$;

-- 3. Backfill orphans (the updated_at trigger bumps them, so clients pull
--    the new assignment on their next sync).
UPDATE public.projects p
SET workspace_id = public.default_workspace_id(p.user_id)
WHERE p.workspace_id IS NULL
   OR EXISTS (
     SELECT 1 FROM public.workspaces w
     WHERE w.id = p.workspace_id AND w.deleted_at IS NOT NULL
   );

-- 4. New/edited projects without a workspace get the default one.
CREATE OR REPLACE FUNCTION public.trg_project_default_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    NEW.workspace_id := public.default_workspace_id(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER t_projects_default_workspace
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_project_default_workspace();

-- 5. Required from here on. The FK no longer nulls the column on delete
--    (the trigger below re-homes projects before a workspace goes).
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_workspace_id_fkey;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.projects ALTER COLUMN workspace_id SET NOT NULL;

-- 6. Protect the last workspace; re-home projects of a removed one.
CREATE OR REPLACE FUNCTION public.trg_workspace_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  was_live  BOOLEAN := OLD.deleted_at IS NULL AND OLD.status = 'ACTIVE';
  removing  BOOLEAN;
  archiving BOOLEAN := FALSE;
  heir      UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Account deletion cascades through here — let it happen.
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
      RETURN OLD;
    END IF;
    removing := TRUE;
  ELSE
    removing  := NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL;
    archiving := NEW.deleted_at IS NULL AND NEW.status <> 'ACTIVE';
    IF NOT removing AND NOT archiving THEN
      RETURN NEW;
    END IF;
  END IF;

  heir := public.default_workspace_id(OLD.user_id, OLD.id);

  IF was_live AND heir IS NULL THEN
    RAISE EXCEPTION 'You can''t remove your last workspace.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Deleting (hard or soft) hands the projects to another workspace;
  -- archiving leaves them where they are.
  IF removing AND heir IS NOT NULL THEN
    UPDATE public.projects SET workspace_id = heir WHERE workspace_id = OLD.id;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE TRIGGER t_workspaces_guard
  BEFORE UPDATE OR DELETE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.trg_workspace_guard();
