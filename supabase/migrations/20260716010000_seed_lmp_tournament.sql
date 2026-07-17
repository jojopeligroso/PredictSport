-- Seed: Liga Mexicana del Pacífico (LMP) tournament, stages, and bracket template.
-- Second Archetype-B blueprint and the first BASEBALL one. Establishes the
-- `series_elim` shape: a reseeded best-of-7 elimination bracket seeded from the
-- final regular-season table.
--
-- Real format (verified for 2025-26): expanded league (two new franchises inc.
-- Jaguares de Nayarit) -> top 8 -> best-of-7 Quarterfinals (1v8, 2v7, 3v6, 4v5)
-- -> best-of-7 Semifinals -> best-of-7 Final ("Serie de México"), with RESEEDING
-- after each round (highest surviving seed vs lowest). No wild-card play-in.
-- No draws (extra innings decide).
--
-- Seeds 1..8 are resolved from the final table at lock time; the regular-season
-- roster is season data an admin confirms, so the bracket is defined over SEEDS,
-- not hardcoded teams. leagueTeams below is the 2025-26 membership for reference
-- and MUST be re-confirmed each season.

-- ============================================================
-- 1. Sporting Tournament
-- ============================================================

INSERT INTO public.sporting_tournaments (id, slug, name, sport, template_key, config, status, starts_at, ends_at)
VALUES (
  'a0000000-0000-0000-0000-000000000201',
  'lmp-2025-26',
  'Liga Mexicana del Pacífico 2025-26',
  'baseball',
  'lmp_2025_26',
  '{
    "governing_body": "LMP",
    "region": "Mexico",
    "playoff_qualify_count": 8,
    "playoff_shape": "series_elim",
    "series_best_of": 7,
    "reseed_each_round": true,
    "allow_draw": false,
    "has_wild_card": false,
    "champion_qualifies_for": "caribbean_series",
    "roster_confirmable_per_season": true
  }'::jsonb,
  'upcoming',
  '2025-10-14T00:00:00Z',
  '2026-01-29T23:59:59Z'
);

-- ============================================================
-- 2. Sporting Stages (regular season + 3 best-of-7 playoff rounds)
-- ============================================================

-- Regular season: one "group" pool of all franchises; per-game picks are
-- windowed (D1). The final table produces seeds 1..8.
INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0001-000000000201', 'a0000000-0000-0000-0000-000000000201', 'regular-season', 'Regular Season', 1, 'group',
   '{"date_range": ["2025-10-14", "2025-12-31"], "qualify_count": 8, "produces": "seeds_1_8"}'::jsonb, 'upcoming');

-- Playoff: three best-of-7 rounds, reseeded after each.
INSERT INTO public.sporting_stages (id, tournament_id, slug, name, stage_order, stage_type, config, status) VALUES
  ('b0000000-0000-0000-0002-000000000201', 'a0000000-0000-0000-0000-000000000201', 'quarterfinals', 'Quarterfinals', 2, 'knockout',
   '{"date_range": ["2026-01-01", "2026-01-09"], "series_best_of": 7, "matchups": [{"home":"1","away":"8"},{"home":"2","away":"7"},{"home":"3","away":"6"},{"home":"4","away":"5"}]}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0003-000000000201', 'a0000000-0000-0000-0000-000000000201', 'semifinals', 'Semifinals', 3, 'knockout',
   '{"date_range": ["2026-01-11", "2026-01-19"], "series_best_of": 7, "reseed": true}'::jsonb, 'upcoming'),
  ('b0000000-0000-0000-0004-000000000201', 'a0000000-0000-0000-0000-000000000201', 'final', 'Serie de México (Final)', 4, 'knockout',
   '{"date_range": ["2026-01-21", "2026-01-29"], "series_best_of": 7}'::jsonb, 'upcoming');

-- ============================================================
-- 3. Bracket Template (series_elim, reseeded best-of-7)
-- ============================================================
-- Slots reference SEEDS ("1".."8"); reseed=true means after each round the
-- surviving seeds are re-paired highest-vs-lowest rather than following a fixed
-- feed-forward tree. Series winner + games-played length are scored via
-- head_to_head + over_under(stat=games_played) on a synthetic series event.

INSERT INTO public.bracket_templates (id, template_key, name, sport, bracket_type, config)
VALUES (
  'c0000000-0000-0000-0000-000000000201',
  'lmp_2025_26',
  'Liga Mexicana del Pacífico 2025-26',
  'baseball',
  'league_plus_playoff',
  '{
    "format": "series_elim",
    "seriesBestOf": 7,
    "reseedEachRound": true,
    "qualifyCount": 8,
    "seedsFromTable": true,
    "leagueTeams": [
      "Jaguares de Nayarit",
      "Naranjeros de Hermosillo",
      "Tomateros de Culiacán",
      "Charros de Jalisco",
      "Cañeros de Los Mochis",
      "Yaquis de Obregón",
      "Águilas de Mexicali",
      "Algodoneros de Guasave",
      "Venados de Mazatlán",
      "Mayos de Navojoa"
    ],
    "_leagueTeams_note": "2025-26 membership for reference; re-confirm each season. The bracket is seeded from the final table, so slots are seeds 1..8, not fixed teams.",
    "playoffRounds": [
      {
        "roundKey": "quarterfinals",
        "name": "Quarterfinals",
        "matchCount": 4,
        "bestOf": 7,
        "slotIds": ["qf_1", "qf_2", "qf_3", "qf_4"],
        "seeding": {
          "qf_1": {"home": "1", "away": "8"},
          "qf_2": {"home": "2", "away": "7"},
          "qf_3": {"home": "3", "away": "6"},
          "qf_4": {"home": "4", "away": "5"}
        }
      },
      {
        "roundKey": "semifinals",
        "name": "Semifinals",
        "matchCount": 2,
        "bestOf": 7,
        "reseed": true,
        "slotIds": ["sf_1", "sf_2"],
        "_seeding_note": "Reseeded: highest surviving seed vs lowest, second-highest vs second-lowest."
      },
      {
        "roundKey": "final",
        "name": "Serie de México",
        "matchCount": 1,
        "bestOf": 7,
        "slotIds": ["final_1"]
      }
    ],
    "champion": {"slotId": "final_1"},
    "thirdPlacePlayoff": false
  }'::jsonb
);
