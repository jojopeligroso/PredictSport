-- Atomic enforcement of competitions.max_entrants on competition_members.
--
-- The application layer pre-checks the entrant count before inserting, but that
-- read-then-insert is not atomic: two concurrent joins can both observe "room
-- for one" and both succeed, pushing an instance past its cap. This trigger
-- closes that race at the database level so an instance can NEVER exceed
-- max_entrants, regardless of which path (API, admin tooling, raw SQL) inserts.
--
-- Mechanism: a per-competition transaction-scoped advisory lock serializes
-- concurrent inserts for the same competition, so the COUNT(*) the trigger sees
-- is accurate. If the instance is already at capacity it raises COMPETITION_FULL;
-- callers catch this and auto-provision the next instance (see cap-aware-join.ts).
--
-- Competitions with max_entrants IS NULL are uncapped and unaffected.

CREATE OR REPLACE FUNCTION public.enforce_competition_entrant_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max   int;
  v_count int;
BEGIN
  SELECT max_entrants INTO v_max
  FROM public.competitions
  WHERE id = NEW.competition_id;

  -- Uncapped competition → allow.
  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent inserts for this competition. The lock is namespaced
  -- (first key) so it cannot collide with unrelated advisory locks, and is held
  -- until the transaction commits, releasing the next waiter with an up-to-date
  -- count.
  PERFORM pg_advisory_xact_lock(
    hashtext('competition_members_cap'),
    hashtext(NEW.competition_id::text)
  );

  SELECT count(*) INTO v_count
  FROM public.competition_members
  WHERE competition_id = NEW.competition_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'COMPETITION_FULL'
      USING ERRCODE = 'P0001',
            HINT = 'Instance is at max_entrants; provision the next instance.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_entrant_cap ON public.competition_members;

CREATE TRIGGER trg_enforce_entrant_cap
  BEFORE INSERT ON public.competition_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_competition_entrant_cap();
