# ADR 0003: Versioned JSON bracket prediction snapshots

**Status:** Accepted
**Date:** 2026-05-20

## Context

Full Bracket Survivor and Knockout Bracket Survivor require Entrants to submit complex structured predictions: group rankings, best-third picks, knockout progression picks, and champion selection. These predictions are edited iteratively before lock and must become immutable at lock time.

Two storage approaches were considered: (A) normalised relational rows per pick slot, or (B) versioned JSON snapshots with the full bracket state per submission.

## Decision

Phase 1 stores bracket predictions as versioned JSON snapshots in `bracket_prediction_submissions`. Each row contains a `bracket_data` JSONB column holding the complete bracket state (group rankings, best-third picks, knockout picks, champion, optional third-place pick).

Until lock, each save creates or updates the Entrant's current draft. At lock, the latest valid submitted bracket becomes immutable (`status = 'locked'`). Previous versions are retained for audit.

## Rationale

- A bracket submission is a single conceptual unit. Normalising into per-slot rows adds join complexity without Phase 1 benefit.
- Versioned snapshots preserve full edit history for audit and recovery.
- The generic Bracket Prediction Engine validates against `bracket_data` structure. FIFA-specific validation (12 groups, best-third allocation) lives in the World Cup 2026 adapter, not in the generic engine.
- Future normalisation can be added if reporting or scoring demands it, without changing the submission model.

## Consequences

- Bracket scoring reads `bracket_data` JSON and walks the structure against official results.
- Correctness is slot-sensitive: a team reaching the correct round via the wrong bracket path is not counted as correct.
- The generic engine stores bracket predictions, lock state, advancement picks, scoring hooks, and validation results. World Cup-specific bracket logic (best-third allocation matrix, 12-group R32 mapping) lives in the adapter.
