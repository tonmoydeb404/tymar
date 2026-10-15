-- ============================================================
-- Public status API (opt-in, slug-gated)
-- ============================================================
-- Lets a user expose "working / on_break / offline" through a
-- renewable random slug URL. The web app resolves a slug to a
-- status derived from the user's OPEN time entry — nothing else
-- (tasks, projects, history) ever leaves the database.

CREATE TABLE IF NOT EXISTS public.public_status_settings (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL UNIQUE,
  is_public  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_status_slug
  ON public.public_status_settings(slug);

ALTER TABLE public.public_status_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_status_settings: own" ON public.public_status_settings;

CREATE POLICY "public_status_settings: own"
  ON public.public_status_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER t_public_status_settings_upd
  BEFORE UPDATE ON public.public_status_settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ------------------------------------------------------------
-- Owner RPCs (web dashboard). SECURITY DEFINER because a row may
-- not exist yet (first enable creates it). auth.uid() is checked
-- inside so anon can never invoke them.
-- ------------------------------------------------------------

-- Generates a fresh 128-bit URL-safe slug and (re)enables exposure.
-- Any previous slug stops working immediately.
CREATE OR REPLACE FUNCTION public.regenerate_public_slug()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_slug TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  LOOP
    new_slug := replace(gen_random_uuid()::text, '-', '');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.public_status_settings WHERE slug = new_slug
    );
  END LOOP;

  INSERT INTO public.public_status_settings (user_id, slug, is_public)
  VALUES (auth.uid(), new_slug, true)
  ON CONFLICT (user_id) DO UPDATE
    SET slug = EXCLUDED.slug,
        is_public = true;

  RETURN new_slug;
END;
$$;

-- Pauses/resumes exposure without rotating the slug. Enables create
-- a settings row (and slug) on first use.
CREATE OR REPLACE FUNCTION public.set_public_status_enabled(p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_enabled THEN
    INSERT INTO public.public_status_settings (user_id, slug, is_public)
    VALUES (auth.uid(), replace(gen_random_uuid()::text, '-', ''), true)
    ON CONFLICT (user_id) DO UPDATE SET is_public = true;
  ELSE
    UPDATE public.public_status_settings
    SET is_public = false
    WHERE user_id = auth.uid();
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- Public read RPC. STABLE so it is a pure read. Staleness rule: an
-- open entry whose updated_at has not been refreshed by the
-- desktop sync in 15 minutes (crash, sleep, quit) reports offline.
-- known=false for unknown/disabled slugs so the API can 404
-- without revealing whether a disabled slug exists.
--
-- NOTE: the boolean column is deliberately NOT named "found" — that
-- name collides with plpgsql's built-in FOUND variable and the
-- assignment silently never reaches the output row.
-- ------------------------------------------------------------

-- Changing an OUT parameter name is not allowed via CREATE OR REPLACE,
-- so drop the previous revision first (also keeps re-runs clean).
DROP FUNCTION IF EXISTS public.get_public_status(TEXT);

CREATE OR REPLACE FUNCTION public.get_public_status(p_slug TEXT)
RETURNS TABLE(known BOOLEAN, status TEXT, since TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_type    TEXT;
  v_started TIMESTAMPTZ;
  v_updated TIMESTAMPTZ;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.public_status_settings
  WHERE slug = p_slug
    AND is_public;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT type, started_at, updated_at
  INTO v_type, v_started, v_updated
  FROM public.time_entries
  WHERE user_id = v_user_id
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF NOT FOUND OR v_updated < now() - INTERVAL '15 minutes' THEN
    RETURN QUERY SELECT true, 'offline'::text, NULL::timestamptz;
  ELSIF v_type = 'BREAK' THEN
    RETURN QUERY SELECT true, 'on_break'::text, v_started;
  ELSE
    RETURN QUERY SELECT true, 'working'::text, v_started;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- Grants: only get_public_status is public. The owner RPCs default
-- to PUBLIC executable in Postgres, so revoke explicitly.
-- ------------------------------------------------------------

REVOKE ALL ON FUNCTION public.get_public_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_status(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.regenerate_public_slug() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_public_slug() TO authenticated;

REVOKE ALL ON FUNCTION public.set_public_status_enabled(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_public_status_enabled(BOOLEAN) TO authenticated;
