-- Seed: The Hundred (ECB) tournament, stages, and bracket template.
-- First non-soccer blueprint. Establishes the "Archetype B" shape:
-- a single round-robin league table feeding a small top-3 playoff.
--
-- The same 8 city franchises field both a men's and a women's competition;
-- those are modelled as two INSTANCES of this one blueprint (see
-- create-the-hundred-competition.ts), not two blueprints.
--
-- Real format (verified 2026-07): 8 teams, 100-ball matches, 32 league
-- matches (each team plays 8), then top 3 -> Eliminator (2 v 3) -> Final
-- (1 v Eliminator winner). No draws in the playoff (Super Over decides).

-- ============================================================
-- 0. Extend bracket_type to cover the league->playoff archetype
--    (additive; reused by the baseball winter leagues in Phase 2)
-- ============================================================

ALTER TABLE public.bracket_templates
  DROP CONSTRAINT IF EXISTS bracket_templates_bracket_type_check;

ALTER TABLE public.bracket_templates
  ADD CONSTRAINT bracket_templates_bracket_type_check
  CHECK (bracket_type IN (
    'single_elimination',
    'double_elimination',
    'group_plus_knockout',
    'league_plus_playoff'
  ));

-- ============================================================
-- 1. Sporting Tournament
-- ============================================================

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000100',
  'the-hundred-2026',
  'The Hundred 2026',
  'cricket',
  'the_hundred_2026',
  '{
    "governing_body": "ECB",
    "ball_format": "100-ball",
    "team_count": 8,
    "league_matches_per_team": 8,
    "league_total_matches": 32,
    "playoff_qualify_count": 3,
    "playoff_shape": "top3_eliminator",
    "allow_draw": false,
    "tie_breaker": "super_over",
    "editions": ["mens", "womens"]
  }'::jsonb,
  'upcoming',
  '2026-08-05T00:00:00Z',
  '2026-08-31T23:59:59Z'
);

-- ============================================================
-- 2. Sporting Stages (3 stages)
-- ============================================================

-- League stage: one "group" of 8, single round-robin-ish (32 matches).
-- Per-game picks live as events under the League prediction window.
INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000100', 'a0000000-0000-0000-0000-000000000100', 'league', 'League Stage', 1, 'group',
   '{"date_range": ["2026-08-05", "2026-08-26"], "team_count": 8, "matches_per_team": 8, "total_matches": 32, "qualify_count": 3}'::jsonb, 'upcoming');

-- Playoff: Eliminator (2 v 3) then Final (1 v Eliminator winner).
INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0002-000000000100', 'a0000000-0000-0000-0000-000000000100', 'eliminator', 'Eliminator', 2, 'knockout',
   '{"date_range": ["2026-08-29", "2026-08-29"], "total_matches": 1, "matchup": {"home": "2", "away": "3"}}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0003-000000000100', 'a0000000-0000-0000-0000-000000000100', 'final', 'Final', 3, 'knockout',
   '{"date_range": ["2026-08-31", "2026-08-31"], "total_matches": 1, "matchup": {"home": "1", "away": "eliminator_winner"}}'::jsonb, 'upcoming');

-- ============================================================
-- 3. Bracket Template (top-3 eliminator)
-- ============================================================
-- Franchise names are shared across the men's and women's editions.
-- Seeds "1"/"2"/"3" are resolved from the final league table at lock time;
-- "eliminator_winner" is resolved after the Eliminator is played.

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000100',
  'the_hundred_2026',
  'The Hundred 2026',
  'cricket',
  'league_plus_playoff',
  '{
    "format": "top3_eliminator",
    "leagueTeams": [
      "Birmingham Phoenix",
      "London Spirit",
      "Manchester Originals",
      "Northern Superchargers",
      "Oval Invincibles",
      "Southern Brave",
      "Trent Rockets",
      "Welsh Fire"
    ],
    "leagueMatchesPerTeam": 8,
    "qualifyCount": 3,
    "playoffRounds": [
      {
        "roundKey": "eliminator",
        "name": "Eliminator",
        "matchCount": 1,
        "slotIds": ["elim_m1"],
        "seeding": {"elim_m1": {"home": "2", "away": "3"}}
      },
      {
        "roundKey": "final",
        "name": "Final",
        "matchCount": 1,
        "slotIds": ["final_m1"],
        "seeding": {"final_m1": {"home": "1", "away": "eliminator_winner"}}
      }
    ],
    "champion": {"slotId": "final_m1"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
