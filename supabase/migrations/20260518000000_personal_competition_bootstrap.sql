-- A1: Bootstrap personal competitions for all existing users
--
-- Adds 'personal' competition type, creates one personal competition
-- per user, and updates handle_new_user() so future signups get one
-- automatically.

-- ============================================================
-- 1. Add 'personal' to competition type check
-- ============================================================

ALTER TABLE public.competitions
  DROP CONSTRAINT IF EXISTS competitions_type_check;

ALTER TABLE public.competitions
  ADD CONSTRAINT competitions_type_check
  CHECK (type IN ('fixed', 'open', 'personal'));

-- ============================================================
-- 2. Create personal competition for each existing user
-- ============================================================

INSERT INTO public.competitions (name, type, visibility, status, scoring_rules, allow_nominations, created_by)
SELECT
  'Personal',
  'personal',
  'private',
  'active',
  '{}'::jsonb,
  false,
  u.id
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.competitions c
  WHERE c.created_by = u.id AND c.type = 'personal'
);

-- ============================================================
-- 3. Create competition_member (admin) for each personal competition
-- ============================================================

INSERT INTO public.competition_members (competition_id, user_id, role)
SELECT c.id, c.created_by, 'admin'
FROM public.competitions c
WHERE c.type = 'personal'
AND NOT EXISTS (
  SELECT 1 FROM public.competition_members cm
  WHERE cm.competition_id = c.id AND cm.user_id = c.created_by
);

-- ============================================================
-- 4. Unique partial index: one personal competition per user
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_personal_per_user
  ON public.competitions (created_by)
  WHERE type = 'personal';

-- ============================================================
-- 5. Update handle_new_user() to auto-create personal competition
-- ============================================================
-- The trigger fires on auth.users INSERT. The original only created
-- a public.users row. Now it also creates the personal competition
-- and competition_members entry.
--
-- SECURITY DEFINER + search_path = '' means all table/function
-- references must be fully qualified.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  comp_id uuid;
BEGIN
  -- Create user profile (original behaviour)
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  -- Create personal competition
  INSERT INTO public.competitions (
    name, type, visibility, status, scoring_rules,
    allow_nominations, created_by, invite_code
  )
  VALUES (
    'Personal',
    'personal',
    'private',
    'active',
    '{}'::jsonb,
    false,
    new.id,
    encode(extensions.gen_random_bytes(6), 'hex')
  )
  RETURNING id INTO comp_id;

  -- Add user as admin of their personal competition
  INSERT INTO public.competition_members (competition_id, user_id, role)
  VALUES (comp_id, new.id, 'admin');

  RETURN new;
END;
$$;
