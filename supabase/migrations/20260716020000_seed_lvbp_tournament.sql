-- Seed: Liga Venezolana de Beisbol Profesional (LVBP) 2025-26 — full competitive arc.
--
-- VERIFIED against MLB Stats API (statsapi.mlb.com, sportId=17, leagueId=135):
--   Regular season: 8 teams, 56 games/team, no split season, no playoff points.
--   Standing: pure W-L record. No points system. Tiebreaker: head-to-head record.
--     (Verified: 2024-25 Bravos/Cardenales tied 11-5 in RR, resolved by H2H.
--      2025-26 Caribes/Navegantes tied 10-6 in RR, resolved by H2H.)
--   Wild Card (Comodin): 5th vs 6th seed, asymmetric max-2-game series.
--     Both games at 5th seed's home. 5th needs 1 win; 6th must sweep both.
--     (Verified: 2024-25 Tigres 5th beat Leones 6th in 1 game.
--      2025-26 Caribes 5th lost G1 to Tigres 6th, won G2, advanced.)
--   Round Robin (Semifinal): 5 teams (top 4 + WC winner), 16 games each,
--     4 games per matchup pair, 40 total games. Top 2 advance to Final.
--     (Verified: both 2024-25 and 2025-26 had 40 completed RR games.)
--   Championship Final: best-of-7, 2-3-2 home format.
--     RR 1st-place hosts G1-2 and G6-7.
--     (Verified: 2024-25 Cardenales hosted G1-2,G6; 2025-26 Caribes hosted G1-2,G6.)
--   Champion represents Venezuela at the Serie del Caribe.
--     (Note: Venezuela withdrew from 2026 SdC; stages included for standard arc.)
--
-- Season dates (API seasonDateInfo, season=2025):
--   Regular season: 2025-10-15 to 2025-12-27
--   Wild Card: 2025-12-29 to 2025-12-30
--   Round Robin: 2026-01-02 to 2026-01-25
--   Championship: 2026-01-27 to 2026-02-02
--   Serie del Caribe 2026: Feb 1-7 (Jalisco, Mexico) — VEN did not participate
--
-- Teams (verified from 2025-26 API schedule responses, exact API spelling):
--   Aguilas del Zulia, Bravos de Margarita, Cardenales de Lara,
--   Caribes de Anzoategui, Leones del Caracas, Navegantes del Magallanes,
--   Tiburones de La Guaira, Tigres de Aragua
--
-- provider_league: "winter/lvbp" (routes to mlb-stats-winter provider)
-- No draws (extra innings decide).

-- ============================================================
-- 1. Sporting Tournament
-- ============================================================

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000202',
  'lvbp-2025-26',
  'Liga Venezolana de Beisbol Profesional 2025-26',
  'baseball',
  'lvbp_2025_26',
  '{
    "max_entrants_per_instance": 48,
    "governing_body": "LVBP",
    "region": "Venezuela",
    "team_count": 8,
    "regular_season_games_per_team": 56,
    "split_season": false,
    "standing_system": "win_loss",
    "standing_note": "Pure W-L record determines seeding. Tiebreaker: head-to-head record in the relevant phase (regular season for playoff seeding, round-robin for final seeding).",
    "playoff_qualify_count": 6,
    "has_wild_card": true,
    "wild_card": {
      "seeds": [5, 6],
      "format": "asymmetric_max_2",
      "venue": "seed_5_home",
      "wins_needed": {"5": 1, "6": 2},
      "max_games": 2
    },
    "round_robin_playoff": {
      "teams": 5,
      "games_per_team": 16,
      "meetings_per_pair": 4,
      "total_games": 40,
      "advance": 2,
      "tiebreaker": "head_to_head"
    },
    "final_best_of": 7,
    "home_format": "2-3-2",
    "home_advantage": "round_robin_1st_place",
    "allow_draw": false,
    "champion_qualifies_for": "caribbean_series",
    "provider_league": "winter/lvbp",
    "roster_confirmable_per_season": true,
    "_withdrawal_note_2026": "Venezuela withdrew from 2026 Serie del Caribe (geopolitical dispute). SdC stages included for the standard competitive arc."
  }'::jsonb,
  'upcoming',
  '2025-10-15T00:00:00Z',
  '2026-02-07T23:59:59Z'
);

