-- ============================================================
-- Workspaces: an optional grouping level above projects.
-- A workspace holds N projects (e.g. "Client A" → 2 projects,
-- "Client B" → 2 others). Nullable projects.workspace_id means
-- "no workspace" — shown as an ungrouped section in the UIs.
-- Additive only: pre-workspace clients keep syncing untouched.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ARCHIVED')),
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user ON public.workspaces(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);

CREATE OR REPLACE TRIGGER t_workspaces_upd BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspaces: own" ON public.workspaces FOR ALL USING (auth.uid() = user_id);

-- Backfill: one default "General" workspace per user that already has
-- projects, with all their projects assigned to it. Desktop clients pick
-- this up on their next sync pull.
INSERT INTO public.workspaces (user_id, name)
SELECT DISTINCT p.user_id, 'General'
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspaces w WHERE w.user_id = p.user_id
);

UPDATE public.projects p
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.user_id = p.user_id
  AND p.workspace_id IS NULL
  AND w.name = 'General';

-- New signups get the same default workspace (extends the profile trigger).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(user_id, name, email)
  VALUES(
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.workspaces(user_id, name)
  VALUES(NEW.id, 'General')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
