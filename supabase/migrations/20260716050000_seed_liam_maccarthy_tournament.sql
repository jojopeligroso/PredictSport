-- Seed: All-Ireland Senior Hurling Championship 2026 (Liam MacCarthy Cup).
--
-- GAA Phase 3 — men's intercounty, league excluded. VERIFIED 2026 format
-- (preliminary quarter-finals SCRAPPED by 2026 Congress; Joe McDonagh finalists
-- no longer enter the Liam MacCarthy knockout).
--
-- Structure:
--   Munster SHC  — 5 teams, single round-robin (4 games each). Top 2 -> Munster
--                  final; 3rd -> All-Ireland QF.
--   Leinster SHC — 6 teams, single round-robin (5 games each; Kildare promoted
--                  from the 2025 Joe McDonagh Cup). Top 2 -> Leinster final;
--                  3rd -> All-Ireland QF.
--   All-Ireland  — QF1: Munster runner-up v Leinster 3rd; QF2: Leinster
--                  runner-up v Munster 3rd. The two QF winners join the Munster
--                  and Leinster champions in the semi-finals -> final.
-- Draws ARE allowed in the provincial round-robins (config allow_draw); the
-- knockout goes to extra time. GAA scores are goals+points (goals worth 3).

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000207',
  'liam-maccarthy-2026',
  'All-Ireland Senior Hurling Championship 2026',
  'hurling',
  'liam_maccarthy_2026',
  '{
    "max_entrants_per_instance": 48,
    "governing_body": "GAA",
    "cup": "Liam MacCarthy",
    "tier": 1,
    "allow_draw_group_stage": true,
    "score_format": "gaa_goals_points",
    "munster": {"teams": ["Clare", "Cork", "Limerick", "Tipperary", "Waterford"], "format": "round_robin", "games_per_team": 4},
    "leinster": {"teams": ["Antrim", "Dublin", "Galway", "Kildare", "Kilkenny", "Wexford"], "format": "round_robin", "games_per_team": 5},
    "all_ireland": {"qf": [{"home": "munster_2", "away": "leinster_3"}, {"home": "leinster_2", "away": "munster_3"}], "sf_entrants": ["munster_1", "leinster_1", "qf_1_winner", "qf_2_winner"]},
    "roster_confirmable_per_season": true
  }'::jsonb,
  'active',
  '2026-04-18T00:00:00Z',
  '2026-07-19T23:59:59Z'
);

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000207', 'a0000000-0000-0000-0000-000000000207', 'munster-round-robin', 'Munster SHC (Round Robin)', 1, 'group',
   '{"teams": 5, "games_per_team": 4, "total_matches": 10, "allow_draw": true, "produces": ["munster_1", "munster_2", "munster_3"]}'::jsonb, 'active'),
  ('b0000000-0000-0000-0002-000000000207', 'a0000000-0000-0000-0000-000000000207', 'leinster-round-robin', 'Leinster SHC (Round Robin)', 2, 'group',
   '{"teams": 6, "games_per_team": 5, "total_matches": 15, "allow_draw": true, "produces": ["leinster_1", "leinster_2", "leinster_3"]}'::jsonb, 'active'),
  ('b0000000-0000-0000-0003-000000000207', 'a0000000-0000-0000-0000-000000000207', 'munster-final', 'Munster SHC Final', 3, 'knockout',
   '{"matchup": {"home": "munster_1", "away": "munster_2"}, "total_matches": 1}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0004-000000000207', 'a0000000-0000-0000-0000-000000000207', 'leinster-final', 'Leinster SHC Final', 4, 'knockout',
   '{"matchup": {"home": "leinster_1", "away": "leinster_2"}, "total_matches": 1}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0005-000000000207', 'a0000000-0000-0000-0000-000000000207', 'all-ireland-qf', 'All-Ireland SHC Quarter-Finals', 5, 'knockout',
   '{"matchups": [{"home": "munster_2", "away": "leinster_3"}, {"home": "leinster_2", "away": "munster_3"}], "total_matches": 2}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0006-000000000207', 'a0000000-0000-0000-0000-000000000207', 'all-ireland-sf', 'All-Ireland SHC Semi-Finals', 6, 'knockout',
   '{"entrants": ["munster_1", "leinster_1", "qf_1_winner", "qf_2_winner"], "total_matches": 2}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0007-000000000207', 'a0000000-0000-0000-0000-000000000207', 'all-ireland-final', 'All-Ireland SHC Final', 7, 'knockout',
   '{"venue": "Croke Park", "total_matches": 1}'::jsonb, 'upcoming');

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000207',
  'liam_maccarthy_2026',
  'All-Ireland Senior Hurling Championship 2026',
  'hurling',
  'group_plus_knockout',
  '{
    "format": "provincial_roundrobins_plus_knockout",
    "scoreFormat": "gaa_goals_points",
    "groups": [
      {"groupId": "munster", "name": "Munster SHC", "teams": ["Clare", "Cork", "Limerick", "Tipperary", "Waterford"], "allowDraw": true},
      {"groupId": "leinster", "name": "Leinster SHC", "teams": ["Antrim", "Dublin", "Galway", "Kildare", "Kilkenny", "Wexford"], "allowDraw": true}
    ],
    "provincialFinals": [
      {"slotId": "munster_final", "home": "munster_1", "away": "munster_2"},
      {"slotId": "leinster_final", "home": "leinster_1", "away": "leinster_2"}
    ],
    "knockoutRounds": [
      {"roundKey": "qf", "name": "All-Ireland Quarter-Finals", "matchCount": 2, "slotIds": ["ai_qf_1", "ai_qf_2"], "seeding": {"ai_qf_1": {"home": "munster_2", "away": "leinster_3"}, "ai_qf_2": {"home": "leinster_2", "away": "munster_3"}}},
      {"roundKey": "sf", "name": "All-Ireland Semi-Finals", "matchCount": 2, "slotIds": ["ai_sf_1", "ai_sf_2"], "entrants": ["munster_1", "leinster_1", "ai_qf_1_winner", "ai_qf_2_winner"]},
      {"roundKey": "final", "name": "All-Ireland Final", "matchCount": 1, "slotIds": ["ai_final"]}
    ],
    "champion": {"slotId": "ai_final"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
