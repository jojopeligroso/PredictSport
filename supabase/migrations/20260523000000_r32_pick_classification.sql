-- R32 Pick — stage_pick classification for the World Cup
--
-- Extends `classifications.classification_type` to accept 'stage_pick' and
-- inserts the R32 Pick row for the existing World Cup competition. R32 Pick
-- is an automatic byproduct of the Full Bracket — entrants don't make a
-- separate prediction, the score is computed from their bracket's R32 team
-- set vs the actual qualified teams.
--
-- See docs/DESIGN-WC-H1-FULL-BRACKET.md "R32 Classification" section.

-- ---------------------------------------------------------------------------
-- 1. Drop and recreate the type CHECK to allow 'stage_pick'.
-- ---------------------------------------------------------------------------

ALTER TABLE public.classifications
  DROP CONSTRAINT classifications_classification_type_check;

ALTER TABLE public.classifications
  ADD CONSTRAINT classifications_classification_type_check
  CHECK (classification_type IN (
    'leaderboard',
    'format_elimination',
    'bracket_survivor',
    'stage_pick'
  ));

-- ---------------------------------------------------------------------------
-- 2. Insert R32 Pick classification for the existing World Cup competition.
-- ---------------------------------------------------------------------------

INSERT INTO public.classifications (
  competition_id,
  classification_key,
  classification_type,
  name,
  status,
  scoring_strategy,
  config,
  source_template_key
)
SELECT
  c.id,
  'r32_pick',
  'stage_pick',
  'R32 Pick',
  'active',
  jsonb_build_object(
    'points_per_correct_team', 1,
    'max_teams', 32
  ),
  jsonb_build_object(
    'source', 'bracket_group_stage',
    'target_stage', 'r32',
    'derived_from_classification_key', 'full_bracket'
  ),
  NULL
FROM public.competitions c
WHERE c.product_mode = 'world_cup_2026_shell'
ON CONFLICT (competition_id, classification_key) DO NOTHING;
