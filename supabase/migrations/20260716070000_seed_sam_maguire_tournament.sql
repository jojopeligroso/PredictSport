-- Seed: All-Ireland Senior Football Championship 2026 (Sam Maguire Cup).
--
-- GAA Phase 3 — men's intercounty, league excluded. VERIFIED 2026 format
-- (Congress 2025 Motion 19: the 4-group round-robin phase used 2023-2025 is
-- ABOLISHED and replaced by a qualifier-style winners/losers knockout).
--
-- Structure:
--   4 provincial championships (Connacht, Leinster, Munster, Ulster; knockout)
--     -> 8 provincial finalists (winner + runner-up of each).
--   Sam Maguire (16 teams) = 8 provincial finalists + 7 next league-ranked
--     counties + the reigning Tailteann Cup holder.
--   Bracket (open draws each round):
--     R1  : 8 provincial finalists (home) v the other 8 -> 8 winners, 8 losers
--     R2A : 8 R1 winners -> 4 winners (to QF), 4 losers (to R3)
--     R2B : 8 R1 losers  -> 4 winners (to R3), 4 eliminated
--     R3  : 4 R2A losers v 4 R2B winners -> 4 winners (to QF)
--     QF  : 4 R2A winners + 4 R3 winners -> SF -> Final
-- GAA scores are goals+points. Knockout ties go to extra time.
--
-- Provincial championship memberships come from src/lib/gaa/counties.ts
-- (FOOTBALL_PROVINCES). The 7 league-ranked qualifiers and the Sam Maguire draw
-- are results-dependent and are resolved when fixtures/results are seeded.

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000205',
  'sam-maguire-2026',
  'All-Ireland Senior Football Championship 2026',
  'gaelic_football',
  'sam_maguire_2026',
  '{
    "max_entrants_per_instance": 48,
    "governing_body": "GAA",
    "cup": "Sam Maguire",
    "tier": 1,
    "format": "2026_qualifier_series",
    "group_phase_abolished": true,
    "score_format": "gaa_goals_points",
    "sam_maguire_size": 16,
    "composition": {"provincial_finalists": 8, "league_ranked": 7, "tailteann_holder": 1},
    "provinces": {
      "Connacht": ["Galway", "Leitrim", "Mayo", "Roscommon", "Sligo", "London", "New York"],
      "Leinster": ["Carlow", "Dublin", "Kildare", "Kilkenny", "Laois", "Longford", "Louth", "Meath", "Offaly", "Westmeath", "Wexford", "Wicklow"],
      "Munster": ["Clare", "Cork", "Kerry", "Limerick", "Tipperary", "Waterford"],
      "Ulster": ["Antrim", "Armagh", "Cavan", "Derry", "Donegal", "Down", "Fermanagh", "Monaghan", "Tyrone"]
    },
    "roster_confirmable_per_season": true
  }'::jsonb,
  'active',
  '2026-04-04T00:00:00Z',
  '2026-07-26T23:59:59Z'
);

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000205', 'a0000000-0000-0000-0000-000000000205', 'connacht', 'Connacht SFC', 1, 'knockout',
   '{"format": "knockout", "produces": ["connacht_winner", "connacht_runner_up"]}'::jsonb, 'active'),
  ('b0000000-0000-0000-0002-000000000205', 'a0000000-0000-0000-0000-000000000205', 'leinster', 'Leinster SFC', 2, 'knockout',
   '{"format": "knockout", "produces": ["leinster_winner", "leinster_runner_up"]}'::jsonb, 'active'),
  ('b0000000-0000-0000-0003-000000000205', 'a0000000-0000-0000-0000-000000000205', 'munster', 'Munster SFC', 3, 'knockout',
   '{"format": "knockout", "produces": ["munster_winner", "munster_runner_up"]}'::jsonb, 'active'),
  ('b0000000-0000-0000-0004-000000000205', 'a0000000-0000-0000-0000-000000000205', 'ulster', 'Ulster SFC', 4, 'knockout',
   '{"format": "knockout", "produces": ["ulster_winner", "ulster_runner_up"]}'::jsonb, 'active'),
  ('b0000000-0000-0000-0005-000000000205', 'a0000000-0000-0000-0000-000000000205', 'sfc-round-1', 'Sam Maguire Round 1', 5, 'knockout',
   '{"matches": 8, "home_seeds": "8 provincial finalists", "away_seeds": "7 league-ranked + Tailteann holder", "produces": ["r1_winners_8", "r1_losers_8"]}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0006-000000000205', 'a0000000-0000-0000-0000-000000000205', 'sfc-round-2a', 'Sam Maguire Round 2A (Winners)', 6, 'knockout',
   '{"matches": 4, "entrants": "r1_winners_8", "produces": ["r2a_winners_4_to_qf", "r2a_losers_4_to_r3"]}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0007-000000000205', 'a0000000-0000-0000-0000-000000000205', 'sfc-round-2b', 'Sam Maguire Round 2B (Losers)', 7, 'knockout',
   '{"matches": 4, "entrants": "r1_losers_8", "produces": ["r2b_winners_4_to_r3", "r2b_losers_4_eliminated"]}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0008-000000000205', 'a0000000-0000-0000-0000-000000000205', 'sfc-round-3', 'Sam Maguire Round 3', 8, 'knockout',
   '{"matches": 4, "home_seeds": "r2a_losers_4", "away_seeds": "r2b_winners_4", "produces": ["r3_winners_4_to_qf"]}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0009-000000000205', 'a0000000-0000-0000-0000-000000000205', 'sfc-quarter-finals', 'Sam Maguire Quarter-Finals', 9, 'knockout',
   '{"matches": 4, "entrants": "r2a_winners_4 + r3_winners_4"}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0010-000000000205', 'a0000000-0000-0000-0000-000000000205', 'sfc-semi-finals', 'Sam Maguire Semi-Finals', 10, 'knockout',
   '{"matches": 2}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0011-000000000205', 'a0000000-0000-0000-0000-000000000205', 'sfc-final', 'Sam Maguire Final', 11, 'knockout',
   '{"venue": "Croke Park", "matches": 1}'::jsonb, 'upcoming');

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000205',
  'sam_maguire_2026',
  'All-Ireland Senior Football Championship 2026',
  'gaelic_football',
  'double_elimination',
  '{
    "format": "sam_maguire_2026_qualifier_series",
    "scoreFormat": "gaa_goals_points",
    "size": 16,
    "openDrawEachRound": true,
    "flow": [
      {"roundKey": "r1", "name": "Round 1", "matches": 8, "in": "8 provincial finalists (home) v 8 others", "winnersTo": "r2a", "losersTo": "r2b"},
      {"roundKey": "r2a", "name": "Round 2A", "matches": 4, "in": "r1 winners", "winnersTo": "qf", "losersTo": "r3"},
      {"roundKey": "r2b", "name": "Round 2B", "matches": 4, "in": "r1 losers", "winnersTo": "r3", "losersOut": true},
      {"roundKey": "r3", "name": "Round 3", "matches": 4, "in": "r2a losers (home) v r2b winners", "winnersTo": "qf", "losersOut": true},
      {"roundKey": "qf", "name": "Quarter-Finals", "matches": 4, "in": "r2a winners + r3 winners"},
      {"roundKey": "sf", "name": "Semi-Finals", "matches": 2},
      {"roundKey": "final", "name": "Final", "matches": 1, "slotIds": ["sm_final"]}
    ],
    "champion": {"slotId": "sm_final"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
