-- Seed: FIFA World Cup 2026 tournament, stages, and bracket template
-- This creates the real-world tournament structure that prediction games reference.

-- ============================================================
-- 1. Sporting Tournament
-- ============================================================

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000026',
  'fifa-world-cup-2026',
  'FIFA World Cup 2026',
  'soccer',
  'fifa_world_cup_2026',
  '{
    "host_countries": ["United States", "Canada", "Mexico"],
    "team_count": 48,
    "group_count": 12,
    "teams_per_group": 4,
    "knockout_from": 32,
    "best_third_qualify": 8,
    "best_third_total_groups": 12,
    "third_place_playoff": true
  }'::jsonb,
  'upcoming',
  '2026-06-11T00:00:00Z',
  '2026-07-19T23:59:59Z'
);

-- ============================================================
-- 2. Sporting Stages (9 stages)
-- ============================================================

-- Group stage: 3 matchdays
INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000026', 'a0000000-0000-0000-0000-000000000026', 'group-matchday-1', 'Group Matchday 1', 1, 'group',
   '{"date_range": ["2026-06-11", "2026-06-17"], "matches_per_group": 1, "total_matches": 24}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0002-000000000026', 'a0000000-0000-0000-0000-000000000026', 'group-matchday-2', 'Group Matchday 2', 2, 'group',
   '{"date_range": ["2026-06-18", "2026-06-23"], "matches_per_group": 1, "total_matches": 24}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0003-000000000026', 'a0000000-0000-0000-0000-000000000026', 'group-matchday-3', 'Group Matchday 3', 3, 'group',
   '{"date_range": ["2026-06-24", "2026-06-27"], "matches_per_group": 1, "total_matches": 24}'::jsonb, 'upcoming');

-- Knockout stages
INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0004-000000000026', 'a0000000-0000-0000-0000-000000000026', 'round-of-32', 'Round of 32', 4, 'knockout',
   '{"date_range": ["2026-06-28", "2026-07-03"], "total_matches": 16}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0005-000000000026', 'a0000000-0000-0000-0000-000000000026', 'round-of-16', 'Round of 16', 5, 'knockout',
   '{"date_range": ["2026-07-04", "2026-07-07"], "total_matches": 8}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0006-000000000026', 'a0000000-0000-0000-0000-000000000026', 'quarter-finals', 'Quarter-Finals', 6, 'knockout',
   '{"date_range": ["2026-07-09", "2026-07-11"], "total_matches": 4}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0007-000000000026', 'a0000000-0000-0000-0000-000000000026', 'semi-finals', 'Semi-Finals', 7, 'knockout',
   '{"date_range": ["2026-07-14", "2026-07-15"], "total_matches": 2}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0008-000000000026', 'a0000000-0000-0000-0000-000000000026', 'third-place', 'Third-Place Play-Off', 8, 'knockout',
   '{"date_range": ["2026-07-18", "2026-07-18"], "total_matches": 1}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0009-000000000026', 'a0000000-0000-0000-0000-000000000026', 'final', 'Final', 9, 'knockout',
   '{"date_range": ["2026-07-19", "2026-07-19"], "total_matches": 1}'::jsonb, 'upcoming');

