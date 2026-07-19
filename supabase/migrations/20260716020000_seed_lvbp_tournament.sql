-- Seed: Liga Venezolana de Béisbol Profesional (LVBP) tournament, stages, and
-- bracket template.
--
-- Phase 2b — the winter league WITH the wild card. Establishes two primitives
-- reused by LIDOM next: an asymmetric `wild_card` mini-stage and a
-- `round_robin_playoff` stage, feeding a best-of-7 final.
--
-- Real format (verified for 2025-26): 8 teams, 56-game regular season ->
--   WILD CARD (Comodín): asymmetric max-2-game series between the 5th and 6th
--     seeds, both games at the 5th seed's park. The 5th seed advances on ONE
--     win; the 6th seed must win BOTH. Winner takes the 5th berth in ->
--   ROUND ROBIN (Semifinal): 5 teams (top 4 + wild-card winner), 16 games each
--     (each pair meets 4x: 2 home, 2 away; 40 games total). Top 2 advance ->
--   FINAL: best-of-7. Champion represents Venezuela at the Caribbean Series.
-- No draws (extra innings decide).
--
-- Playoff berths are resolved from the final table at lock time, so the bracket
-- is defined over SEEDS (1..6), not hardcoded teams. leagueTeams below is the
-- 2025-26 membership for reference and MUST be re-confirmed each season.

-- ============================================================
-- 1. Sporting Tournament
-- ============================================================

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000202',
  'lvbp-2025-26',
  'Liga Venezolana de Béisbol Profesional 2025-26',
  'baseball',
  'lvbp_2025_26',
  '{
    "governing_body": "LVBP",
    "region": "Venezuela",
    "team_count": 8,
    "regular_season_games": 56,
    "has_wild_card": true,
    "wild_card": {
      "seeds": [5, 6],
      "format": "asymmetric_max_2",
      "venue": "seed_5_home",
      "wins_needed": {"5": 1, "6": 2}
    },
    "round_robin_playoff": {
      "teams": 5,
      "games_per_team": 16,
      "meetings_per_pair": 4,
      "advance": 2
    },
    "final_best_of": 7,
    "allow_draw": false,
    "champion_qualifies_for": "caribbean_series",
    "roster_confirmable_per_season": true
  }'::jsonb,
  'upcoming',
  '2025-10-14T00:00:00Z',
  '2026-01-31T23:59:59Z'
);

-- ============================================================
-- 2. Sporting Stages (regular season + wild card + round robin + final)
-- ============================================================

-- Regular season: one "group" pool of 8; per-game picks are windowed (D1).
-- The final table produces seeds 1..6 (top 4 direct + 5th/6th to wild card).
INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000202', 'a0000000-0000-0000-0000-000000000202', 'regular-season', 'Regular Season', 1, 'group',
   '{"date_range": ["2025-10-14", "2025-12-28"], "team_count": 8, "regular_season_games": 56, "produces": "seeds_1_6"}'::jsonb, 'upcoming');

-- Wild card: asymmetric max-2-game. The 5th seed needs 1 win, the 6th needs 2;
-- both games at the 5th seed's park. Winner fills the 5th round-robin berth.
INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0002-000000000202', 'a0000000-0000-0000-0000-000000000202', 'wild-card', 'Wild Card (Comodín)', 2, 'knockout',
   '{"date_range": ["2025-12-29", "2025-12-30"], "format": "asymmetric_max_2", "seeds": [5, 6], "venue": "seed_5_home", "wins_needed": {"5": 1, "6": 2}, "max_games": 2}'::jsonb, 'upcoming');

-- Round Robin (Semifinal): 5 teams, 16 games each. Scored as a table; top 2 advance.
INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0003-000000000202', 'a0000000-0000-0000-0000-000000000202', 'round-robin', 'Round Robin (Semifinal)', 3, 'group',
   '{"date_range": ["2025-12-31", "2026-01-20"], "teams": 5, "games_per_team": 16, "meetings_per_pair": 4, "total_games": 40, "advance": 2}'::jsonb, 'upcoming');

-- Final: best-of-7 series between the top 2 of the round robin.
INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0004-000000000202', 'a0000000-0000-0000-0000-000000000202', 'final', 'Serie Final', 4, 'knockout',
   '{"date_range": ["2026-01-23", "2026-01-31"], "series_best_of": 7}'::jsonb, 'upcoming');

-- ============================================================
-- 3. Bracket Template (wild card -> round-robin playoff -> best-of-7 final)
-- ============================================================
-- The wild card and final are the only true "series" nodes; the round robin is
-- a table scored like the regular season. Series winner + games-played length
-- are scored via head_to_head + over_under(stat=games_played) on synthetic
-- series events.

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000202',
  'lvbp_2025_26',
  'Liga Venezolana de Béisbol Profesional 2025-26',
  'baseball',
  'league_plus_playoff',
  '{
    "format": "wildcard_roundrobin_final",
    "seedsFromTable": true,
    "leagueTeams": [
      "Cardenales de Lara",
      "Bravos de Margarita",
      "Águilas del Zulia",
      "Navegantes del Magallanes",
      "Tigres de Aragua",
      "Leones del Caracas",
      "Caribes de Anzoátegui",
      "Tiburones de La Guaira"
    ],
    "_leagueTeams_note": "2025-26 membership for reference; re-confirm each season. Playoff berths are seeded from the final table.",
    "wildCard": {
      "name": "Wild Card (Comodín)",
      "seeds": [5, 6],
      "format": "asymmetric_max_2",
      "venue": "seed_5_home",
      "winsNeeded": {"5": 1, "6": 2},
      "maxGames": 2,
      "winnerBecomes": "rr_seed_5"
    },
    "roundRobin": {
      "name": "Round Robin (Semifinal)",
      "teams": 5,
      "entrants": ["1", "2", "3", "4", "rr_seed_5"],
      "gamesPerTeam": 16,
      "meetingsPerPair": 4,
      "advance": 2,
      "producesFinalists": ["rr_1", "rr_2"]
    },
    "finalRound": {
      "name": "Serie Final",
      "bestOf": 7,
      "slotIds": ["final_1"],
      "seeding": {"final_1": {"home": "rr_1", "away": "rr_2"}}
    },
    "champion": {"slotId": "final_1"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
