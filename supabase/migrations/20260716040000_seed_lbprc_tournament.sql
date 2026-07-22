-- Seed: Liga de Beisbol Profesional Roberto Clemente (LBPRC), Puerto Rico,
--   2025-26 — full competitive arc.
--
-- VERIFICATION NOTE: The MLB Stats API (statsapi.mlb.com, sportId=17,
--   leagueId=133) is the canonical provider for this blueprint (routing wired in
--   registry.ts as "winter/lbprc"), but it was egress-blocked in the session that
--   authored this seed, so the structure below was NOT re-traced from raw API game
--   data the way LVBP/LMP were. Instead it is corroborated across multiple
--   authoritative sources for the COMPLETED 2025-26 season:
--     - Wikipedia ("Liga de Beisbol Profesional Roberto Clemente")
--     - World Baseball Network (schedule + 2025-26 preview + postseason bracket)
--     - Baseball-Reference (2025-26 Puerto Rican Winter League register)
--   The LBPRC bracket is structurally unambiguous (no wild card; two best-of-7
--   semifinals feed one best-of-9 final, so there is no reseed question), so
--   cross-source corroboration is sufficient. Items not independently traceable
--   this session are flagged "verify_before_launch": true.
--
-- Format (2025-26, corroborated):
--   Regular season: 6 teams, 40 games/team. Pure W-L standing. Top 4 advance.
--     2025-11-07 to 2025-12-28.
--   Semifinals: best-of-7, 1v4 and 2v3, higher seed holds home advantage.
--     ~2026-01-03 to 2026-01-11.
--   Serie Final: best-of-9 between the two semifinal winners; higher seed holds
--     home advantage. ~2026-01-13 to 2026-01-25. (The best-of-9 final is an
--     LBPRC distinction — longer than the other Caribbean leagues' best-of-7.)
--   No wild card. Champion represents Puerto Rico at the Serie del Caribe.
--     (2026 SdC: Estadio Panamericano de Beisbol, Zapopan/Jalisco, Mexico, Feb 1-7.)
--   NOTE: LBPRC has used a round-robin playoff in other seasons, so the playoff
--   shape is intentionally CONFIG-DRIVEN and can be swapped per season. 2025-26
--   used the best-of-7 semifinal bracket below.
--
-- Evidence from the completed 2025-26 season:
--   - Cangrejeros de Santurce finished the regular season 1st (26-13) and went on
--     to win the LBPRC title, representing Puerto Rico at the 2026 Serie del Caribe.
--
-- Teams (2025-26 membership; playoff berths seeded from the final table):
--   Criollos de Caguas, Indios de Mayaguez, Leones de Ponce,
--   Cangrejeros de Santurce, Gigantes de Carolina, Senadores de San Juan.
--
-- provider_league: "winter/lbprc" (routes to mlb-stats-winter, leagueId=133).
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
    "standing_note": "Pure W-L record determines seeding. Regular-season tiebreaker not independently traced this session.",
    "regular_season_tiebreaker": "head_to_head",
    "regular_season_tiebreaker_verify_before_launch": true,
    "playoff_qualify_count": 4,
    "playoff_shape": "series_elim",
    "playoff_shape_note": "2025-26 used best-of-7 semifinals (1v4, 2v3) + best-of-9 Serie Final. LBPRC has used round-robin playoffs in other seasons — swap per season.",
    "semifinal_best_of": 7,
    "final_best_of": 9,
    "final_best_of_note": "The best-of-9 Serie Final is an LBPRC distinction — longer than the best-of-7 finals used by LIDOM/LMP/LVBP.",
    "reseed_each_round": false,
    "reseed_note": "No reseed needed: two semifinals feed one final directly.",
    "home_advantage": "higher_seed",
    "has_wild_card": false,
    "allow_draw": false,
    "champion_qualifies_for": "caribbean_series",
    "provider_league": "winter/lbprc",
    "roster_confirmable_per_season": true,
    "_verification": "Corroborated across Wikipedia, World Baseball Network, Baseball-Reference. Not raw-API-traced (egress-blocked)."
  }'::jsonb,
  'upcoming',
  '2025-11-07T00:00:00Z',
  '2026-02-07T23:59:59Z'
);

