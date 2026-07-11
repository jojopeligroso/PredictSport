-- =============================================================================
-- Classification Phases: structural definition of format classification lifecycle
--
-- Adds the 3 missing pieces:
--   1. Which sporting stages form each elimination phase
--   2. Survivor target per phase (entry/exit counts)
--   3. Qualification rule per phase (machine-readable JSONB)
--
-- ADDITIVE ONLY: no drops, no renames, no column alterations.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table 1: classification_phases
-- ---------------------------------------------------------------------------
CREATE TABLE public.classification_phases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid NOT NULL REFERENCES public.classifications(id) ON DELETE CASCADE,

  -- Identity & ordering
  phase_key         text NOT NULL,
  phase_name        text NOT NULL,
  phase_order       int  NOT NULL,

  -- Entrant flow
  entry_count       int,
  exit_count        int,

  -- Rules (machine-readable)
  qualification_rules jsonb NOT NULL DEFAULT '{}',
  pool_structure      jsonb NOT NULL DEFAULT '{}',
  tiebreaker_rules    jsonb,

  -- Scoring scope
  scoring_scope     text NOT NULL DEFAULT 'stage_local'
    CHECK (scoring_scope IN ('stage_local', 'cumulative', 'none')),

  -- Branching support
  source_phase_id   uuid REFERENCES public.classification_phases(id),
  branch_type       text
    CHECK (branch_type IS NULL OR branch_type IN ('winners', 'losers', 'merge', 'continuation')),

  -- Lifecycle
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'finalised')),
  activated_at      timestamptz,
  finalised_at      timestamptz,

  -- Extensible
  config            jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (classification_id, phase_key),
  UNIQUE (classification_id, phase_order)
);

COMMENT ON TABLE public.classification_phases IS
  'Structural definition of each phase in a classification lifecycle. Provisional naming — pending terminology session.';

CREATE INDEX idx_classification_phases_class
  ON public.classification_phases(classification_id);
CREATE INDEX idx_classification_phases_source
  ON public.classification_phases(source_phase_id);

-- ---------------------------------------------------------------------------
-- Table 2: classification_phase_stages (junction)
-- ---------------------------------------------------------------------------
CREATE TABLE public.classification_phase_stages (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id                 uuid NOT NULL REFERENCES public.classification_phases(id) ON DELETE CASCADE,
  sporting_stage_id        uuid NOT NULL REFERENCES public.sporting_stages(id),
  stage_role               text NOT NULL DEFAULT 'scoring'
    CHECK (stage_role IN ('scoring', 'elimination_trigger', 'scoring_and_trigger')),
  stage_order_within_phase int  NOT NULL DEFAULT 1,
  created_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE (phase_id, sporting_stage_id)
);

COMMENT ON TABLE public.classification_phase_stages IS
  'Binds sporting stages to classification phases. A phase can span multiple stages (e.g. group phase = 3 matchdays).';
COMMENT ON COLUMN public.classification_phase_stages.stage_role IS
  'scoring = points accumulate; elimination_trigger = finalising triggers phase transition; scoring_and_trigger = both.';

CREATE INDEX idx_phase_stages_phase
  ON public.classification_phase_stages(phase_id);
CREATE INDEX idx_phase_stages_stage
  ON public.classification_phase_stages(sporting_stage_id);

-- ---------------------------------------------------------------------------
-- Additive column: format_prediction_groups.phase_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.format_prediction_groups
  ADD COLUMN phase_id uuid REFERENCES public.classification_phases(id);

COMMENT ON COLUMN public.format_prediction_groups.phase_id IS
  'The classification phase this group/pool belongs to. Nullable for pre-migration groups until backfill runs.';

CREATE INDEX idx_format_prediction_groups_phase
  ON public.format_prediction_groups(phase_id);

-- ---------------------------------------------------------------------------
-- RLS: classification_phases
-- ---------------------------------------------------------------------------
ALTER TABLE public.classification_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Competition members can view classification phases"
  ON public.classification_phases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classifications c
      JOIN public.competition_members cm ON cm.competition_id = c.competition_id
      WHERE c.id = classification_phases.classification_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage classification phases"
  ON public.classification_phases FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- ---------------------------------------------------------------------------
