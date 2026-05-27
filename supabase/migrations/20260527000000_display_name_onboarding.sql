-- Display Name Onboarding
-- Stop auto-populating display_name from Google metadata.
-- New users get display_name = '' and must choose their leaderboard name
-- via the onboarding modal before using the app.
-- Existing users are unaffected (they already have non-empty display_names).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  comp_id uuid;
BEGIN
  -- Create user profile — display_name left empty; user chooses on first login
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    '',
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
