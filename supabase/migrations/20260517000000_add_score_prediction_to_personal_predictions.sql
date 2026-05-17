-- Add exact score prediction support to personal predictions
ALTER TABLE personal_predictions
  ADD COLUMN score_prediction jsonb,
  ADD COLUMN score_correct boolean;
