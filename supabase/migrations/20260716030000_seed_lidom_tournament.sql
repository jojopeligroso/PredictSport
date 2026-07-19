-- Seed: Liga de Beisbol Dominicano (LIDOM) 2025-26 — full competitive arc.
--
-- VERIFIED against MLB Stats API (statsapi.mlb.com, sportId=17, leagueId=131):
--   Regular season: 6 teams, 50 games/team, no split season, no playoff points.
--   Standing: pure W-L record. No points system. Top 4 qualify.
--   No wild card (hasWildCard: false).
--   Round Robin (Serie Semifinal): 4 teams, 18 games/team, 6 per matchup pair,
--     36 total games. Top 2 advance to Final.
--     (Verified: 2023-24 = 36 games/18 per team, 2025-26 = 36 games/18 per team.
--      Exception: 2024-25 = 30 games/15 per team/5 per pair — format varies by season.)
--   Championship (Serie Final): best-of-9 for 2025-26.
--     (Verified: 2025-26 Leones won 5-0 in 5 games — series continued past 4-0,
--      proving bo9 not bo7. 2023-24 and 2024-25 were bo7 — format changed.)
--   Home format: alternating 1-1-1-1 (RR 1st hosts odd games).
--     (Verified across 3 seasons: 2023-24 Estrellas RR 1st hosted G1,G3,G5,G7;
--      2024-25 Tigres RR 1st hosted G1,G3,G5,G7;
--      2025-26 Leones RR 1st hosted G1,G3,G5.)
--   Champion represents Dominican Republic at the Serie del Caribe.
--
-- Season dates (API seasonDateInfo, season=2025):
--   Regular season: 2025-10-15 to 2025-12-23
--   Round Robin: 2025-12-27 to 2026-01-19
--   Championship: 2026-01-21 to 2026-01-27
--   Serie del Caribe 2026: Feb 1-7 (Jalisco, Mexico)
--
-- Teams (verified from 2025-26 API schedule responses, exact API spelling):
--   Aguilas Cibaenas, Estrellas Orientales, Gigantes del Cibao,
--   Leones del Escogido, Tigres del Licey, Toros del Este
--
-- provider_league: "winter/lidom" (routes to mlb-stats-winter provider)
-- No draws (extra innings decide).

-- ============================================================
-- 1. Sporting Tournament
-- ============================================================

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000203',
  'lidom-2025-26',
  'Liga de Beisbol Dominicano 2025-26',
  'baseball',
  'lidom_2025_26',
  '{
    "governing_body": "LIDOM",
    "region": "Dominican Republic",
    "team_count": 6,
    "regular_season_games_per_team": 50,
    "split_season": false,
    "standing_system": "win_loss",
    "standing_note": "Pure W-L record determines seeding. Top 4 qualify for Round Robin.",
    "playoff_qualify_count": 4,
    "has_wild_card": false,
    "round_robin_playoff": {
      "teams": 4,
      "games_per_team": 18,
      "meetings_per_pair": 6,
      "total_games": 36,
      "advance": 2,
      "tiebreaker": "head_to_head",
      "_varies_by_season": "2024-25 had 15 games/team (5 per pair, 30 total). 2023-24 and 2025-26 had 18/6/36. Verify each season.",
      "verify_before_launch": true
    },
    "final_best_of": 9,
    "home_format": "alternating_1_1",
    "home_advantage": "round_robin_1st_hosts_odd_games",
    "_final_format_note": "2025-26 changed to bo9 (verified: 5-0 sweep in 5 games, series continued past 4-0). 2023-24 and 2024-25 were bo7. Verify each season.",
    "allow_draw": false,
    "champion_qualifies_for": "caribbean_series",
    "provider_league": "winter/lidom",
    "roster_confirmable_per_season": true,
    "verify_before_launch": true
  }'::jsonb,
  'upcoming',
  '2025-10-15T00:00:00Z',
  '2026-02-07T23:59:59Z'
);