-- ============================================================
-- 2. Sporting Stages (7 stages: RS + WC + RR + Final + 3 SdC)
-- ============================================================

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  -- Domestic: Regular Season
  ('b0000000-0000-0000-0001-000000000202', 'a0000000-0000-0000-0000-000000000202',
   'regular-season', 'Regular Season', 1, 'group',
   '{"date_range": ["2025-10-15", "2025-12-27"],
     "team_count": 8, "games_per_team": 56,
     "standing_system": "win_loss",
     "tiebreaker": "head_to_head",
     "qualify_count": 6,
     "produces": "seeds_1_6"}'::jsonb,
   'upcoming'),

  -- Domestic: Wild Card (Comodin)
  ('b0000000-0000-0000-0002-000000000202', 'a0000000-0000-0000-0000-000000000202',
   'wild-card', 'Wild Card (Comodin)', 2, 'knockout',
   '{"date_range": ["2025-12-29", "2025-12-30"],
     "format": "asymmetric_max_2",
     "seeds": [5, 6],
     "venue": "seed_5_home",
     "wins_needed": {"5": 1, "6": 2},
     "max_games": 2,
     "produces": "rr_seed_5"}'::jsonb,
   'upcoming'),

  -- Domestic: Round Robin (Semifinal)
  ('b0000000-0000-0000-0003-000000000202', 'a0000000-0000-0000-0000-000000000202',
   'round-robin', 'Round Robin (Semifinal)', 3, 'group',
   '{"date_range": ["2026-01-02", "2026-01-25"],
     "teams": 5,
     "entrants": ["seed_1", "seed_2", "seed_3", "seed_4", "wc_winner"],
     "games_per_team": 16,
     "meetings_per_pair": 4,
     "total_games": 40,
     "standing_system": "win_loss",
     "tiebreaker": "head_to_head",
     "advance": 2,
     "produces": ["rr_1st", "rr_2nd"]}'::jsonb,
   'upcoming'),

  -- Domestic: Championship Final (Serie Final)
  ('b0000000-0000-0000-0004-000000000202', 'a0000000-0000-0000-0000-000000000202',
   'final', 'Serie Final', 4, 'knockout',
   '{"date_range": ["2026-01-27", "2026-02-02"],
     "series_best_of": 7,
     "home_format": "2-3-2",
     "home_advantage": "rr_1st_hosts_g1_g2_g6_g7",
     "seeding": {"home": "rr_1st", "away": "rr_2nd"}}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Pool
  ('b0000000-0000-0000-0005-000000000202', 'a0000000-0000-0000-0000-000000000202',
   'sdc-pool', 'Serie del Caribe Pool', 5, 'group',
   '{"date_range": ["2026-02-01", "2026-02-05"],
     "team_count": 5, "format": "single_round_robin",
     "games_per_team": 4, "total_games": 10, "advance": 4,
     "_note": "Venezuela withdrew from 2026 SdC. Dates are structural placeholder from 2026 edition (Jalisco, Mexico)."}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Semifinals
  ('b0000000-0000-0000-0006-000000000202', 'a0000000-0000-0000-0000-000000000202',
   'sdc-semifinals', 'Serie del Caribe Semifinals', 6, 'knockout',
   '{"date_range": ["2026-02-06", "2026-02-06"],
     "matches": 2,
     "seeding": [
       {"slot": "sdc_sf_1", "home": "pool_1st", "away": "pool_4th"},
       {"slot": "sdc_sf_2", "home": "pool_2nd", "away": "pool_3rd"}
     ]}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Final
  ('b0000000-0000-0000-0007-000000000202', 'a0000000-0000-0000-0000-000000000202',
   'sdc-final', 'Serie del Caribe Final', 7, 'knockout',
   '{"date_range": ["2026-02-07", "2026-02-07"], "matches": 1}'::jsonb,
   'upcoming');

-- ============================================================
-- 3. Bracket Template
-- ============================================================

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000202',
  'lvbp_2025_26',
  'Liga Venezolana de Beisbol Profesional 2025-26',
  'baseball',
  'league_plus_playoff',
  '{
    "format": "wildcard_roundrobin_final_plus_caribbean",
    "seedsFromTable": true,
    "leagueTeams": [
      "Aguilas del Zulia",
      "Bravos de Margarita",
      "Cardenales de Lara",
      "Caribes de Anzoategui",
      "Leones del Caracas",
      "Navegantes del Magallanes",
      "Tiburones de La Guaira",
      "Tigres de Aragua"
    ],
    "_leagueTeams_note": "2025-26 membership verified via MLB Stats API schedule (sportId=17, leagueId=135). Exact API spelling. Re-confirm each season.",
    "wildCard": {
      "name": "Wild Card (Comodin)",
      "seeds": [5, 6],
      "format": "asymmetric_max_2",
      "venue": "seed_5_home",
      "winsNeeded": {"5": 1, "6": 2},
      "maxGames": 2,
      "winnerBecomes": "rr_seed_5",
      "_evidence": "2024-25: 5th (Tigres) won G1, series over in 1 game. 2025-26: 6th (Tigres) won G1, 5th (Caribes) won G2, Caribes advanced."
    },
    "roundRobin": {
      "name": "Round Robin (Semifinal)",
      "teams": 5,
      "entrants": ["seed_1", "seed_2", "seed_3", "seed_4", "rr_seed_5"],
      "gamesPerTeam": 16,
      "meetingsPerPair": 4,
      "totalGames": 40,
      "standingSystem": "win_loss",
      "tiebreaker": "head_to_head",
      "advance": 2,
      "producesFinalists": ["rr_1st", "rr_2nd"],
      "_evidence": "Both 2024-25 and 2025-26 had exactly 40 completed RR games, 5 teams, 16 games each."
    },
    "finalRound": {
      "name": "Serie Final",
      "bestOf": 7,
      "homeFormat": "2-3-2",
      "slotIds": ["final_1"],
      "seeding": {"final_1": {"home": "rr_1st", "away": "rr_2nd"}},
      "_home_note": "RR 1st-place hosts G1-2 and G6-7. Verified: 2024-25 Cardenales (1st via H2H) hosted G1-2,G6. 2025-26 Caribes (1st via H2H) hosted G1-2,G6."
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
    "champion": {"slotId": "final_1", "qualifiesFor": "sdc-pool.venezuela_slot"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