-- RLS: classification_phase_stages
-- ---------------------------------------------------------------------------
ALTER TABLE public.classification_phase_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Competition members can view phase stages"
  ON public.classification_phase_stages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classification_phases cp
      JOIN public.classifications c ON c.id = cp.classification_id
      JOIN public.competition_members cm ON cm.competition_id = c.competition_id
      WHERE cp.id = classification_phase_stages.phase_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage phase stages"
  ON public.classification_phase_stages FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- ---------------------------------------------------------------------------
-- Backfill: WC2026 classification phases
--
-- Creates 6 phases per format_elimination classification, binds sporting
-- stages, and sets phase_id on existing format_prediction_groups.
--
-- Data sources:
--   - Phase keys/names from the elimination curve structure
--   - Entry/exit counts from actual member counts (48) and curve targets
--   - Qualification rules from the hardcoded TypeScript logic
--   - Stage IDs from sporting_stages table
--   - Group-to-phase mapping from format_prediction_groups.group_name
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  cls RECORD;
  phase_gs_id uuid;
  phase_r32_id uuid;
  phase_r16_id uuid;
  phase_qf_id uuid;
  phase_sf_id uuid;
  phase_final_id uuid;
  member_count int;
  gs_finalised boolean;
  r32_finalised boolean;
  r16_finalised boolean;
  qf_has_groups boolean;
