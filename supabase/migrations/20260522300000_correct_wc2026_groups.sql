-- Correct the FIFA World Cup 2026 bracket template groups.
--
-- The original seed (20260522000000_seed_wc2026_tournament.sql) used PLACEHOLDER
-- teams written before the official draw. The real draw was held 5 December 2025.
-- This migration replaces ONLY the `groups` array inside the template config with
-- the official draw, verified 2026-05-22 against NBC Sports and Sky Sports.
-- See docs/WC2026-OFFICIAL-FIXTURES.md.
--
-- Knockout rounds, r32Seeding and bestThirdConfig are intentionally left
-- untouched — those are letter-keyed and were already flagged PLACEHOLDER
-- pending the official FIFA bracket/best-third matrix (separate TODO).
--
-- bracket_templates.config IS read at runtime by classification-engine.ts and
-- standings-snapshot.ts (computeBracketStandings), so this data is load-bearing.

UPDATE public.bracket_templates
SET config = jsonb_set(
  config,
  '{groups}',
  '[
    {"groupId": "A", "name": "Group A", "teams": ["Mexico", "South Korea", "South Africa", "Czechia"]},
    {"groupId": "B", "name": "Group B", "teams": ["Canada", "Switzerland", "Qatar", "Bosnia & Herzegovina"]},
    {"groupId": "C", "name": "Group C", "teams": ["Brazil", "Morocco", "Scotland", "Haiti"]},
    {"groupId": "D", "name": "Group D", "teams": ["USA", "Paraguay", "Australia", "Turkiye"]},
    {"groupId": "E", "name": "Group E", "teams": ["Germany", "Ecuador", "Ivory Coast", "Curacao"]},
    {"groupId": "F", "name": "Group F", "teams": ["Netherlands", "Japan", "Tunisia", "Sweden"]},
    {"groupId": "G", "name": "Group G", "teams": ["Belgium", "Iran", "Egypt", "New Zealand"]},
    {"groupId": "H", "name": "Group H", "teams": ["Spain", "Uruguay", "Saudi Arabia", "Cape Verde"]},
    {"groupId": "I", "name": "Group I", "teams": ["France", "Senegal", "Norway", "Iraq"]},
    {"groupId": "J", "name": "Group J", "teams": ["Argentina", "Austria", "Algeria", "Jordan"]},
    {"groupId": "K", "name": "Group K", "teams": ["Portugal", "Colombia", "Uzbekistan", "DR Congo"]},
    {"groupId": "L", "name": "Group L", "teams": ["England", "Croatia", "Panama", "Ghana"]}
  ]'::jsonb
)
WHERE template_key = 'fifa_world_cup_2026';
