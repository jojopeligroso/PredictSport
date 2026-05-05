-- Add yes_no and progression prediction types to all relevant check constraints.

-- 1. event_prediction_types.prediction_type
alter table public.event_prediction_types
  drop constraint if exists event_prediction_types_prediction_type_check;

alter table public.event_prediction_types
  add constraint event_prediction_types_prediction_type_check
  check (prediction_type in ('winner', 'top_n', 'head_to_head', 'margin', 'over_under', 'handicap', 'yes_no', 'progression'));

-- 2. predictions.prediction_type
alter table public.predictions
  drop constraint if exists predictions_prediction_type_check;

alter table public.predictions
  add constraint predictions_prediction_type_check
  check (prediction_type in ('winner', 'top_n', 'head_to_head', 'margin', 'over_under', 'handicap', 'yes_no', 'progression'));

-- 3. event_nominations.proposed_prediction_type (nullable)
alter table public.event_nominations
  drop constraint if exists event_nominations_proposed_prediction_type_check;

alter table public.event_nominations
  add constraint event_nominations_proposed_prediction_type_check
  check (proposed_prediction_type in ('winner', 'top_n', 'head_to_head', 'margin', 'over_under', 'handicap', 'yes_no', 'progression'));
