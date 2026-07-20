-- The Hundred: split into men's + women's blueprints, correct stale facts,
-- seed all 64 verified league fixtures with winner EPTs.
--
-- Corrections (verified vs ESPN series 19601 mens / 19663 womens, 2026-07-20):
--   * Men's and women's Hundred are separate real-world competitions ->
--     separate blueprints. The old single blueprint (with config.editions)
--     is repurposed as the MEN'S blueprint; a new women's blueprint is created.
--   * Real window: 2026-07-21 .. 2026-08-16 (old seed wrongly said Aug 5-31).
--   * Franchise rebrands: Oval Invincibles -> MI London,
--     Northern Superchargers -> Sunrisers Leeds,
--     Manchester Originals -> Manchester Super Giants.
--
-- Seeds: 32 men's + 32 women's league fixtures (exact UTC start times from
-- ESPN scoreboard API), one 'winner' EPT each (2 pts, 2 options, no Draw —
-- The Hundred has no draws; super over decides). Eliminator (Aug 14) and
-- Final (Aug 16) are NOT seeded — participants TBC until the table resolves.
--
-- Instances: renames existing instance #1 -> men's; creates women's instance
-- #1 (same recipe as 20260720100000) and joins the 8 seed fans (triggers ON).
-- Idempotent: guarded per-section.

-- ============================================================
-- 1. Repurpose existing blueprint as the MEN'S competition
-- ============================================================

UPDATE public.sporting_tournaments
SET
  slug = 'the-hundred-mens-2026',
  name = 'The Hundred Men''s 2026',
  template_key = 'the_hundred_mens_2026',
  starts_at = '2026-07-21T00:00:00Z',
  ends_at   = '2026-08-16T23:59:59Z',
  config = '{
    "max_entrants_per_instance": 48,
    "governing_body": "ECB",
    "ball_format": "100-ball",
    "team_count": 8,
    "league_matches_per_team": 8,
    "league_total_matches": 32,
    "playoff_qualify_count": 3,
    "playoff_shape": "top3_eliminator",
    "allow_draw": false,
    "tie_breaker": "super_over"
  }'::jsonb
WHERE id = 'a0000000-0000-0000-0000-000000000100';

UPDATE public.sporting_stages
SET config = jsonb_set(config, '{date_range}', '["2026-07-21", "2026-08-12"]'::jsonb)
WHERE id = 'b0000000-0000-0000-0001-000000000100';

UPDATE public.sporting_stages
SET config = jsonb_set(config, '{date_range}', '["2026-08-14", "2026-08-14"]'::jsonb)
WHERE id = 'b0000000-0000-0000-0002-000000000100';

UPDATE public.sporting_stages
SET config = jsonb_set(config, '{date_range}', '["2026-08-16", "2026-08-16"]'::jsonb)
WHERE id = 'b0000000-0000-0000-0003-000000000100';

UPDATE public.bracket_templates
SET
  template_key = 'the_hundred_mens_2026',
  name = 'The Hundred Men''s 2026',
  config = jsonb_set(config, '{leagueTeams}', '[
    "Birmingham Phoenix",
    "London Spirit",
    "Manchester Super Giants",
    "Sunrisers Leeds",
    "MI London",
    "Southern Brave",
    "Trent Rockets",
    "Welsh Fire"
  ]'::jsonb)
WHERE id = 'c0000000-0000-0000-0000-000000000100';

-- ============================================================
-- 2. Create the WOMEN'S blueprint (new well-known IDs, -000101)
-- ============================================================

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000101',
  'the-hundred-womens-2026',
  'The Hundred Women''s 2026',
  'cricket',
  'the_hundred_womens_2026',
  '{
    "max_entrants_per_instance": 48,
    "governing_body": "ECB",
    "ball_format": "100-ball",
    "team_count": 8,
    "league_matches_per_team": 8,
    "league_total_matches": 32,
    "playoff_qualify_count": 3,
    "playoff_shape": "top3_eliminator",
    "allow_draw": false,
    "tie_breaker": "super_over"
  }'::jsonb,
  'upcoming',
  '2026-07-21T00:00:00Z',
  '2026-08-16T23:59:59Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000101', 'a0000000-0000-0000-0000-000000000101', 'league', 'League Stage', 1, 'group',
   '{"date_range": ["2026-07-21", "2026-08-12"], "team_count": 8, "matches_per_team": 8, "total_matches": 32, "qualify_count": 3}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0002-000000000101', 'a0000000-0000-0000-0000-000000000101', 'eliminator', 'Eliminator', 2, 'knockout',
   '{"date_range": ["2026-08-14", "2026-08-14"], "total_matches": 1, "matchup": {"home": "2", "away": "3"}}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0003-000000000101', 'a0000000-0000-0000-0000-000000000101', 'final', 'Final', 3, 'knockout',
   '{"date_range": ["2026-08-16", "2026-08-16"], "total_matches": 1, "matchup": {"home": "1", "away": "eliminator_winner"}}'::jsonb, 'upcoming')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
SELECT
  'c0000000-0000-0000-0000-000000000101',
  'the_hundred_womens_2026',
  'The Hundred Women''s 2026',
  'cricket',
  'league_plus_playoff',
  config
FROM public.bracket_templates
WHERE id = 'c0000000-0000-0000-0000-000000000100'
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Instances + 4. Fixture seed (DO block: needs ids)
-- ============================================================

DO $$
DECLARE
  v_admin_id uuid;
  v_mens_comp uuid;
  v_womens_comp uuid;
  v_event_id uuid;
  rec record;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE email = 'eoinmaleoin@gmail.com';
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;

  -- 3a. Rename existing instance #1 -> men's
  UPDATE public.competitions
  SET name = 'The Hundred Men''s 2026'
  WHERE tournament_id = 'a0000000-0000-0000-0000-000000000100'
    AND instance_number = 1
  RETURNING id INTO v_mens_comp;

  IF v_mens_comp IS NULL THEN
    SELECT id INTO v_mens_comp FROM public.competitions
    WHERE tournament_id = 'a0000000-0000-0000-0000-000000000100' AND instance_number = 1;
  END IF;
  IF v_mens_comp IS NULL THEN
    RAISE EXCEPTION 'Men''s Hundred instance #1 not found — run 20260720110000 first';
  END IF;

  -- 3b. Women's instance #1 (recipe from 20260720100000)
  SELECT id INTO v_womens_comp FROM public.competitions
  WHERE tournament_id = 'a0000000-0000-0000-0000-000000000101' AND instance_number = 1;

  IF v_womens_comp IS NULL THEN
    INSERT INTO public.competitions (
      id, name, type, visibility, status, scoring_rules,
      created_by, invite_code, tournament_id, product_mode,
      max_entrants, chat_enabled, instance_type, instance_number
    ) VALUES (
      gen_random_uuid(),
      'The Hundred Women''s 2026',
      'open', 'public', 'active', '{}'::jsonb,
      v_admin_id,
      encode(gen_random_bytes(6), 'hex'),
      'a0000000-0000-0000-0000-000000000101',
      'predictsport_full',
      48, true, 'full', 1
    ) RETURNING id INTO v_womens_comp;
    RAISE NOTICE 'Created instance #1: The Hundred Women''s 2026';
  END IF;

  -- 3c. Join the 8 seed fans to the women's instance (triggers ON)
  INSERT INTO public.competition_members (competition_id, user_id, role)
  SELECT v_womens_comp, u.id, 'participant'
  FROM public.users u
  WHERE u.email LIKE 'seed-fan-%@synthetic.predictsport.local'
  ON CONFLICT (competition_id, user_id) DO NOTHING;

  -- 4a. Men's league fixtures (32) — skip if any events already seeded
  IF NOT EXISTS (
    SELECT 1 FROM public.events WHERE tournament_id = 'a0000000-0000-0000-0000-000000000100'
  ) THEN
    FOR rec IN
      SELECT * FROM (VALUES
      ('MI London', 'Sunrisers Leeds', '2026-07-21T17:30:00Z'::timestamptz, '1521231'),
      ('Southern Brave', 'Welsh Fire', '2026-07-22T17:30:00Z'::timestamptz, '1521232'),
      ('London Spirit', 'Manchester Super Giants', '2026-07-23T17:30:00Z'::timestamptz, '1521233'),
      ('Birmingham Phoenix', 'Trent Rockets', '2026-07-24T17:30:00Z'::timestamptz, '1521234'),
      ('Sunrisers Leeds', 'Southern Brave', '2026-07-25T13:30:00Z'::timestamptz, '1521235'),
      ('Welsh Fire', 'MI London', '2026-07-25T17:00:00Z'::timestamptz, '1521236'),
      ('Manchester Super Giants', 'Birmingham Phoenix', '2026-07-26T13:30:00Z'::timestamptz, '1521237'),
      ('Trent Rockets', 'London Spirit', '2026-07-26T17:00:00Z'::timestamptz, '1521238'),
      ('Southern Brave', 'MI London', '2026-07-27T17:30:00Z'::timestamptz, '1521239'),
      ('Sunrisers Leeds', 'Manchester Super Giants', '2026-07-28T17:30:00Z'::timestamptz, '1521240'),
      ('Welsh Fire', 'Trent Rockets', '2026-07-29T14:00:00Z'::timestamptz, '1521241'),
      ('MI London', 'London Spirit', '2026-07-29T17:30:00Z'::timestamptz, '1521242'),
      ('Southern Brave', 'Birmingham Phoenix', '2026-07-30T17:30:00Z'::timestamptz, '1521243'),
      ('Manchester Super Giants', 'Trent Rockets', '2026-07-31T17:30:00Z'::timestamptz, '1521244'),
      ('Birmingham Phoenix', 'Welsh Fire', '2026-08-01T13:30:00Z'::timestamptz, '1521245'),
      ('London Spirit', 'Southern Brave', '2026-08-01T17:00:00Z'::timestamptz, '1521246'),
      ('Trent Rockets', 'Sunrisers Leeds', '2026-08-02T13:30:00Z'::timestamptz, '1521247'),
      ('MI London', 'Manchester Super Giants', '2026-08-02T17:00:00Z'::timestamptz, '1521248'),
      ('Welsh Fire', 'Southern Brave', '2026-08-03T17:30:00Z'::timestamptz, '1521249'),
      ('Sunrisers Leeds', 'London Spirit', '2026-08-04T17:30:00Z'::timestamptz, '1521250'),
      ('Manchester Super Giants', 'Welsh Fire', '2026-08-05T14:00:00Z'::timestamptz, '1521251'),
      ('Trent Rockets', 'Birmingham Phoenix', '2026-08-05T17:30:00Z'::timestamptz, '1521252'),
      ('London Spirit', 'MI London', '2026-08-06T17:30:00Z'::timestamptz, '1521253'),
      ('Birmingham Phoenix', 'Sunrisers Leeds', '2026-08-07T17:30:00Z'::timestamptz, '1521254'),
      ('MI London', 'Trent Rockets', '2026-08-08T13:30:00Z'::timestamptz, '1521255'),
      ('Southern Brave', 'Manchester Super Giants', '2026-08-08T17:00:00Z'::timestamptz, '1521256'),
      ('Sunrisers Leeds', 'Welsh Fire', '2026-08-09T13:30:00Z'::timestamptz, '1521257'),
      ('London Spirit', 'Birmingham Phoenix', '2026-08-09T17:00:00Z'::timestamptz, '1521258'),
      ('Trent Rockets', 'Southern Brave', '2026-08-10T17:30:00Z'::timestamptz, '1521259'),
      ('Manchester Super Giants', 'Sunrisers Leeds', '2026-08-11T17:30:00Z'::timestamptz, '1521260'),
      ('Welsh Fire', 'London Spirit', '2026-08-12T14:00:00Z'::timestamptz, '1521261'),
      ('Birmingham Phoenix', 'MI London', '2026-08-12T17:30:00Z'::timestamptz, '1521262')
      ) AS t(home_team, away_team, start_ts, ext_id)
    LOOP
      INSERT INTO public.events (
        competition_id, tournament_id, event_name, sport,
        provider_league, external_event_id,
        start_time, lock_time, status
      ) VALUES (
        v_mens_comp,
        'a0000000-0000-0000-0000-000000000100',
        rec.home_team || ' v ' || rec.away_team,
        'cricket',
        'cricket/19601',
        rec.ext_id,
        rec.start_ts,
        rec.start_ts - interval '10 minutes',
        'upcoming'
      ) RETURNING id INTO v_event_id;

      INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
      VALUES (
        v_event_id, 'winner', 2,
        jsonb_build_object('options', jsonb_build_array(rec.home_team, rec.away_team))
      );
    END LOOP;
    RAISE NOTICE 'Seeded 32 men''s league fixtures';
  ELSE
    RAISE NOTICE 'Men''s events already exist — skipping fixture seed';
  END IF;

  -- 4b. Women's league fixtures (32)
  IF NOT EXISTS (
    SELECT 1 FROM public.events WHERE tournament_id = 'a0000000-0000-0000-0000-000000000101'
  ) THEN
    FOR rec IN
      SELECT * FROM (VALUES
      ('MI London', 'Sunrisers Leeds', '2026-07-21T13:45:00Z'::timestamptz, '1521197'),
      ('Southern Brave', 'Welsh Fire', '2026-07-22T14:00:00Z'::timestamptz, '1521198'),
      ('London Spirit', 'Manchester Super Giants', '2026-07-23T14:00:00Z'::timestamptz, '1521199'),
      ('Birmingham Phoenix', 'Trent Rockets', '2026-07-24T14:00:00Z'::timestamptz, '1521200'),
      ('Sunrisers Leeds', 'Southern Brave', '2026-07-25T10:00:00Z'::timestamptz, '1521201'),
      ('Welsh Fire', 'MI London', '2026-07-25T13:30:00Z'::timestamptz, '1521202'),
      ('Manchester Super Giants', 'Birmingham Phoenix', '2026-07-26T10:00:00Z'::timestamptz, '1521203'),
      ('Trent Rockets', 'London Spirit', '2026-07-26T13:30:00Z'::timestamptz, '1521204'),
      ('Southern Brave', 'MI London', '2026-07-27T14:00:00Z'::timestamptz, '1521205'),
      ('Sunrisers Leeds', 'Manchester Super Giants', '2026-07-28T14:00:00Z'::timestamptz, '1521206'),
      ('Welsh Fire', 'Trent Rockets', '2026-07-29T10:30:00Z'::timestamptz, '1521207'),
      ('MI London', 'London Spirit', '2026-07-29T14:00:00Z'::timestamptz, '1521208'),
      ('Southern Brave', 'Birmingham Phoenix', '2026-07-30T14:00:00Z'::timestamptz, '1521209'),
      ('Manchester Super Giants', 'Trent Rockets', '2026-07-31T14:00:00Z'::timestamptz, '1521210'),
      ('Birmingham Phoenix', 'Welsh Fire', '2026-08-01T10:00:00Z'::timestamptz, '1521211'),
      ('London Spirit', 'Southern Brave', '2026-08-01T13:30:00Z'::timestamptz, '1521212'),
      ('Trent Rockets', 'Sunrisers Leeds', '2026-08-02T10:00:00Z'::timestamptz, '1521213'),
      ('MI London', 'Manchester Super Giants', '2026-08-02T13:30:00Z'::timestamptz, '1521214'),
      ('Welsh Fire', 'Southern Brave', '2026-08-03T14:00:00Z'::timestamptz, '1521215'),
      ('Sunrisers Leeds', 'London Spirit', '2026-08-04T14:00:00Z'::timestamptz, '1521216'),
      ('Manchester Super Giants', 'Welsh Fire', '2026-08-05T10:30:00Z'::timestamptz, '1521217'),
      ('Trent Rockets', 'Birmingham Phoenix', '2026-08-05T14:00:00Z'::timestamptz, '1521218'),
      ('London Spirit', 'MI London', '2026-08-06T14:00:00Z'::timestamptz, '1521219'),
      ('Birmingham Phoenix', 'Sunrisers Leeds', '2026-08-07T14:00:00Z'::timestamptz, '1521220'),
      ('MI London', 'Trent Rockets', '2026-08-08T10:00:00Z'::timestamptz, '1521221'),
      ('Southern Brave', 'Manchester Super Giants', '2026-08-08T13:30:00Z'::timestamptz, '1521222'),
      ('Sunrisers Leeds', 'Welsh Fire', '2026-08-09T10:00:00Z'::timestamptz, '1521223'),
      ('London Spirit', 'Birmingham Phoenix', '2026-08-09T13:30:00Z'::timestamptz, '1521224'),
      ('Trent Rockets', 'Southern Brave', '2026-08-10T14:00:00Z'::timestamptz, '1521225'),
      ('Manchester Super Giants', 'Sunrisers Leeds', '2026-08-11T14:00:00Z'::timestamptz, '1521226'),
      ('Welsh Fire', 'London Spirit', '2026-08-12T10:30:00Z'::timestamptz, '1521227'),
      ('Birmingham Phoenix', 'MI London', '2026-08-12T14:00:00Z'::timestamptz, '1521228')
      ) AS t(home_team, away_team, start_ts, ext_id)
    LOOP
      INSERT INTO public.events (
        competition_id, tournament_id, event_name, sport,
        provider_league, external_event_id,
        start_time, lock_time, status
      ) VALUES (
        v_womens_comp,
        'a0000000-0000-0000-0000-000000000101',
        rec.home_team || ' v ' || rec.away_team,
        'cricket',
        'cricket/19663',
        rec.ext_id,
        rec.start_ts,
        rec.start_ts - interval '10 minutes',
        'upcoming'
      ) RETURNING id INTO v_event_id;

      INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
      VALUES (
        v_event_id, 'winner', 2,
        jsonb_build_object('options', jsonb_build_array(rec.home_team, rec.away_team))
      );
    END LOOP;
    RAISE NOTICE 'Seeded 32 women''s league fixtures';
  ELSE
    RAISE NOTICE 'Women''s events already exist — skipping fixture seed';
  END IF;
END $$;
