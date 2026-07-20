-- Seed: Liga Mexicana del Pacífico (LMP) 2025-26 — full competitive arc.
--
-- VERIFIED against MLB Stats API (statsapi.mlb.com, sportId=17, leagueId=132)
-- and LMP official site (lmp.mx/sistema-de-competencia):
--   Regular season: 10 teams, 68 games/team, split season (1st half ends Nov 22)
--   Standing: POINTS SYSTEM — each half awards 10/9/8/7/6/5.5/5/4.5/4/3.5 pts
--     by position. Sum of both halves = Standing General de Puntos. Seeding is
--     by points total, NOT cumulative W-L.
--   Playoffs: top 8 (by points), FIXED BRACKET bo7 (QF/SF/Final)
--     QF: 1v8, 2v7, 3v6, 4v5
--     SF: W(1v8) vs W(4v5), W(2v7) vs W(3v6) — fixed paths, NOT reseeded
--     Home advantage: better regular-season record hosts games 1-2 and 6-7 (2-3-2)
--   Champion → Serie del Caribe (Mexico slot)
--
-- Serie del Caribe (leagueId=162): 5-team single round-robin (4 games each)
--   → top 4 to SF (1v4, 2v3) → single-game Final.
--   2026 edition: Feb 1-7, Estadio Panamericano, Jalisco.
--
-- Teams (verified 2025-26 via API schedule responses):
--   Charros de Jalisco, Tomateros de Culiacán, Naranjeros de Hermosillo,
--   Águilas de Mexicali, Venados de Mazatlán, Yaquis de Obregón,
--   Cañeros de Los Mochis, Algodoneros de Guasave, Jaguares de Nayarit,
--   Tucson Baseball Team
--
-- provider_league: "winter/lmp" (routes to mlb-stats-winter provider)
-- No draws (extra innings decide).

-- ============================================================
-- 1. Sporting Tournament
-- ============================================================

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000201',
  'lmp-2025-26',
  'Liga Mexicana del Pacífico 2025-26',
  'baseball',
  'lmp_2025_26',
  '{
    "max_entrants_per_instance": 48,
    "governing_body": "LMP",
    "region": "Mexico",
    "team_count": 10,
    "regular_season_games_per_team": 68,
    "split_season": true,
    "standing_system": "points",
    "points_per_half": {
      "1st": 10.0, "2nd": 9.0, "3rd": 8.0, "4th": 7.0, "5th": 6.0,
      "6th": 5.5, "7th": 5.0, "8th": 4.5, "9th": 4.0, "10th": 3.5
    },
    "standing_note": "Each half (vuelta) awards points by W-L position. Sum of both halves = Standing General de Puntos. Top 8 qualify; this determines playoff seeding, NOT cumulative W-L.",
    "playoff_qualify_count": 8,
    "playoff_shape": "fixed_bracket",
    "series_best_of": 7,
    "home_format": "2-3-2",
    "allow_draw": false,
    "has_wild_card": false,
    "champion_qualifies_for": "caribbean_series",
    "provider_league": "winter/lmp",
    "roster_confirmable_per_season": true
  }'::jsonb,
  'upcoming',
  '2025-10-14T00:00:00Z',
  '2026-02-07T23:59:59Z'
);