-- ============================================================
-- 3. Bracket Template
-- ============================================================
-- Groups based on FIFA World Cup 2026 official draw (Dec 2025).
-- Teams will be updated when final squads are confirmed.
-- Best-third allocation matrix is PLACEHOLDER — update when FIFA publishes official version.

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000026',
  'fifa_world_cup_2026',
  'FIFA World Cup 2026',
  'soccer',
  'group_plus_knockout',
  '{
    "groups": [
      {"groupId": "A", "name": "Group A", "teams": ["Morocco", "Peru", "Mexico", "Panama"]},
      {"groupId": "B", "name": "Group B", "teams": ["Belgium", "Cameroon", "Costa Rica", "Albania"]},
      {"groupId": "C", "name": "Group C", "teams": ["Germany", "Colombia", "Paraguay", "New Zealand"]},
      {"groupId": "D", "name": "Group D", "teams": ["Japan", "Ecuador", "Scotland", "Honduras"]},
      {"groupId": "E", "name": "Group E", "teams": ["United States", "Portugal", "Uruguay", "Poland"]},
      {"groupId": "F", "name": "Group F", "teams": ["France", "Iran", "South Korea", "Saudi Arabia"]},
      {"groupId": "G", "name": "Group G", "teams": ["Argentina", "Senegal", "Denmark", "Egypt"]},
      {"groupId": "H", "name": "Group H", "teams": ["England", "Serbia", "Ghana", "Bolivia"]},
      {"groupId": "I", "name": "Group I", "teams": ["Spain", "Nigeria", "Australia", "Chile"]},
      {"groupId": "J", "name": "Group J", "teams": ["Netherlands", "Tunisia", "Canada", "Uzbekistan"]},
      {"groupId": "K", "name": "Group K", "teams": ["Brazil", "Ivory Coast", "Turkey", "China PR"]},
      {"groupId": "L", "name": "Group L", "teams": ["Italy", "Croatia", "Jamaica", "Qatar"]}
    ],
    "knockoutRounds": [
      {
        "roundKey": "R32",
        "name": "Round of 32",
        "matchCount": 16,
        "slotIds": ["R32-1","R32-2","R32-3","R32-4","R32-5","R32-6","R32-7","R32-8","R32-9","R32-10","R32-11","R32-12","R32-13","R32-14","R32-15","R32-16"]
      },
      {
        "roundKey": "R16",
        "name": "Round of 16",
        "matchCount": 8,
        "slotIds": ["R16-1","R16-2","R16-3","R16-4","R16-5","R16-6","R16-7","R16-8"]
      },
      {
        "roundKey": "QF",
        "name": "Quarter-Finals",
        "matchCount": 4,
        "slotIds": ["QF-1","QF-2","QF-3","QF-4"]
      },
      {
        "roundKey": "SF",
        "name": "Semi-Finals",
        "matchCount": 2,
        "slotIds": ["SF-1","SF-2"]
      },
      {
        "roundKey": "3RD",
        "name": "Third-Place Play-Off",
        "matchCount": 1,
        "slotIds": ["3RD-1"]
      },
      {
        "roundKey": "F",
        "name": "Final",
        "matchCount": 1,
        "slotIds": ["F-1"]
      }
    ],
    "bestThirdConfig": {
      "qualifyCount": 8,
      "totalGroups": 12,
      "allocationMatrix": {
        "PLACEHOLDER": true,
        "_comment": "FIFA has not published the official 2026 best-third allocation matrix. This placeholder uses a reasonable pattern. Update when official matrix is released. Key = sorted qualifying group letters, value = map of R32 slot to group letter."
      }
    },
    "thirdPlacePlayoff": true,
    "r32Seeding": {
      "_comment": "R32 matchups: 1A vs 2B pattern. Best thirds allocated to specific slots per FIFA matrix.",
      "R32-1":  {"home": "1A", "away": "2B"},
      "R32-2":  {"home": "1C", "away": "2D"},
      "R32-3":  {"home": "1E", "away": "2F"},
      "R32-4":  {"home": "1G", "away": "2H"},
      "R32-5":  {"home": "1I", "away": "2J"},
      "R32-6":  {"home": "1K", "away": "2L"},
      "R32-7":  {"home": "1B", "away": "3_TBD"},
      "R32-8":  {"home": "1D", "away": "3_TBD"},
      "R32-9":  {"home": "1F", "away": "3_TBD"},
      "R32-10": {"home": "1H", "away": "3_TBD"},
      "R32-11": {"home": "1J", "away": "3_TBD"},
      "R32-12": {"home": "1L", "away": "3_TBD"},
      "R32-13": {"home": "2A", "away": "2C"},
      "R32-14": {"home": "2E", "away": "2G"},
      "R32-15": {"home": "2I", "away": "2K"},
      "R32-16": {"home": "2D", "away": "2L"}
    },
    "bracketTree": {
      "_comment": "Which R32 winners feed into which R16 slots, etc.",
      "R16-1": ["R32-1", "R32-2"],
      "R16-2": ["R32-3", "R32-4"],
      "R16-3": ["R32-5", "R32-6"],
      "R16-4": ["R32-7", "R32-8"],
      "R16-5": ["R32-9", "R32-10"],
      "R16-6": ["R32-11", "R32-12"],
      "R16-7": ["R32-13", "R32-14"],
      "R16-8": ["R32-15", "R32-16"],
      "QF-1": ["R16-1", "R16-2"],
      "QF-2": ["R16-3", "R16-4"],
      "QF-3": ["R16-5", "R16-6"],
      "QF-4": ["R16-7", "R16-8"],
      "SF-1": ["QF-1", "QF-2"],
      "SF-2": ["QF-3", "QF-4"],
      "3RD-1": ["SF-1_loser", "SF-2_loser"],
      "F-1": ["SF-1", "SF-2"]
    }
  }'::jsonb
);
