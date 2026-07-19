-- Seed: Joe McDonagh Cup 2026 (second-tier All-Ireland hurling).
--
-- GAA Phase 3 — men's intercounty, league excluded. VERIFIED 2026: 6 teams,
-- single round-robin (5 games each), top 2 -> final. Winner promoted to the
-- 2027 Leinster SHC; bottom relegated to the Christy Ring Cup. Since the 2026
-- Congress scrapped the All-Ireland preliminary quarter-finals, the McDonagh
-- finalists NO LONGER enter the Liam MacCarthy knockout.
--
-- 2026 teams: Laois, Carlow, Offaly, Down, Kerry, London. Draws allowed in the
-- round-robin. GAA scores are goals+points.

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000208',
  'joe-mcdonagh-2026',
  'Joe McDonagh Cup 2026',
  'hurling',
  'joe_mcdonagh_2026',
  '{
    "governing_body": "GAA",
    "cup": "Joe McDonagh",
    "tier": 2,
    "teams": ["Laois", "Carlow", "Offaly", "Down", "Kerry", "London"],
    "format": "round_robin_plus_final",
    "games_per_team": 5,
    "allow_draw_group_stage": true,
    "score_format": "gaa_goals_points",
    "promotion": "winner_to_leinster_shc_2027",
    "relegation": "bottom_to_christy_ring",
    "roster_confirmable_per_season": true
  }'::jsonb,
  'completed',
  '2026-04-25T00:00:00Z',
  '2026-06-07T23:59:59Z'
);

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000208', 'a0000000-0000-0000-0000-000000000208', 'round-robin', 'Round Robin', 1, 'group',
   '{"teams": 6, "games_per_team": 5, "total_matches": 15, "allow_draw": true, "produces": ["mcd_1", "mcd_2"]}'::jsonb, 'finalised'),
  ('b0000000-0000-0000-0002-000000000208', 'a0000000-0000-0000-0000-000000000208', 'final', 'Joe McDonagh Cup Final', 2, 'knockout',
   '{"matchup": {"home": "mcd_1", "away": "mcd_2"}, "venue": "Croke Park", "total_matches": 1}'::jsonb, 'finalised');

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000208',
  'joe_mcdonagh_2026',
  'Joe McDonagh Cup 2026',
  'hurling',
  'league_plus_playoff',
  '{
    "format": "roundrobin_final",
    "scoreFormat": "gaa_goals_points",
    "leagueTeams": ["Laois", "Carlow", "Offaly", "Down", "Kerry", "London"],
    "allowDraw": true,
    "roundRobin": {"teams": 6, "gamesPerTeam": 5, "advance": 2, "producesFinalists": ["mcd_1", "mcd_2"]},
    "finalRound": {"name": "Final", "slotIds": ["mcd_final"], "seeding": {"mcd_final": {"home": "mcd_1", "away": "mcd_2"}}},
    "champion": {"slotId": "mcd_final"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