-- ============================================================
-- 2. Sporting Stages (7 stages: RS + 3 playoff + 3 SdC)
-- ============================================================

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  -- Domestic: Regular Season
  ('b0000000-0000-0000-0001-000000000201', 'a0000000-0000-0000-0000-000000000201',
   'regular-season', 'Regular Season', 1, 'group',
   '{"date_range": ["2025-10-14", "2025-12-30"],
     "team_count": 10, "games_per_team": 68,
     "split": {"first_half_ends": "2025-11-22", "second_half_starts": "2025-11-24"},
     "standing_system": "points_per_half",
     "qualify_count": 8, "produces": "seeds_1_8_by_points"}'::jsonb,
   'upcoming'),

  -- Domestic: Quarterfinals (fixed bracket)
  ('b0000000-0000-0000-0002-000000000201', 'a0000000-0000-0000-0000-000000000201',
   'quarterfinals', 'Quarterfinals', 2, 'knockout',
   '{"date_range": ["2026-01-01", "2026-01-09"],
     "series_best_of": 7, "series_count": 4, "home_format": "2-3-2",
     "seeding": [
       {"slot": "qf_1", "home": "seed_1", "away": "seed_8"},
       {"slot": "qf_2", "home": "seed_2", "away": "seed_7"},
       {"slot": "qf_3", "home": "seed_3", "away": "seed_6"},
       {"slot": "qf_4", "home": "seed_4", "away": "seed_5"}
     ]}'::jsonb,
   'upcoming'),

  -- Domestic: Semifinals (fixed bracket — W(1v8) vs W(4v5), W(2v7) vs W(3v6))
  ('b0000000-0000-0000-0003-000000000201', 'a0000000-0000-0000-0000-000000000201',
   'semifinals', 'Semifinals', 3, 'knockout',
   '{"date_range": ["2026-01-11", "2026-01-19"],
     "series_best_of": 7, "series_count": 2, "home_format": "2-3-2",
     "bracket": "fixed",
     "seeding": [
       {"slot": "sf_1", "home": "qf_1_winner", "away": "qf_4_winner"},
       {"slot": "sf_2", "home": "qf_2_winner", "away": "qf_3_winner"}
     ],
     "home_advantage": "better_regular_season_record"}'::jsonb,
   'upcoming'),

  -- Domestic: Serie de México (Final)
  ('b0000000-0000-0000-0004-000000000201', 'a0000000-0000-0000-0000-000000000201',
   'final', 'Serie de México', 4, 'knockout',
   '{"date_range": ["2026-01-21", "2026-01-29"],
     "series_best_of": 7, "home_format": "2-3-2",
     "home_advantage": "better_regular_season_record"}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Pool
  ('b0000000-0000-0000-0005-000000000201', 'a0000000-0000-0000-0000-000000000201',
   'sdc-pool', 'Serie del Caribe Pool', 5, 'group',
   '{"date_range": ["2026-02-01", "2026-02-05"],
     "team_count": 5, "format": "single_round_robin",
     "games_per_team": 4, "total_games": 10, "advance": 4}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Semifinals
  ('b0000000-0000-0000-0006-000000000201', 'a0000000-0000-0000-0000-000000000201',
   'sdc-semifinals', 'Serie del Caribe Semifinals', 6, 'knockout',
   '{"date_range": ["2026-02-06", "2026-02-06"],
     "matches": 2,
     "seeding": [
       {"slot": "sdc_sf_1", "home": "pool_1st", "away": "pool_4th"},
       {"slot": "sdc_sf_2", "home": "pool_2nd", "away": "pool_3rd"}
     ]}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Final
  ('b0000000-0000-0000-0007-000000000201', 'a0000000-0000-0000-0000-000000000201',
   'sdc-final', 'Serie del Caribe Final', 7, 'knockout',
   '{"date_range": ["2026-02-07", "2026-02-07"], "matches": 1}'::jsonb,
   'upcoming');

-- ============================================================
-- 3. Bracket Template
-- ============================================================

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000201',
  'lmp_2025_26',
  'Liga Mexicana del Pacífico 2025-26',
  'baseball',
  'league_plus_playoff',
  '{
    "format": "fixed_bracket_plus_caribbean",
    "bracket": "fixed",
    "seriesBestOf": 7,
    "homeFormat": "2-3-2",
    "qualifyCount": 8,
    "seedsFromTable": true,
    "leagueTeams": [
      "Charros de Jalisco",
      "Tomateros de Culiacán",
      "Naranjeros de Hermosillo",
      "Águilas de Mexicali",
      "Venados de Mazatlán",
      "Yaquis de Obregón",
      "Cañeros de Los Mochis",
      "Algodoneros de Guasave",
      "Jaguares de Nayarit",
      "Tucson Baseball Team"
    ],
    "_leagueTeams_note": "2025-26 membership verified via MLB Stats API schedule. Tucson replaced Mayos de Navojoa; Jaguares de Nayarit is a new franchise. Re-confirm each season.",
    "playoffRounds": [
      {
        "roundKey": "quarterfinals",
        "name": "Quarterfinals",
        "seriesCount": 4,
        "bestOf": 7,
        "slotIds": ["qf_1", "qf_2", "qf_3", "qf_4"],
        "seeding": {
          "qf_1": {"home": "seed_1", "away": "seed_8"},
          "qf_2": {"home": "seed_2", "away": "seed_7"},
          "qf_3": {"home": "seed_3", "away": "seed_6"},
          "qf_4": {"home": "seed_4", "away": "seed_5"}
        }
      },
      {
        "roundKey": "semifinals",
        "name": "Semifinals",
        "seriesCount": 2,
        "bestOf": 7,
        "slotIds": ["sf_1", "sf_2"],
        "seeding": {
          "sf_1": {"home": "qf_1_winner", "away": "qf_4_winner"},
          "sf_2": {"home": "qf_2_winner", "away": "qf_3_winner"}
        },
        "_seeding_note": "Fixed bracket: W(1v8) vs W(4v5), W(2v7) vs W(3v6). Home advantage goes to the team with the better regular-season record, NOT the original higher seed."
      },
      {
        "roundKey": "final",
        "name": "Serie de México",
        "seriesCount": 1,
        "bestOf": 7,
        "slotIds": ["final_1"],
        "_home_note": "Better regular-season record hosts games 1-2 and 6-7."
      }
    ],
    "caribbeanSeries": {
      "pool": {
        "teamCount": 5,
        "format": "single_round_robin",
        "gamesPerTeam": 4,
        "advance": 4
      },
      "semifinals": {
        "matches": 2,
        "seeding": [
          {"home": "pool_1st", "away": "pool_4th"},
          {"home": "pool_2nd", "away": "pool_3rd"}
        ]
      },
      "final": {"matches": 1}
    },
    "champion": {"slotId": "final_1", "qualifiesFor": "sdc-pool.mexico_slot"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
