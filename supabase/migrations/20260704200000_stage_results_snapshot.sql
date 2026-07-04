-- Permanent, immutable snapshot of standings at the end of each completed stage.
-- Once a row is inserted, it must NEVER be deleted or updated by application code.
-- This table exists because computed views (group memberships, points) can be
-- accidentally destroyed by bugs in draw/elimination logic.

CREATE TABLE IF NOT EXISTS stage_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES competitions(id),
  classification_id uuid NOT NULL REFERENCES classifications(id),
  sporting_stage_id uuid NOT NULL REFERENCES sporting_stages(id),
  group_id uuid REFERENCES format_prediction_groups(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  rank integer NOT NULL,
  points numeric NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN (
    'qualified_top', 'qualified_third', 'advanced', 'eliminated'
  )),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One result per user per stage per group
CREATE UNIQUE INDEX IF NOT EXISTS stage_results_unique
  ON stage_results (sporting_stage_id, group_id, user_id);

-- Fast lookups by stage
CREATE INDEX IF NOT EXISTS stage_results_stage_idx
  ON stage_results (sporting_stage_id);

-- Fast lookups by classification
CREATE INDEX IF NOT EXISTS stage_results_classification_idx
  ON stage_results (classification_id);

-- RLS: anyone can read, only service role can write
ALTER TABLE stage_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stage results"
  ON stage_results FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated —
-- only service_role can write to this table.

COMMENT ON TABLE stage_results IS
  'Immutable snapshot of standings at stage conclusion. Never delete rows.';
