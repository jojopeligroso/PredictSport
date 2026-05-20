-- Classification Events & Standing Snapshots
-- Maps which events/windows count for which classification.
-- Immutable standing snapshots written at finalisation points.

-- ============================================================
-- classification_events — event/window → classification mapping
-- ============================================================

CREATE TABLE public.classification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid NOT NULL REFERENCES public.classifications(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES public.competitions(id),
  prediction_window_id uuid REFERENCES public.rounds(id),
  event_id uuid REFERENCES public.events(id),
  sporting_stage_id uuid REFERENCES public.sporting_stages(id),
  counts_for_scoring boolean NOT NULL DEFAULT true,
  counts_for_elimination boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.classification_events IS
  'Maps events and prediction windows to classifications. Controls which events count for scoring and elimination.';

CREATE INDEX idx_classification_events_class ON public.classification_events(classification_id);
CREATE INDEX idx_classification_events_window ON public.classification_events(prediction_window_id);
CREATE INDEX idx_classification_events_event ON public.classification_events(event_id);

-- ============================================================
-- classification_standings_snapshots — immutable finalised standings
-- ============================================================

CREATE TABLE public.classification_standings_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid NOT NULL REFERENCES public.classifications(id),
  competition_id uuid NOT NULL REFERENCES public.competitions(id),
  prediction_window_id uuid REFERENCES public.rounds(id),
  sporting_stage_id uuid REFERENCES public.sporting_stages(id),
  finalisation_id uuid, -- FK added after result_finalisations table exists
  snapshot_type text NOT NULL
    CHECK (snapshot_type IN ('window', 'stage', 'final', 'correction')),
  standings_data jsonb NOT NULL,
  entrant_count int NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES public.users(id),
  generation_method text NOT NULL
    CHECK (generation_method IN ('manual', 'automatic', 'correction')),
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.classification_standings_snapshots IS
  'Immutable point-in-time standings written at finalisation. standings_data is an array of {rank, user_id, display_name, points, status, tie_break_values, movement, eliminated, metadata}.';
COMMENT ON COLUMN public.classification_standings_snapshots.checksum IS
  'Optional integrity hash for audit verification.';

CREATE INDEX idx_standings_snapshots_class ON public.classification_standings_snapshots(classification_id);
CREATE INDEX idx_standings_snapshots_window ON public.classification_standings_snapshots(prediction_window_id);
CREATE INDEX idx_standings_snapshots_stage ON public.classification_standings_snapshots(sporting_stage_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.classification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_standings_snapshots ENABLE ROW LEVEL SECURITY;

-- Competition members can view classification events
CREATE POLICY "Competition members can view classification events"
  ON public.classification_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competition_members
      WHERE competition_id = classification_events.competition_id
        AND user_id = auth.uid()
    )
  );

-- Super admins can manage classification events
CREATE POLICY "Super admins can manage classification events"
  ON public.classification_events FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Competition members can view snapshots
CREATE POLICY "Competition members can view standing snapshots"
  ON public.classification_standings_snapshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competition_members
      WHERE competition_id = classification_standings_snapshots.competition_id
        AND user_id = auth.uid()
    )
  );

-- Super admins can insert snapshots
CREATE POLICY "Super admins can insert standing snapshots"
  ON public.classification_standings_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );
