-- Seed: Serie del Caribe 2027 — standalone blueprint (tournament only, no domestic league).
--
-- For casual predictors who want to predict the SdC without following a specific
-- domestic league. Domestic-league blueprints (LMP/LVBP/LIDOM/LBPRC) carry their
-- own embedded SdC stages; this blueprint is the SdC as an independent event.
--
-- Format evidence:
--   6 teams: 4 league champions (LMP/Mexico, LVBP/Venezuela, LIDOM/Dominican
--   Republic, LBPRC/Puerto Rico) + 2 invitational/host slots, per CBPC
--   expansion format used in recent editions (2023 Gran Caracas: 8; 2024 Miami: 8;
--   2025 Mexicali: 5 after VEN withdrawal; 6-team pool is the structural baseline
--   with 2 invitational slots).
--   Pool: single round-robin, each team plays 5 games, 15 games total, top 4 advance.
--   Semifinals: single games, 1st v 4th and 2nd v 3rd.
--   Final: single game, winner takes the title.
--
-- Dates: Feb 2027 placeholders — 2027 edition schedule not yet announced.
-- provider_league: "winter/sdc" (routes to mlb-stats-winter provider).
-- No draws (extra innings decide).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sporting_tournaments WHERE slug = 'sdc-2027') THEN
    RAISE NOTICE 'sdc-2027 already seeded, skipping';
    RETURN;
  END IF;

  -- ============================================================
  -- 1. Sporting Tournament
  -- ============================================================
  INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
  VALUES (
    'a0000000-0000-0000-0000-000000000209',
    'sdc-2027',
    'Serie del Caribe',
    'baseball',
    'sdc',
    '{
      "max_entrants_per_instance": 48,
      "governing_body": "Confederación de Béisbol Profesional del Caribe (CBPC)",
      "region": "Caribbean",
      "num_teams": 6,
      "team_composition": "4 league champions (LMP, LVBP, LIDOM, LBPRC) + 2 invitational/host slots",
      "standing_system": "w-l",
      "allow_draw": false,
      "provider_league": "winter/sdc",
      "_dates_note": "Feb 2027 placeholder dates; 2027 edition schedule not yet announced."
    }'::jsonb,
    'upcoming',
    '2027-02-01T00:00:00Z',
    '2027-02-07T23:59:59Z'
  );

  -- ============================================================
  -- 2. Sporting Stages (3: Pool, Semifinals, Final)
  -- ============================================================
  INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
    ('b0000000-0000-0000-0001-000000000209', 'a0000000-0000-0000-0000-000000000209',
     'pool', 'Pool', 1, 'group',
     '{"date_range": ["2027-02-01", "2027-02-05"],
       "team_count": 6, "format": "single_round_robin",
       "games_per_team": 5, "total_games": 15,
       "standing_system": "w-l",
       "advance": 4,
       "produces": ["pool_1st", "pool_2nd", "pool_3rd", "pool_4th"]}'::jsonb,
     'upcoming'),

    ('b0000000-0000-0000-0002-000000000209', 'a0000000-0000-0000-0000-000000000209',
     'semifinals', 'Semifinals', 2, 'knockout',
     '{"date_range": ["2027-02-06", "2027-02-06"],
       "format": "single_elimination",
       "matches": 2,
       "seeding": [
         {"slot": "sf_1", "home": "pool_1st", "away": "pool_4th"},
         {"slot": "sf_2", "home": "pool_2nd", "away": "pool_3rd"}
       ],
       "games_per_match": 1}'::jsonb,
     'upcoming'),

    ('b0000000-0000-0000-0003-000000000209', 'a0000000-0000-0000-0000-000000000209',
     'final', 'Final', 3, 'knockout',
     '{"date_range": ["2027-02-07", "2027-02-07"],
       "matches": 1, "games_per_match": 1,
       "_note": "Single game, winner takes the title."}'::jsonb,
     'upcoming');

  -- ============================================================
  -- 3. Bracket Template
  -- ============================================================
  INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
  VALUES (
    'c0000000-0000-0000-0000-000000000209',
    'sdc',
    'Serie del Caribe',
    'baseball',
    'group_plus_knockout',
    '{
      "format": "pool_semifinals_final",
      "seedsFromTable": true,
      "pool": {
        "teamCount": 6,
        "format": "single_round_robin",
        "gamesPerTeam": 5,
        "totalGames": 15,
        "standingSystem": "w-l",
        "advance": 4
      },
      "semifinals": {
        "matches": 2,
        "seeding": [
          {"home": "pool_1st", "away": "pool_4th"},
          {"home": "pool_2nd", "away": "pool_3rd"}
        ]
      },
      "finalRound": {"name": "Final", "matches": 1, "slotIds": ["final_1"]},
      "champion": {"slotId": "final_1"},
      "thirdPlacePlayoff": false,
      "_teams_note": "Participants vary per edition (4 league champions + invitational/host slots). Confirm rosters when the 2027 field is announced."
    }'::jsonb
  );
END $$;
