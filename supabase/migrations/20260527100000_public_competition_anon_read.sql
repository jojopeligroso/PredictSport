-- ADR 0014: the picks-first /wc landing renders a blurred read-only preview
-- of the matchday-1 group-stage picks for anonymous + non-member visitors.
-- That preview requires server-side reads of rounds, events, and
-- event_prediction_types — which existing RLS restricts to competition
-- members. The competition row itself was already readable for anon when
-- visibility='public'; this migration extends that same "public competition"
-- escape hatch down to the child tables so the landing can render its
-- preview shell without service-role keys or proxy routes.
--
-- Security shape: read-only, scoped strictly to competitions where
-- visibility='public'. Write policies (INSERT/UPDATE/DELETE) are untouched.
-- The predictions table is NOT loosened — anon still cannot read picks,
-- only the fixture / EPT shape the landing needs to render cards.

-- Rounds: existing "Members can see rounds" policy stays; we layer a
-- second SELECT policy that fires for public competitions.
CREATE POLICY "Public competition rounds are readable"
  ON rounds FOR SELECT
  USING (
    competition_id IN (
      SELECT id FROM competitions WHERE visibility = 'public'
    )
  );

-- Events: same pattern. Members policy unchanged; public-comp events readable.
CREATE POLICY "Public competition events are readable"
  ON events FOR SELECT
  USING (
    round_id IN (
      SELECT r.id FROM rounds r
      JOIN competitions c ON c.id = r.competition_id
      WHERE c.visibility = 'public'
    )
  );

-- Event prediction types: scoped via the event → round → competition chain.
CREATE POLICY "Public competition EPTs are readable"
  ON event_prediction_types FOR SELECT
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN rounds r ON r.id = e.round_id
      JOIN competitions c ON c.id = r.competition_id
      WHERE c.visibility = 'public'
    )
  );
