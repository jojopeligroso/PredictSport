-- Seed: Liga de Beisbol Profesional de la Republica Dominicana (LIDOM) 2025-26
--   — full competitive arc.
--
-- VERIFICATION NOTE: The MLB Stats API (statsapi.mlb.com, sportId=17,
--   leagueId=131) is the canonical provider for this blueprint (routing wired in
--   registry.ts as "winter/lidom"), but it was egress-blocked in the session that
--   authored this seed, so the structure below was NOT re-traced from raw API game
--   data the way LVBP/LMP were. Instead it is corroborated across multiple
--   authoritative sources for the COMPLETED 2025-26 season:
--     - Wikipedia (EN "2025-26 LIDOM season", ES equivalent)
--     - Official league site lidom.com (Serie Final calendar announcement)
--     - ESPN Deportes (beisbol invernal round-robin coverage)
--     - World Baseball Network (schedule announcement, 50-game slate)
--   The LIDOM bracket is structurally unambiguous (no wild card, no reseed:
--   the round robin directly produces the two finalists), so cross-source
--   corroboration is sufficient. Items not independently traceable this session
--   are flagged "verify_before_launch": true.
--
-- Format (2025-26, corroborated):
--   Regular season (Serie Regular): 6 teams, 50 games/team (10 vs each opponent,
--     5 home / 5 away). Pure W-L standing. Top 4 advance. 2025-10-15 to 2025-12-23.
--   Round Robin (Serie Semifinal): 4 teams, 18 games/team (6 vs each opponent,
--     3 home / 3 away), 36 total games. Pure W-L standing. Top 2 advance.
--     2025-12-27 to 2026-01-17.
--   Serie Final: best-of-7. Home advantage = round-robin 1st place
--     ("the first-classified team has home-field advantage").
--     (Older editions used best-of-9; series length is CONFIG-DRIVEN, bo7 for 2026.)
--   Champion represents the Dominican Republic at the Serie del Caribe.
--     (2026 SdC: Estadio Panamericano de Beisbol, Zapopan/Jalisco, Mexico, Feb 1-7.)
--
-- Evidence from the completed 2025-26 season:
--   - Leones del Escogido finished 1st in the Round Robin (12 wins), which secured
--     home-field advantage in the Serie Final (confirms "RR 1st hosts" rule).
--   - Escogido won the Serie Final 4-1 (18th title, back-to-back) and represented
--     the Dominican Republic at the 2026 Serie del Caribe.
--
-- Teams (2025-26 membership; playoff berths seeded from the final table):
--   Aguilas Cibaenas, Tigres del Licey, Leones del Escogido, Toros del Este,
--   Estrellas Orientales, Gigantes del Cibao.
--
-- provider_league: "winter/lidom" (routes to mlb-stats-winter, leagueId=131).
-- No draws (extra innings decide).

