-- Seed: Liga de Béisbol Profesional Roberto Clemente (LBPRC), Puerto Rico.
--
-- Phase 2d — best-of-7 bracket family, no wild card. Reuses the series_elim
-- shape from LMP at 4 teams.
--
-- Real format (verified 2025-26): 6 teams, ~40-game round-robin regular season
-- -> top 4 -> best-of-7 Semifinals (1v4, 2v3, higher-seed advantage) ->
-- best-of-7 Final. No wild card. Champion represents Puerto Rico at the
-- Caribbean Series. No draws (extra innings decide). NOTE: LBPRC has used a
-- round-robin playoff in other seasons, so the playoff shape is intentionally
-- expressed in config and can be swapped per season.
--
-- Playoff berths are resolved from the final table, so the bracket is defined
-- over SEEDS.

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000204',
  'lbprc-2025-26',
  'Liga de Béisbol Profesional Roberto Clemente 2025-26',
  'baseball',
  'lbprc_2025_26',
  '{
    "governing_body": "LBPRC",
    "region": "Puerto Rico",
    "team_count": 6,
    "playoff_qualify_count": 4,
    "playoff_shape": "series_elim",
    "series_best_of": 7,
    "reseed_each_round": false,
    "has_wild_card": false,
    "allow_draw": false,
    "champion_qualifies_for": "caribbean_series",
    "roster_confirmable_per_season": true
  }'::jsonb,
  'upcoming',
  '2025-11-07T00:00:00Z',
  '2026-01-25T23:59:59Z'
);

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000204', 'a0000000-0000-0000-0000-000000000204', 'regular-season', 'Regular Season', 1, 'group',
   '{"date_range": ["2025-11-07", "2025-12-31"], "team_count": 6, "qualify_count": 4, "produces": "seeds_1_4"}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0002-000000000204', 'a0000000-0000-0000-0000-000000000204', 'semifinals', 'Semifinals', 2, 'knockout',
   '{"date_range": ["2026-01-03", "2026-01-11"], "series_best_of": 7, "matchups": [{"home":"1","away":"4"},{"home":"2","away":"3"}]}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0003-000000000204', 'a0000000-0000-0000-0000-000000000204', 'final', 'Serie Final', 3, 'knockout',
   '{"date_range": ["2026-01-13", "2026-01-25"], "series_best_of": 7}'::jsonb, 'upcoming');

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000204',
  'lbprc_2025_26',
  'LBPRC 2025-26',
  'baseball',
  'league_plus_playoff',
  '{
    "format": "series_elim",
    "seriesBestOf": 7,
    "reseedEachRound": false,
    "qualifyCount": 4,
    "seedsFromTable": true,
    "leagueTeams": [
      "Criollos de Caguas",
      "Indios de Mayagüez",
      "Leones de Ponce",
      "Cangrejeros de Santurce",
      "Gigantes de Carolina",
      "Senadores de San Juan"
    ],
    "_leagueTeams_note": "2025-26 membership for reference; playoff berths seeded from the final table. LBPRC has used round-robin playoffs in other seasons — swap format per season.",
    "playoffRounds": [
      {
        "roundKey": "semifinals",
        "name": "Semifinals",
        "matchCount": 2,
        "bestOf": 7,
        "slotIds": ["sf_1", "sf_2"],
        "seeding": {"sf_1": {"home": "1", "away": "4"}, "sf_2": {"home": "2", "away": "3"}}
      },
      {
        "roundKey": "final",
        "name": "Serie Final",
        "matchCount": 1,
        "bestOf": 7,
        "slotIds": ["final_1"]
      }
    ],
    "champion": {"slotId": "final_1"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
