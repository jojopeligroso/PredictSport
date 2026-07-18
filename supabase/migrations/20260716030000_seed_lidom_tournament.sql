-- Seed: Liga de Béisbol Profesional de la República Dominicana (LIDOM).
--
-- Phase 2c — round-robin-playoff family, no wild card. Reuses the
-- round_robin_playoff shape from LVBP minus the wild-card mini-stage.
--
-- Real format (verified 2025-26): 6 teams, 50-game regular season (10 vs each
-- opponent) -> top 4 -> 18-game Round Robin (Serie Semifinal; 6 vs each
-- opponent; top 2 advance) -> Serie Final best-of-7 (older editions used
-- best-of-9; series length is CONFIG-DRIVEN, defaulting to bo7 for 2026). No
-- wild card. Champion represents the Dominican Republic at the Caribbean Series.
-- No draws (extra innings decide).
--
-- Playoff berths are resolved from the final table, so the bracket is defined
-- over SEEDS. leagueTeams is the 2025-26 membership for reference.

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000203',
  'lidom-2025-26',
  'Liga de Béisbol Profesional de la República Dominicana 2025-26',
  'baseball',
  'lidom_2025_26',
  '{
    "governing_body": "LIDOM",
    "region": "Dominican Republic",
    "team_count": 6,
    "regular_season_games": 50,
    "has_wild_card": false,
    "round_robin_playoff": {"teams": 4, "games_per_team": 18, "meetings_per_pair": 6, "advance": 2},
    "final_best_of": 7,
    "allow_draw": false,
    "champion_qualifies_for": "caribbean_series",
    "roster_confirmable_per_season": true
  }'::jsonb,
  'upcoming',
  '2025-10-15T00:00:00Z',
  '2026-01-31T23:59:59Z'
);

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000203', 'a0000000-0000-0000-0000-000000000203', 'regular-season', 'Serie Regular', 1, 'group',
   '{"date_range": ["2025-10-15", "2025-12-23"], "team_count": 6, "regular_season_games": 50, "produces": "seeds_1_4"}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0002-000000000203', 'a0000000-0000-0000-0000-000000000203', 'round-robin', 'Round Robin (Serie Semifinal)', 2, 'group',
   '{"date_range": ["2025-12-27", "2026-01-17"], "teams": 4, "games_per_team": 18, "meetings_per_pair": 6, "total_games": 36, "advance": 2}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0003-000000000203', 'a0000000-0000-0000-0000-000000000203', 'final', 'Serie Final', 3, 'knockout',
   '{"date_range": ["2026-01-19", "2026-01-31"], "series_best_of": 7}'::jsonb, 'upcoming');

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000203',
  'lidom_2025_26',
  'LIDOM 2025-26',
  'baseball',
  'league_plus_playoff',
  '{
    "format": "roundrobin_final",
    "seedsFromTable": true,
    "leagueTeams": [
      "Águilas Cibaeñas",
      "Tigres del Licey",
      "Leones del Escogido",
      "Toros del Este",
      "Estrellas Orientales",
      "Gigantes del Cibao"
    ],
    "_leagueTeams_note": "2025-26 membership for reference; playoff berths seeded from the final table.",
    "roundRobin": {
      "name": "Round Robin (Serie Semifinal)",
      "teams": 4,
      "entrants": ["1", "2", "3", "4"],
      "gamesPerTeam": 18,
      "meetingsPerPair": 6,
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
