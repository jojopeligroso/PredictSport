-- Result Finalisations & Corrections
-- Audit trail of finalisation events and emergency corrections.

-- ============================================================
-- result_finalisations — finalisation audit trail
-- ============================================================

CREATE TABLE public.result_finalisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id),
  prediction_window_id uuid REFERENCES public.rounds(id),
  sporting_stage_id uuid REFERENCES public.sporting_stages(id),
  finalisation_type text NOT NULL
    CHECK (finalisation_type IN ('window', 'stage')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'finalised', 'corrected')),
  finalised_at timestamptz,
  finalised_by uuid REFERENCES public.users(id),
  finalisation_method text
    CHECK (finalisation_method IN ('manual', 'automatic')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.result_finalisations IS
  'Audit trail of window/stage finalisation events. Each row represents one finalisation action.';

CREATE INDEX idx_finalisations_competition ON public.result_finalisations(competition_id);
CREATE INDEX idx_finalisations_window ON public.result_finalisations(prediction_window_id);
CREATE INDEX idx_finalisations_stage ON public.result_finalisations(sporting_stage_id);

-- ============================================================
-- result_corrections — emergency correction audit
-- ============================================================

CREATE TABLE public.result_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finalisation_id uuid NOT NULL REFERENCES public.result_finalisations(id),
  corrected_by uuid NOT NULL REFERENCES public.users(id),
  corrected_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  old_result_data jsonb NOT NULL,
  new_result_data jsonb NOT NULL,
  affected_event_ids uuid[] NOT NULL,
  affected_window_ids uuid[],
  affected_stage_ids uuid[],
  scoring_recalculated boolean NOT NULL DEFAULT false,
  eliminations_changed boolean NOT NULL DEFAULT false,
  previous_snapshot_id uuid REFERENCES public.classification_standings_snapshots(id),
  replacement_snapshot_id uuid REFERENCES public.classification_standings_snapshots(id),
  metadata jsonb NOT NULL DEFAULT '{}'
);

COMMENT ON TABLE public.result_corrections IS
  'Emergency correction audit trail. Links old and new snapshots for full traceability.';

CREATE INDEX idx_corrections_finalisation ON public.result_corrections(finalisation_id);

-- ============================================================
-- Add deferred FK: classification_standings_snapshots.finalisation_id
-- (Table was created in 20260521200000 without this FK)
-- ============================================================

ALTER TABLE public.classification_standings_snapshots
  ADD CONSTRAINT fk_standings_finalisation
  FOREIGN KEY (finalisation_id) REFERENCES public.result_finalisations(id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.result_finalisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_corrections ENABLE ROW LEVEL SECURITY;

-- Competition members can view finalisations and corrections
CREATE POLICY "Competition members can view finalisations"
  ON public.result_finalisations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competition_members
      WHERE competition_id = result_finalisations.competition_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Competition members can view corrections"
  ON public.result_corrections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.result_finalisations rf
      JOIN public.competition_members cm ON cm.competition_id = rf.competition_id
      WHERE rf.id = result_corrections.finalisation_id
        AND cm.user_id = auth.uid()
    )
  );

-- Super admins have full CRUD
CREATE POLICY "Super admins can manage finalisations"
  ON public.result_finalisations FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins can manage corrections"
  ON public.result_corrections FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );
