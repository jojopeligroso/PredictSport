-- A3: Drop legacy personal_predictions table
--
-- All data has been ported to the unified competition model by
-- 20260518000001_port_personal_predictions.sql. This migration
-- removes the legacy table, its RLS policies, and indexes.

DROP TABLE IF EXISTS public.personal_predictions CASCADE;
