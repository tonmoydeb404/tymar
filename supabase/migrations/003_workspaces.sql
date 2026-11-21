-- ============================================================
-- Workspaces: an optional grouping level above projects.
-- A workspace holds N projects (e.g. "Client A" → 2 projects,
-- "Client B" → 2 others).
--
-- Default behavior: every user gets a "Personal" workspace —
-- created here for all existing users and automatically for every
-- new signup — and all existing projects are moved into it, so no
-- project is left without a workspace.
--
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

-- Defensive: if an earlier draft of this migration ran with the old
-- default name, carry those workspaces over instead of duplicating.
UPDATE public.workspaces SET name = 'Personal' WHERE name = 'General';

-- One "Personal" workspace per user — all existing users, even those
-- without any projects yet.
INSERT INTO public.workspaces (user_id, name)
SELECT u.id, 'Personal'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspaces w WHERE w.user_id = u.id
);

-- Move every existing project into its owner's Personal workspace —
-- after this no project is ungrouped.
UPDATE public.projects p
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.user_id = p.user_id
  AND p.workspace_id IS NULL
  AND w.name = 'Personal';

-- New signups get their Personal workspace automatically (extends the
-- profile trigger).
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
  SELECT NEW.id, 'Personal'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.user_id = NEW.id
  );

  RETURN NEW;
END;
$$;
