# ADR 0008: Format Classification elimination curves -- deferred

**Status:** Accepted
**Date:** 2026-05-20

## Context

The Format Classification eliminates Entrants at each Sporting Stage boundary. The elimination rate is governed by a curve that maps entrant count to survivor count at each stage. Five entrant presets are approved for Phase 1: 12, 24, 48, 64, 96.

Defining exact curves requires resolving:

- How many Entrants survive each stage for each preset.
- At what preset sizes a 3-finalist vs 4-finalist curve is appropriate.
- Whether awkward counts near threshold values need special handling.
- How to balance tournament rhythm, tension, fairness, and engagement.

## Decision

Exact elimination curves are deliberately deferred to a dedicated design session. Phase 1 accepts fixed milestone curves stored as configurable template data.

Locked constraints that bound the eventual curves:

| Entrant Count | Final Window Entrants |
|---:|---:|
| 96 | 4 |
| 64 | 3 |
| 48 | 2 |
| Fewer than 48 | 2 or fewer |

No preset may send more than 4 Entrants into the Final Prediction Window. 50% elimination is a useful tension heuristic, not a law. Curves must not be hard-coded as a single formula.

The selected preset and curve become immutable once the first Prediction Window locks. The UI must show the consequence table for the selected preset before launch.

## Rationale

- Getting the curve right requires playtesting and stakeholder input that cannot be rushed during the implementation phase.
- The engine reads curves from `classification.config.elimination_curve`, so implementation can proceed with placeholder curves and swap in final values later.
- Proportional curves are explicitly Phase 2 exploration.

## Consequences

- Implementation must build the elimination engine to read curves from config, not hard-code them.
- Placeholder curves must be clearly marked as draft in seed data.
- The dedicated curve session must be completed before the first public competition launches.
