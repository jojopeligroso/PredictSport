-- Seed: Tailteann Cup 2026 (second-tier All-Ireland football).
--
-- GAA Phase 3 — men's intercounty, league excluded. VERIFIED 2026: the
-- Tailteann Cup moved to a DOUBLE-ELIMINATION format. Contested by the 16
-- counties (by National League placing) that did not qualify for the Sam
-- Maguire, plus New York (entering at the preliminary quarter-final) = 17 teams.
-- First round is an OPEN DRAW (first team drawn is home); winners and losers
-- continue in separate brackets before knockout semi-finals and the final. The
-- Tier-2 winner earns Sam Maguire entry the following year, regardless of
-- league position. GAA scores are goals+points.
--
-- The exact 16 qualifying counties are results-dependent (finalised after the
-- National League) and are resolved when fixtures/results are seeded.

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000206',
  'tailteann-cup-2026',
  'Tailteann Cup 2026',
  'gaelic_football',
  'tailteann_cup_2026',
  '{
    "max_entrants_per_instance": 48,
    "governing_body": "GAA",
    "cup": "Tailteann",
    "tier": 2,
    "format": "double_elimination",
    "team_count": 17,
    "includes_new_york": true,
    "new_york_entry": "preliminary_quarter_final",
    "qualification": "16 National League counties outside the Sam Maguire",
    "score_format": "gaa_goals_points",
    "reward": "winner_to_sam_maguire_next_year",
    "roster_confirmable_per_season": true
  }'::jsonb,
  'active',
  '2026-04-25T00:00:00Z',
  '2026-07-12T23:59:59Z'
);

INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000206', 'a0000000-0000-0000-0000-000000000206', 'round-1', 'Round 1 (Open Draw)', 1, 'knockout',
   '{"matches": 8, "open_draw": true, "produces": ["r1_winners", "r1_losers"]}'::jsonb, 'active'),
  ('b0000000-0000-0000-0002-000000000206', 'a0000000-0000-0000-0000-000000000206', 'round-2', 'Round 2 (Winners & Losers)', 2, 'knockout',
   '{"winners_bracket": true, "losers_bracket": true}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0003-000000000206', 'a0000000-0000-0000-0000-000000000206', 'preliminary-quarter-finals', 'Preliminary Quarter-Finals', 3, 'knockout',
   '{"new_york_enters": true}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0004-000000000206', 'a0000000-0000-0000-0000-000000000206', 'quarter-finals', 'Quarter-Finals', 4, 'knockout',
   '{"matches": 4}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0005-000000000206', 'a0000000-0000-0000-0000-000000000206', 'semi-finals', 'Semi-Finals', 5, 'knockout',
   '{"matches": 2}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0006-000000000206', 'a0000000-0000-0000-0000-000000000206', 'final', 'Tailteann Cup Final', 6, 'knockout',
   '{"venue": "Croke Park", "matches": 1}'::jsonb, 'upcoming');

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000206',
  'tailteann_cup_2026',
  'Tailteann Cup 2026',
  'gaelic_football',
  'double_elimination',
  '{
    "format": "tailteann_2026_double_elimination",
    "scoreFormat": "gaa_goals_points",
    "teamCount": 17,
    "openDrawRound1": true,
    "newYorkEntersAt": "preliminary_quarter_final",
    "rounds": [
      {"roundKey": "r1", "name": "Round 1 (Open Draw)", "matches": 8, "winnersTo": "winners_bracket", "losersTo": "losers_bracket"},
      {"roundKey": "r2", "name": "Round 2", "winnersBracket": true, "losersBracket": true},
      {"roundKey": "prelim_qf", "name": "Preliminary Quarter-Finals", "newYorkEnters": true},
      {"roundKey": "qf", "name": "Quarter-Finals", "matches": 4},
      {"roundKey": "sf", "name": "Semi-Finals", "matches": 2},
      {"roundKey": "final", "name": "Final", "matches": 1, "slotIds": ["tc_final"]}
    ],
    "champion": {"slotId": "tc_final"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
