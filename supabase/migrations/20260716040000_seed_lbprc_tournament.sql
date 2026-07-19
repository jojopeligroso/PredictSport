-- Seed: Liga de Beisbol Profesional Roberto Clemente (LBPRC) 2025-26 — full arc.
--
-- VERIFIED against MLB Stats API (statsapi.mlb.com, sportId=17, leagueId=133):
--   Regular season: 6 teams, 40 games/team, no split season, no playoff points.
--   Standing: pure W-L record. Top 5 qualify (top 3 direct to SF, 4th+5th to play-in).
--   Play-in (Division Series): 4th vs 5th seed, asymmetric max-2-game at 4th seed's home.
--     4th seed needs 1 win; 5th must sweep both. Winner enters SF as 4th seed.
--     (Verified: 2024-25 Caguas 4th beat Ponce 5th, G2 cancelled after G1 win.
--      2025-26 Caguas 4th beat Mayaguez 5th, G2 cancelled after G1 win.)
--   Semifinals: bo7, 2 series. 1v4, 2v3. Higher RS seed hosts odd games (alternating 1-1).
--     (Verified: 2024-25 and 2025-26 both had SF end at 4 wins.)
--   Final (Serie Final): bo9 (first to 5 wins).
--     (Verified: 2024-25 Mayaguez won 5-1 in 6 games — series continued past 4 wins.
--      2025-26 Santurce won 5-1 in 6 games — series continued past 4 wins.)
--   Final home format: higher RS seed hosts G1,G2. Subsequent games varied:
--     2024-25: 2-2-1-1-1 (Mayaguez hosted G1,G2,G5)
--     2025-26: 2-3-2 (Santurce hosted G1,G2,G6)
--     Flagged verify_before_launch — home format may change per season.
--   Champion represents Puerto Rico at the Serie del Caribe.
--
-- Season dates (API seasonDateInfo, season=2025):
--   Regular season: 2025-11-06 to 2025-12-28
--   Play-in: 2025-12-29
--   Semifinals: 2026-01-02 to 2026-01-09
--   Final: 2026-01-12 to 2026-01-20
--   Serie del Caribe 2026: Feb 1-7 (Jalisco, Mexico)
--
-- Teams (verified from 2025-26 API schedule responses, exact API spelling):
--   Cangrejeros de Santurce, Criollos de Caguas, Gigantes de Carolina,
--   Indios de Mayaguez, Leones de Ponce, Senadores de San Juan
--
-- provider_league: "winter/lbprc" (routes to mlb-stats-winter provider)
-- No draws (extra innings decide).

-- ============================================================
-- 1. Sporting Tournament
-- ============================================================

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000204',
  'lbprc-2025-26',
  'Liga de Beisbol Profesional Roberto Clemente 2025-26',
  'baseball',
  'lbprc_2025_26',
  '{
    "governing_body": "LBPRC",
    "region": "Puerto Rico",
    "team_count": 6,
    "regular_season_games_per_team": 40,
    "split_season": false,
    "standing_system": "win_loss",
    "standing_note": "Pure W-L record determines seeding. Top 5 qualify (top 3 direct to SF, 4th and 5th to play-in).",
    "playoff_qualify_count": 5,
    "has_wild_card": true,
    "wild_card": {
      "name": "Division Series",
      "seeds": [4, 5],
      "format": "asymmetric_max_2",
      "venue": "seed_4_home",
      "wins_needed": {"4": 1, "5": 2},
      "max_games": 2
    },
    "semifinal_best_of": 7,
    "final_best_of": 9,
    "sf_home_format": "alternating_1_1",
    "sf_home_advantage": "higher_rs_seed_hosts_odd_games",
    "final_home_format": "varies_by_season",
    "_final_home_note": "2024-25: 2-2-1-1 (higher seed hosted G1,G2,G5). 2025-26: 2-3-2 (higher seed hosted G1,G2,G6). Verify each season.",
    "final_home_advantage": "higher_rs_seed",
    "playoff_shape": "series_elim",
    "reseed_each_round": false,
    "allow_draw": false,
    "champion_qualifies_for": "caribbean_series",
    "provider_league": "winter/lbprc",
    "roster_confirmable_per_season": true,
    "verify_before_launch": true
  }'::jsonb,
  'upcoming',
  '2025-11-06T00:00:00Z',
  '2026-02-07T23:59:59Z'
);

