-- Seed: 5 winter-league competition instances (LMP, LVBP, LIDOM, LBPRC, SdC).
--
-- One open public instance (#1) per winter-league blueprint. Fixtures are shared
-- per tournament; predictions/standings are per-instance.
-- Idempotent: each insert is skipped if an instance_number=1 competition already
-- exists for that tournament.

DO $$
DECLARE
  v_admin_id uuid;
  rec record;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.users
  WHERE email = 'eoinmaleoin@gmail.com';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user eoinmaleoin@gmail.com not found — cannot seed winter league competitions';
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('Liga Mexicana del Pacífico 2025-26',                          'lmp-2025-26'),
      ('Liga Venezolana de Béisbol Profesional 2025-26',              'lvbp-2025-26'),
      ('Liga de Béisbol Profesional de la República Dominicana 2025-26', 'lidom-2025-26'),
      ('Liga de Béisbol Profesional Roberto Clemente 2025-26',        'lbprc-2025-26'),
      ('Serie del Caribe 2027',                                       'sdc-2027')
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
END $$;