-- ============================================================
-- 1. Sporting Tournament
-- ============================================================

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000203',
  'lidom-2025-26',
  'Liga de Beisbol Profesional de la Republica Dominicana 2025-26',
  'baseball',
  'lidom_2025_26',
  '{
    "governing_body": "LIDOM",
    "region": "Dominican Republic",
    "team_count": 6,
    "regular_season_games_per_team": 50,
    "regular_season_format": "10_vs_each_opponent_5h_5a",
    "split_season": false,
    "standing_system": "win_loss",
    "standing_note": "Pure W-L record determines seeding. Regular-season tiebreaker not independently traced this session.",
    "regular_season_tiebreaker": "head_to_head",
    "regular_season_tiebreaker_verify_before_launch": true,
    "playoff_qualify_count": 4,
    "has_wild_card": false,
    "round_robin_playoff": {
      "teams": 4,
      "games_per_team": 18,
      "meetings_per_pair": 6,
      "total_games": 36,
      "advance": 2,
      "standing_system": "win_loss",
      "tiebreaker": "head_to_head",
      "tiebreaker_verify_before_launch": true
    },
    "final_best_of": 7,
    "final_best_of_note": "Config-driven. Older editions used bo9; 2026 is bo7.",
    "home_advantage": "round_robin_1st_place",
    "allow_draw": false,
    "champion_qualifies_for": "caribbean_series",
    "provider_league": "winter/lidom",
    "roster_confirmable_per_season": true,
    "_verification": "Corroborated across Wikipedia, lidom.com, ESPN Deportes, World Baseball Network. Not raw-API-traced (egress-blocked)."
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
     "format": "10_vs_each_opponent_5h_5a",
     "standing_system": "win_loss",
     "qualify_count": 4,
     "produces": "seeds_1_4"}'::jsonb,
   'upcoming'),

  -- Domestic: Round Robin (Serie Semifinal)
  ('b0000000-0000-0000-0002-000000000203', 'a0000000-0000-0000-0000-000000000203',
   'round-robin', 'Round Robin (Serie Semifinal)', 2, 'group',
   '{"date_range": ["2025-12-27", "2026-01-17"],
     "teams": 4,
     "entrants": ["seed_1", "seed_2", "seed_3", "seed_4"],
     "games_per_team": 18,
     "meetings_per_pair": 6,
     "total_games": 36,
     "standing_system": "win_loss",
     "advance": 2,
     "produces": ["rr_1st", "rr_2nd"]}'::jsonb,
   'upcoming'),

  -- Domestic: Championship Final (Serie Final)
  ('b0000000-0000-0000-0003-000000000203', 'a0000000-0000-0000-0000-000000000203',
   'final', 'Serie Final', 3, 'knockout',
   '{"date_range": ["2026-01-19", "2026-01-31"],
     "series_best_of": 7,
     "home_advantage": "rr_1st_place",
     "seeding": {"home": "rr_1st", "away": "rr_2nd"}}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Pool
  ('b0000000-0000-0000-0004-000000000203', 'a0000000-0000-0000-0000-000000000203',
   'sdc-pool', 'Serie del Caribe Pool', 4, 'group',
   '{"date_range": ["2026-02-01", "2026-02-05"],
     "team_count": 5, "format": "single_round_robin",
     "games_per_team": 4, "total_games": 10, "advance": 4,
     "_note": "2026 SdC hosted at Estadio Panamericano, Jalisco, Mexico. LIDOM champion fills the Dominican Republic slot."}'::jsonb,
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
  'Liga de Beisbol Profesional de la Republica Dominicana 2025-26',
  'baseball',
  'league_plus_playoff',
  '{
    "format": "roundrobin_final_plus_caribbean",
    "seedsFromTable": true,
    "leagueTeams": [
      "Aguilas Cibaenas",
      "Tigres del Licey",
      "Leones del Escogido",
      "Toros del Este",
      "Estrellas Orientales",
      "Gigantes del Cibao"
    ],
    "_leagueTeams_note": "2025-26 membership. Playoff berths seeded from the final table. Re-confirm each season. Accent-stripped spelling for provider name-matching safety; confirm against mlb-stats-winter (leagueId=131) output before launch.",
    "_leagueTeams_verify_before_launch": true,
    "roundRobin": {
      "name": "Round Robin (Serie Semifinal)",
      "teams": 4,
      "entrants": ["seed_1", "seed_2", "seed_3", "seed_4"],
      "gamesPerTeam": 18,
      "meetingsPerPair": 6,
      "totalGames": 36,
      "standingSystem": "win_loss",
      "advance": 2,
      "producesFinalists": ["rr_1st", "rr_2nd"],
      "_evidence": "2025-26: 4 teams, 18 games each, 36 total. Escogido finished 1st with 12 wins."
    },
    "finalRound": {
      "name": "Serie Final",
      "bestOf": 7,
      "homeFormat": "2-3-2",
      "slotIds": ["final_1"],
      "seeding": {"final_1": {"home": "rr_1st", "away": "rr_2nd"}},
      "_home_note": "Round-robin 1st-place hosts. Verified 2025-26: Escogido (RR 1st) held home advantage and won the Serie Final 4-1 (18th title)."
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
    "champion": {"slotId": "final_1", "qualifiesFor": "sdc-pool.dominican_republic_slot"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