BEGIN
  FOR cls IN
    SELECT c.id as classification_id
    FROM public.classifications c
    WHERE c.classification_type = 'format_elimination'
  LOOP
    -- Get actual member count for this classification
    SELECT COUNT(*) INTO member_count
    FROM public.classification_memberships
    WHERE classification_id = cls.classification_id;

    -- Determine phase statuses from stage_results existence
    SELECT EXISTS(
      SELECT 1 FROM public.stage_results sr
      WHERE sr.classification_id = cls.classification_id
        AND sr.sporting_stage_id = 'b0000000-0000-0000-0003-000000000026'
    ) INTO gs_finalised;

    SELECT EXISTS(
      SELECT 1 FROM public.stage_results sr
      WHERE sr.classification_id = cls.classification_id
        AND sr.sporting_stage_id = 'b0000000-0000-0000-0004-000000000026'
    ) INTO r32_finalised;

    SELECT EXISTS(
      SELECT 1 FROM public.stage_results sr
      WHERE sr.classification_id = cls.classification_id
        AND sr.sporting_stage_id = 'b0000000-0000-0000-0005-000000000026'
    ) INTO r16_finalised;

    SELECT EXISTS(
      SELECT 1 FROM public.format_prediction_groups g
      WHERE g.classification_id = cls.classification_id
        AND g.group_name = 'Quarter-Finals'
    ) INTO qf_has_groups;

    -- Phase 1: Group Stage
    INSERT INTO public.classification_phases
      (classification_id, phase_key, phase_name, phase_order,
       entry_count, exit_count, scoring_scope,
       qualification_rules, pool_structure, status)
    VALUES
      (cls.classification_id, 'group_stage', 'Group Stage', 1,
       member_count, 32, 'stage_local',
       '{"method":"top_n_per_group_with_best_thirds","qualify_per_group":2,"best_thirds":{"eligible_group_sizes":[4],"auto_qualify_group_sizes":[5],"never_qualify_group_sizes":[3]},"tie_handling":"both_advance"}'::jsonb,
       '{"type":"grouped","target_group_size":4,"naming_convention":"alphabetic","naming_prefix":"Group","allow_reconciliation":true,"min_viable_group_size":3}'::jsonb,
       CASE WHEN gs_finalised THEN 'finalised' ELSE 'active' END)
    ON CONFLICT (classification_id, phase_key) DO NOTHING
    RETURNING id INTO phase_gs_id;

    -- If already existed, fetch the id
    IF phase_gs_id IS NULL THEN
      SELECT id INTO phase_gs_id FROM public.classification_phases
      WHERE classification_id = cls.classification_id AND phase_key = 'group_stage';
    END IF;

    -- Phase 2: Round of 32
    INSERT INTO public.classification_phases
      (classification_id, phase_key, phase_name, phase_order,
       entry_count, exit_count, scoring_scope,
       qualification_rules, pool_structure,
       source_phase_id, branch_type, status)
    VALUES
      (cls.classification_id, 'round_of_32', 'Round of 32', 2,
       32, 16, 'stage_local',
       '{"method":"top_n_flat","target_survivors":16,"tie_handling":"both_advance"}'::jsonb,
       '{"type":"single","naming_convention":"stage_name"}'::jsonb,
       phase_gs_id, 'continuation',
       CASE WHEN r32_finalised THEN 'finalised'
            WHEN gs_finalised THEN 'active'
            ELSE 'pending' END)
    ON CONFLICT (classification_id, phase_key) DO NOTHING
    RETURNING id INTO phase_r32_id;

    IF phase_r32_id IS NULL THEN
      SELECT id INTO phase_r32_id FROM public.classification_phases
      WHERE classification_id = cls.classification_id AND phase_key = 'round_of_32';
    END IF;

    -- Phase 3: Round of 16
    INSERT INTO public.classification_phases
      (classification_id, phase_key, phase_name, phase_order,
       entry_count, exit_count, scoring_scope,
       qualification_rules, pool_structure,
       source_phase_id, branch_type, status)
    VALUES
      (cls.classification_id, 'round_of_16', 'Round of 16', 3,
       16, 8, 'stage_local',
       '{"method":"top_n_flat","target_survivors":8,"tie_handling":"both_advance"}'::jsonb,
       '{"type":"single","naming_convention":"stage_name"}'::jsonb,
       phase_r32_id, 'continuation',
       CASE WHEN r16_finalised THEN 'finalised'
            WHEN r32_finalised THEN 'active'
            ELSE 'pending' END)
    ON CONFLICT (classification_id, phase_key) DO NOTHING
    RETURNING id INTO phase_r16_id;

    IF phase_r16_id IS NULL THEN
      SELECT id INTO phase_r16_id FROM public.classification_phases
      WHERE classification_id = cls.classification_id AND phase_key = 'round_of_16';
    END IF;

    -- Phase 4: Quarter-Finals
    INSERT INTO public.classification_phases
      (classification_id, phase_key, phase_name, phase_order,
       entry_count, exit_count, scoring_scope,
       qualification_rules, pool_structure,
       source_phase_id, branch_type, status)
    VALUES
      (cls.classification_id, 'quarter_finals', 'Quarter-Finals', 4,
       8, 4, 'stage_local',
       '{"method":"top_n_flat","target_survivors":4,"tie_handling":"both_advance"}'::jsonb,
       '{"type":"single","naming_convention":"stage_name"}'::jsonb,
       phase_r16_id, 'continuation',
       CASE WHEN qf_has_groups AND r16_finalised THEN 'active'
            ELSE 'pending' END)
    ON CONFLICT (classification_id, phase_key) DO NOTHING
    RETURNING id INTO phase_qf_id;

    IF phase_qf_id IS NULL THEN
      SELECT id INTO phase_qf_id FROM public.classification_phases
      WHERE classification_id = cls.classification_id AND phase_key = 'quarter_finals';
    END IF;

    -- Phase 5: Semi-Finals
    INSERT INTO public.classification_phases
      (classification_id, phase_key, phase_name, phase_order,
       entry_count, exit_count, scoring_scope,
       qualification_rules, pool_structure,
       source_phase_id, branch_type, status)
    VALUES
      (cls.classification_id, 'semi_finals', 'Semi-Finals', 5,
       4, 2, 'stage_local',
       '{"method":"top_n_flat","target_survivors":2,"tie_handling":"both_advance"}'::jsonb,
       '{"type":"single","naming_convention":"stage_name"}'::jsonb,
       phase_qf_id, 'continuation', 'pending')
    ON CONFLICT (classification_id, phase_key) DO NOTHING
    RETURNING id INTO phase_sf_id;

    IF phase_sf_id IS NULL THEN
      SELECT id INTO phase_sf_id FROM public.classification_phases
      WHERE classification_id = cls.classification_id AND phase_key = 'semi_finals';
    END IF;

    -- Phase 6: Final
    INSERT INTO public.classification_phases
      (classification_id, phase_key, phase_name, phase_order,
       entry_count, exit_count, scoring_scope,
       qualification_rules, pool_structure,
       source_phase_id, branch_type, status)
    VALUES
      (cls.classification_id, 'final', 'Final', 6,
       2, 1, 'stage_local',
       '{"method":"top_n_flat","target_survivors":1,"tie_handling":"both_advance"}'::jsonb,
       '{"type":"single","naming_convention":"stage_name"}'::jsonb,
       phase_sf_id, 'continuation', 'pending')
    ON CONFLICT (classification_id, phase_key) DO NOTHING
    RETURNING id INTO phase_final_id;

    IF phase_final_id IS NULL THEN
      SELECT id INTO phase_final_id FROM public.classification_phases
      WHERE classification_id = cls.classification_id AND phase_key = 'final';
    END IF;

    -- -----------------------------------------------------------------------
    -- Phase-stage bindings (9 per classification)
    -- -----------------------------------------------------------------------

    -- Group Stage: 3 matchdays
    INSERT INTO public.classification_phase_stages (phase_id, sporting_stage_id, stage_role, stage_order_within_phase)
    VALUES
      (phase_gs_id, 'b0000000-0000-0000-0001-000000000026', 'scoring', 1),
      (phase_gs_id, 'b0000000-0000-0000-0002-000000000026', 'scoring', 2),
      (phase_gs_id, 'b0000000-0000-0000-0003-000000000026', 'scoring_and_trigger', 3)
    ON CONFLICT (phase_id, sporting_stage_id) DO NOTHING;

    -- R32
    INSERT INTO public.classification_phase_stages (phase_id, sporting_stage_id, stage_role, stage_order_within_phase)
    VALUES (phase_r32_id, 'b0000000-0000-0000-0004-000000000026', 'scoring_and_trigger', 1)
    ON CONFLICT (phase_id, sporting_stage_id) DO NOTHING;

    -- R16
    INSERT INTO public.classification_phase_stages (phase_id, sporting_stage_id, stage_role, stage_order_within_phase)
    VALUES (phase_r16_id, 'b0000000-0000-0000-0005-000000000026', 'scoring_and_trigger', 1)
    ON CONFLICT (phase_id, sporting_stage_id) DO NOTHING;

    -- QF
    INSERT INTO public.classification_phase_stages (phase_id, sporting_stage_id, stage_role, stage_order_within_phase)
    VALUES (phase_qf_id, 'b0000000-0000-0000-0006-000000000026', 'scoring_and_trigger', 1)
    ON CONFLICT (phase_id, sporting_stage_id) DO NOTHING;

    -- SF
    INSERT INTO public.classification_phase_stages (phase_id, sporting_stage_id, stage_role, stage_order_within_phase)
    VALUES (phase_sf_id, 'b0000000-0000-0000-0007-000000000026', 'scoring_and_trigger', 1)
    ON CONFLICT (phase_id, sporting_stage_id) DO NOTHING;

    -- Final: third-place (scoring only) + final (scoring_and_trigger)
    INSERT INTO public.classification_phase_stages (phase_id, sporting_stage_id, stage_role, stage_order_within_phase)
    VALUES
      (phase_final_id, 'b0000000-0000-0000-0008-000000000026', 'scoring', 1),
      (phase_final_id, 'b0000000-0000-0000-0009-000000000026', 'scoring_and_trigger', 2)
    ON CONFLICT (phase_id, sporting_stage_id) DO NOTHING;

    -- -----------------------------------------------------------------------
    -- Backfill format_prediction_groups.phase_id
    -- -----------------------------------------------------------------------

    -- Groups A-L → group_stage
    UPDATE public.format_prediction_groups
    SET phase_id = phase_gs_id
    WHERE classification_id = cls.classification_id
      AND group_name LIKE 'Group %'
      AND phase_id IS NULL;

    -- "Round of 32" pool → round_of_32
    UPDATE public.format_prediction_groups
    SET phase_id = phase_r32_id
    WHERE classification_id = cls.classification_id
      AND group_name = 'Round of 32'
      AND phase_id IS NULL;

    -- "Round of 16" pool → round_of_16
    UPDATE public.format_prediction_groups
    SET phase_id = phase_r16_id
    WHERE classification_id = cls.classification_id
      AND group_name = 'Round of 16'
      AND phase_id IS NULL;

    -- "Quarter-Finals" pool → quarter_finals
    UPDATE public.format_prediction_groups
    SET phase_id = phase_qf_id
    WHERE classification_id = cls.classification_id
      AND group_name = 'Quarter-Finals'
      AND phase_id IS NULL;

    -- "Semi-Finals" pool → semi_finals (if exists)
    UPDATE public.format_prediction_groups
    SET phase_id = phase_sf_id
    WHERE classification_id = cls.classification_id
      AND group_name = 'Semi-Finals'
      AND phase_id IS NULL;

    -- "Final" pool → final (if exists)
    UPDATE public.format_prediction_groups
    SET phase_id = phase_final_id
    WHERE classification_id = cls.classification_id
      AND group_name = 'Final'
      AND phase_id IS NULL;

  END LOOP;
END $$;
