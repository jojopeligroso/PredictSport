-- Structural protection: prevent deletion of archived/immutable data.
--
-- These triggers prevent any code path (including service-role) from
-- deleting rows that represent finalised historical state. This guards
-- against the allocatePredictionGroups incident (2026-07-04) where
-- archived format groups were destroyed.

-- 1. Prevent deletion of archived format_prediction_groups
CREATE OR REPLACE FUNCTION public.prevent_archived_group_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'archived' THEN
    RAISE EXCEPTION 'Cannot delete archived format_prediction_group %: archived groups are immutable', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_archived_group_delete
  BEFORE DELETE ON public.format_prediction_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_archived_group_delete();

-- 2. Prevent deletion of memberships in archived groups
CREATE OR REPLACE FUNCTION public.prevent_archived_membership_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  group_status text;
BEGIN
  SELECT status INTO group_status
  FROM public.format_prediction_groups
  WHERE id = OLD.group_id;

  IF group_status = 'archived' THEN
    RAISE EXCEPTION 'Cannot delete membership in archived group %: archived group memberships are immutable', OLD.group_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_archived_membership_delete
  BEFORE DELETE ON public.format_group_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_archived_membership_delete();

-- 3. Prevent deletion of stage_results (always immutable)
CREATE OR REPLACE FUNCTION public.prevent_stage_results_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Cannot delete stage_results row %: stage results are immutable', OLD.id;
END;
$$;

CREATE TRIGGER trg_prevent_stage_results_delete
  BEFORE DELETE ON public.stage_results
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_stage_results_delete();

-- 4. Prevent status change on archived groups (can't un-archive)
CREATE OR REPLACE FUNCTION public.prevent_archived_group_unarchive()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'archived' AND NEW.status != 'archived' THEN
    RAISE EXCEPTION 'Cannot change status of archived format_prediction_group %: archived groups are immutable', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_archived_group_unarchive
  BEFORE UPDATE ON public.format_prediction_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_archived_group_unarchive();