-- ============================================================
-- 2. Sporting Stages (7 stages: RS + Play-in + SF + Final + 3 SdC)
-- ============================================================

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  -- Domestic: Regular Season
  ('b0000000-0000-0000-0001-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'regular-season', 'Regular Season', 1, 'group',
   '{"date_range": ["2025-11-06", "2025-12-28"],
     "team_count": 6, "games_per_team": 40,
     "standing_system": "win_loss",
     "qualify_count": 5,
     "produces": "seeds_1_5"}'::jsonb,
   'upcoming'),

  -- Domestic: Play-in (Division Series)
  ('b0000000-0000-0000-0002-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'play-in', 'Division Series', 2, 'knockout',
   '{"date_range": ["2025-12-29", "2025-12-30"],
     "format": "asymmetric_max_2",
     "seeds": [4, 5],
     "venue": "seed_4_home",
     "wins_needed": {"4": 1, "5": 2},
     "max_games": 2,
     "produces": "sf_seed_4",
     "_evidence": "Both 2024-25 and 2025-26: 4th seed won G1, G2 cancelled. Both at 4th seeds home."}'::jsonb,
   'upcoming'),

  -- Domestic: Semifinals
  ('b0000000-0000-0000-0003-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'semifinals', 'Semifinals', 3, 'knockout',
   '{"date_range": ["2026-01-02", "2026-01-09"],
     "series_best_of": 7, "series_count": 2,
     "home_format": "alternating_1_1",
     "home_advantage": "higher_rs_seed_hosts_odd_games",
     "seeding": [
       {"slot": "sf_1", "home": "seed_1", "away": "sf_seed_4"},
       {"slot": "sf_2", "home": "seed_2", "away": "seed_3"}
     ],
     "_evidence": "2024-25: Mayaguez 1st beat Caguas 4-2, San Juan 3rd beat Santurce 4-1. 2025-26: Santurce 1st beat Caguas 4-2, Ponce 2nd beat Carolina 4-2."}'::jsonb,
   'upcoming'),

  -- Domestic: Final (Serie Final)
  ('b0000000-0000-0000-0004-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'final', 'Serie Final', 4, 'knockout',
   '{"date_range": ["2026-01-12", "2026-01-20"],
     "series_best_of": 9,
     "home_advantage": "higher_rs_seed",
     "_home_format_note": "Higher seed hosts G1,G2. Remaining game distribution varied: 2024-25 was 2-2-1-1, 2025-26 was 2-3-2. Verify each season.",
     "_evidence": "2024-25: Mayaguez won 5-1 in 6 games (bo9). 2025-26: Santurce won 5-1 in 6 games (bo9). Both series continued past 4 wins.",
     "verify_before_launch": true}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Pool
  ('b0000000-0000-0000-0005-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'sdc-pool', 'Serie del Caribe Pool', 5, 'group',
   '{"date_range": ["2026-02-01", "2026-02-05"],
     "team_count": 5, "format": "single_round_robin",
     "games_per_team": 4, "total_games": 10, "advance": 4}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Semifinals
  ('b0000000-0000-0000-0006-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'sdc-semifinals', 'Serie del Caribe Semifinals', 6, 'knockout',
   '{"date_range": ["2026-02-06", "2026-02-06"],
     "matches": 2,
     "seeding": [
       {"slot": "sdc_sf_1", "home": "pool_1st", "away": "pool_4th"},
       {"slot": "sdc_sf_2", "home": "pool_2nd", "away": "pool_3rd"}
     ]}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Final
  ('b0000000-0000-0000-0007-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'sdc-final', 'Serie del Caribe Final', 7, 'knockout',
   '{"date_range": ["2026-02-07", "2026-02-07"], "matches": 1}'::jsonb,
   'upcoming');

-- ============================================================
-- 3. Bracket Template
-- ============================================================

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000204',
  'lbprc_2025_26',
  'Liga de Beisbol Profesional Roberto Clemente 2025-26',
  'baseball',
  'league_plus_playoff',
  '{
    "format": "playin_series_elim_plus_caribbean",
    "seedsFromTable": true,
    "leagueTeams": [
      "Cangrejeros de Santurce",
      "Criollos de Caguas",
      "Gigantes de Carolina",
      "Indios de Mayaguez",
      "Leones de Ponce",
      "Senadores de San Juan"
    ],
    "_leagueTeams_note": "2025-26 membership verified via MLB Stats API schedule (sportId=17, leagueId=133). Exact API spelling. Re-confirm each season.",
    "playIn": {
      "name": "Division Series",
      "seeds": [4, 5],
      "format": "asymmetric_max_2",
      "venue": "seed_4_home",
      "winsNeeded": {"4": 1, "5": 2},
      "maxGames": 2,
      "winnerBecomes": "sf_seed_4",
      "_evidence": "Both 2024-25 and 2025-26: 4th seed won G1, G2 cancelled."
    },
    "playoffRounds": [
      {
        "roundKey": "semifinals",
        "name": "Semifinals",
        "seriesCount": 2,
        "bestOf": 7,
        "homeFormat": "alternating_1_1",
        "slotIds": ["sf_1", "sf_2"],
        "seeding": {
          "sf_1": {"home": "seed_1", "away": "sf_seed_4"},
          "sf_2": {"home": "seed_2", "away": "seed_3"}
        },
        "_home_note": "Higher RS seed hosts odd games (alternating 1-1). Verified both seasons."
      },
      {
        "roundKey": "final",
        "name": "Serie Final",
        "seriesCount": 1,
        "bestOf": 9,
        "slotIds": ["final_1"],
        "_home_note": "Higher RS seed hosts G1,G2. Remaining games: 2024-25 was 2-2-1-1, 2025-26 was 2-3-2. Format varies.",
        "_evidence": "2024-25: Mayaguez 5-1 (6 games, bo9). 2025-26: Santurce 5-1 (6 games, bo9).",
        "verify_before_launch": true
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
    "champion": {"slotId": "final_1", "qualifiesFor": "sdc-pool.puerto_rico_slot"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
