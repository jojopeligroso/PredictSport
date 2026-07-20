-- Seed: one open instance per remaining blueprint + 8 synthetic members.
--
-- 1. Creates instance #1 for the 5 blueprints that have none
--    (Liam MacCarthy, Joe McDonagh, Sam Maguire, Tailteann, The Hundred),
--    mirroring 20260720100000_seed_winter_league_competitions.sql.
-- 2. Creates 8 synthetic users ("seed-fan-N@synthetic.predictsport.local").
--    They are NOT in auth.users (FK bypassed via replica mode, same pattern
--    as 20260720000001_display_instance_3.sql) so they can never log in.
-- 3. Joins all 8 to every non-WC open instance (10 instances), with member
--    triggers ENABLED (entrant cap check + join chat messages fire normally).
--
-- Never touches FIFA World Cup 2026 instances (real users).
-- Idempotent: instance creation skips existing instance_number=1; user
-- creation is keyed on email; memberships use ON CONFLICT DO NOTHING.

DO $$
DECLARE
  v_admin_id uuid;
  rec record;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.users
  WHERE email = 'eoinmaleoin@gmail.com';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user eoinmaleoin@gmail.com not found — cannot seed blueprint instances';
  END IF;

  -- =========================================================================
  -- 1. Instance #1 for blueprints that have none
  -- =========================================================================
  FOR rec IN
    SELECT * FROM (VALUES
      ('All-Ireland Senior Hurling Championship 2026',  'liam-maccarthy-2026'),
      ('Joe McDonagh Cup 2026',                         'joe-mcdonagh-2026'),
      ('All-Ireland Senior Football Championship 2026', 'sam-maguire-2026'),
      ('Tailteann Cup 2026',                            'tailteann-cup-2026'),
      ('The Hundred 2026',                              'the-hundred-2026')
    ) AS t(comp_name, tournament_slug)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.sporting_tournaments st
      WHERE st.slug = rec.tournament_slug
    ) THEN
      RAISE EXCEPTION 'Tournament slug % not found — run blueprint migrations first', rec.tournament_slug;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.tournament_id = (SELECT id FROM public.sporting_tournaments WHERE slug = rec.tournament_slug)
        AND c.instance_number = 1
    ) THEN
      RAISE NOTICE 'Instance #1 for % already exists — skipping', rec.tournament_slug;
      CONTINUE;
    END IF;

    INSERT INTO public.competitions (
      id, name, type, visibility, status, scoring_rules,
      created_by, invite_code,
      tournament_id, product_mode,
      max_entrants, chat_enabled, instance_type, instance_number
    ) VALUES (
      gen_random_uuid(),
      rec.comp_name,
      'open',
      'public',
      'active',
      '{}'::jsonb,
      v_admin_id,
      encode(gen_random_bytes(6), 'hex'),
      (SELECT id FROM public.sporting_tournaments WHERE slug = rec.tournament_slug),
      'predictsport_full',
      48,
      true,
      'full',
      1
    );

    RAISE NOTICE 'Created instance #1: %', rec.comp_name;
  END LOOP;

  -- =========================================================================
  -- 2. Synthetic users (bypass auth.users FK — display-instance precedent)
  -- =========================================================================
  SET session_replication_role = 'replica';

  INSERT INTO public.users (id, email, display_name, is_super_admin, created_at)
  SELECT
    gen_random_uuid(),
    'seed-fan-' || t.idx || '@synthetic.predictsport.local',
    t.name,
    false,
    now()
  FROM (VALUES
    (1, 'Heron Mendoza'),
    (2, 'Osprey Ryan'),
    (3, 'Merlin Cruz'),
    (4, 'Raven Doyle'),
    (5, 'Swift Morales'),
    (6, 'Lapwing O''Sullivan'),
    (7, 'Gannet Hernández'),
    (8, 'Trout Byrne')
  ) AS t(idx, name)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.email = 'seed-fan-' || t.idx || '@synthetic.predictsport.local'
  );

  SET session_replication_role = DEFAULT;

  -- =========================================================================
  -- 3. Join all 8 synthetic users to every non-WC open instance
  --    (triggers enabled: entrant cap enforced, join chat messages fire)
  -- =========================================================================
  INSERT INTO public.competition_members (competition_id, user_id, role)
  SELECT c.id, u.id, 'participant'
  FROM public.competitions c
  JOIN public.sporting_tournaments st ON st.id = c.tournament_id
  CROSS JOIN public.users u
  WHERE st.slug <> 'fifa-world-cup-2026'
    AND c.type = 'open'
    AND u.email LIKE 'seed-fan-%@synthetic.predictsport.local'
  ON CONFLICT (competition_id, user_id) DO NOTHING;

  RAISE NOTICE 'Synthetic members joined to all non-WC open instances';
END $$;