-- ============================================================
-- 2. Sporting Stages (6 stages: RS + SF + Final + 3 SdC)
-- ============================================================

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  -- Domestic: Regular Season
  ('b0000000-0000-0000-0001-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'regular-season', 'Regular Season', 1, 'group',
   '{"date_range": ["2025-11-07", "2025-12-28"],
     "team_count": 6, "games_per_team": 40,
     "standing_system": "win_loss",
     "qualify_count": 4,
     "produces": "seeds_1_4"}'::jsonb,
   'upcoming'),

  -- Domestic: Semifinals (best-of-7, 1v4 & 2v3)
  ('b0000000-0000-0000-0002-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'semifinals', 'Semifinals', 2, 'knockout',
   '{"date_range": ["2026-01-03", "2026-01-11"],
     "series_best_of": 7,
     "home_advantage": "higher_seed",
     "matchups": [
       {"slot": "sf_1", "home": "seed_1", "away": "seed_4"},
       {"slot": "sf_2", "home": "seed_2", "away": "seed_3"}
     ],
     "produces": ["sf_1_winner", "sf_2_winner"]}'::jsonb,
   'upcoming'),

  -- Domestic: Championship Final (Serie Final)
  ('b0000000-0000-0000-0003-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'final', 'Serie Final', 3, 'knockout',
   '{"date_range": ["2026-01-13", "2026-01-25"],
     "series_best_of": 9,
     "home_advantage": "higher_seed",
     "seeding": {"home": "higher_seed_winner", "away": "lower_seed_winner"}}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Pool
  ('b0000000-0000-0000-0004-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'sdc-pool', 'Serie del Caribe Pool', 4, 'group',
   '{"date_range": ["2026-02-01", "2026-02-05"],
     "team_count": 5, "format": "single_round_robin",
     "games_per_team": 4, "total_games": 10, "advance": 4,
     "_note": "2026 SdC hosted at Estadio Panamericano, Jalisco, Mexico. LBPRC champion fills the Puerto Rico slot."}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Semifinals
  ('b0000000-0000-0000-0005-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'sdc-semifinals', 'Serie del Caribe Semifinals', 5, 'knockout',
   '{"date_range": ["2026-02-06", "2026-02-06"],
     "matches": 2,
     "seeding": [
       {"slot": "sdc_sf_1", "home": "pool_1st", "away": "pool_4th"},
       {"slot": "sdc_sf_2", "home": "pool_2nd", "away": "pool_3rd"}
     ]}'::jsonb,
   'upcoming'),

  -- Serie del Caribe: Final
  ('b0000000-0000-0000-0006-000000000204', 'a0000000-0000-0000-0000-000000000204',
   'sdc-final', 'Serie del Caribe Final', 6, 'knockout',
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
    "format": "series_elim_plus_caribbean",
    "semifinalBestOf": 7,
    "finalBestOf": 9,
    "reseedEachRound": false,
    "qualifyCount": 4,
    "seedsFromTable": true,
    "leagueTeams": [
      "Criollos de Caguas",
      "Indios de Mayaguez",
      "Leones de Ponce",
      "Cangrejeros de Santurce",
      "Gigantes de Carolina",
      "Senadores de San Juan"
    ],
    "_leagueTeams_note": "2025-26 membership. Playoff berths seeded from the final table. LBPRC has used round-robin playoffs in other seasons — swap format per season. Accent-stripped spelling for provider name-matching safety; confirm against mlb-stats-winter (leagueId=133) output before launch.",
    "_leagueTeams_verify_before_launch": true,
    "playoffRounds": [
      {
        "roundKey": "semifinals",
        "name": "Semifinals",
        "matchCount": 2,
        "bestOf": 7,
        "homeAdvantage": "higher_seed",
        "slotIds": ["sf_1", "sf_2"],
        "seeding": {"sf_1": {"home": "1", "away": "4"}, "sf_2": {"home": "2", "away": "3"}}
      },
      {
        "roundKey": "final",
        "name": "Serie Final",
        "matchCount": 1,
        "bestOf": 9,
        "homeAdvantage": "higher_seed",
        "slotIds": ["final_1"],
        "seeding": {"final_1": {"home": "higher_seed_winner", "away": "lower_seed_winner"}}
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
    "_champion_evidence": "2025-26: Cangrejeros de Santurce (RS 1st, 26-13) won the title and represented Puerto Rico at the 2026 Serie del Caribe.",
    "thirdPlacePlayoff": false
  }'::jsonb
);