-- ============================================================
-- 2. Sporting Stages (6 stages: RS + RR + Final + 3 SdC)
-- ============================================================

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  -- Domestic: Regular Season (Serie Regular)
  ('b0000000-0000-0000-0001-000000000203', 'a0000000-0000-0000-0000-000000000203',
   'regular-season', 'Serie Regular', 1, 'group',
   '{"date_range": ["2025-10-15", "2025-12-23"],
     "team_count": 6, "games_per_team": 50,
     "standing_system": "win_loss",
     "qualify_count": 4,
     "produces": "seeds_1_4"}'::jsonb,
   'upcoming'),

  -- Domestic: Round Robin (Serie Semifinal)
  ('b0000000-0000-0000-0002-000000000203', 'a0000000-0000-0000-0000-000000000203',
   'round-robin', 'Round Robin (Serie Semifinal)', 2, 'group',
   '{"date_range": ["2025-12-27", "2026-01-19"],
     "teams": 4,
     "entrants": ["seed_1", "seed_2", "seed_3", "seed_4"],
     "games_per_team": 18,
     "meetings_per_pair": 6,
     "total_games": 36,
     "standing_system": "win_loss",
     "tiebreaker": "head_to_head",
     "advance": 2,
     "produces": ["rr_1st", "rr_2nd"]}'::jsonb,
   'upcoming'),

  -- Domestic: Championship (Serie Final)
  ('b0000000-0000-0000-0003-000000000203', 'a0000000-0000-0000-0000-000000000203',
   'final', 'Serie Final', 3, 'knockout',
   '{"date_range": ["2026-01-21", "2026-01-27"],
     "series_best_of": 9,
     "home_format": "alternating_1_1",
     "home_advantage": "rr_1st_hosts_odd_games",
     "seeding": {"home": "rr_1st", "away": "rr_2nd"},
     "_evidence": "2025-26: Leones (RR 1st) won 5-0 in 5 games. Series went to G5 proving bo9 not bo7. 2023-24 and 2024-25 were bo7."}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Pool
  ('b0000000-0000-0000-0004-000000000203', 'a0000000-0000-0000-0000-000000000203',
   'sdc-pool', 'Serie del Caribe Pool', 4, 'group',
   '{"date_range": ["2026-02-01", "2026-02-05"],
     "team_count": 5, "format": "single_round_robin",
     "games_per_team": 4, "total_games": 10, "advance": 4}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Semifinals
  ('b0000000-0000-0000-0005-000000000203', 'a0000000-0000-0000-0000-000000000203',
   'sdc-semifinals', 'Serie del Caribe Semifinals', 5, 'knockout',
   '{"date_range": ["2026-02-06", "2026-02-06"],
     "matches": 2,
     "seeding": [
       {"slot": "sdc_sf_1", "home": "pool_1st", "away": "pool_4th"},
       {"slot": "sdc_sf_2", "home": "pool_2nd", "away": "pool_3rd"}
     ]}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Final
  ('b0000000-0000-0000-0006-000000000203', 'a0000000-0000-0000-0000-000000000203',
   'sdc-final', 'Serie del Caribe Final', 6, 'knockout',
   '{"date_range": ["2026-02-07", "2026-02-07"], "matches": 1}'::jsonb,
   'upcoming');

-- ============================================================
-- 3. Bracket Template
-- ============================================================

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000203',
  'lidom_2025_26',
  'Liga de Beisbol Dominicano 2025-26',
  'baseball',
  'league_plus_playoff',
  '{
    "format": "roundrobin_final_plus_caribbean",
    "seedsFromTable": true,
    "leagueTeams": [
      "Aguilas Cibaenas",
      "Estrellas Orientales",
      "Gigantes del Cibao",
      "Leones del Escogido",
      "Tigres del Licey",
      "Toros del Este"
    ],
    "_leagueTeams_note": "2025-26 membership verified via MLB Stats API schedule (sportId=17, leagueId=131). Exact API spelling. Re-confirm each season.",
    "roundRobin": {
      "name": "Round Robin (Serie Semifinal)",
      "teams": 4,
      "entrants": ["seed_1", "seed_2", "seed_3", "seed_4"],
      "gamesPerTeam": 18,
      "meetingsPerPair": 6,
      "totalGames": 36,
      "standingSystem": "win_loss",
      "tiebreaker": "head_to_head",
      "advance": 2,
      "producesFinalists": ["rr_1st", "rr_2nd"],
      "_evidence": "2023-24: 36 games, 18/team, 6/pair. 2024-25: 30 games, 15/team, 5/pair. 2025-26: 36 games, 18/team, 6/pair. Format varies by season.",
      "verify_before_launch": true
    },
    "finalRound": {
      "name": "Serie Final",
      "bestOf": 9,
      "homeFormat": "alternating_1_1",
      "slotIds": ["final_1"],
      "seeding": {"final_1": {"home": "rr_1st", "away": "rr_2nd"}},
      "_home_note": "RR 1st-place hosts odd games (G1,G3,G5,G7,G9). Verified across 3 seasons.",
      "_format_note": "2025-26 = bo9 (verified: 5-0 in 5 games). 2023-24 and 2024-25 = bo7. Format changed.",
      "verify_before_launch": true
    },
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
    "champion": {"slotId": "final_1", "qualifiesFor": "sdc-pool.dominican_slot"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
