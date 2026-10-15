-- ============================================================
-- Tymar initial schema
-- Paste this in the Supabase SQL editor and run it.
-- ============================================================

-- Profiles (one per auth.users row, auto-created by trigger)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  timezone   TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ARCHIVED')),
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'TODO'   CHECK(status IN ('TODO','IN_PROGRESS','DONE')),
  priority     TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH')),
  due_date     TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TIME CONFLICTS ALLOWED — no unique-open constraint
CREATE TABLE IF NOT EXISTS public.time_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id    UUID REFERENCES public.tasks(id)    ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  type       TEXT NOT NULL DEFAULT 'WORK' CHECK(type IN ('WORK','BREAK')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user    ON public.tasks(user_id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_te_user_time  ON public.time_entries(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_te_open       ON public.time_entries(user_id) WHERE ended_at IS NULL;

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER t_profiles_upd     BEFORE UPDATE ON public.profiles     FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
CREATE OR REPLACE TRIGGER t_projects_upd     BEFORE UPDATE ON public.projects     FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
CREATE OR REPLACE TRIGGER t_tasks_upd        BEFORE UPDATE ON public.tasks        FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
CREATE OR REPLACE TRIGGER t_time_entries_upd BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================
-- Auto-create profile on new user signup
-- ============================================================
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
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own"     ON public.profiles     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "projects: own"     ON public.projects     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "tasks: own"        ON public.tasks        FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "time_entries: own" ON public.time_entries FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Joined view (server-side task + project name resolution)
-- Eliminates all client-side task/project name lookups.
-- ============================================================
CREATE OR REPLACE VIEW public.time_entries_with_details AS
SELECT
  te.*,
  t.title AS task_title,
  p.name  AS project_name
FROM public.time_entries te
LEFT JOIN public.tasks    t ON t.id = te.task_id
LEFT JOIN public.projects p ON p.id = te.project_id;

-- Enable RLS on the view by setting it to security_invoker
ALTER VIEW public.time_entries_with_details SET (security_invoker = true);
