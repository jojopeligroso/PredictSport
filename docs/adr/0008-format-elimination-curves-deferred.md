# ADR 0008: Format Classification elimination curves

**Status:** Accepted (resolved)
**Date:** 2026-05-20
**Resolved:** 2026-05-20

## Context

The Format Classification eliminates Entrants at each Sporting Stage boundary. The elimination rate is governed by a curve that maps entrant count to survivor count at each stage.

The original ADR deferred exact curve definition to a dedicated design session. That session produced `predictsport-world-cup-2026-elimination-curve-solution.md`, which was audited in `docs/AUDIT-elimination-curve-solution.md`.

## Decision

Phase 1 uses a formula-based elimination curve generator that accepts any entrant count from 8 to 96 (not just presets). The curve formula is defined in the tournament blueprint. For each competition instance, the curve is generated at PW1 lock from the instance's actual entrant count and stored as an immutable per-instance snapshot in `classifications.config.elimination_curve`.

**Core formula:**
- Group Stage survivor target: `ceil(N * 2/3)`
- Later stages: `max(ceil(prev/2), min_for_remaining_steps)`
- SF elimination always reduces to the finalist band count
- Finalist bands: 8-55 → 2, 56-79 → 3, 80-96 → 4

**Group qualification rules:**
- Top 2 from every group qualify automatically.
- Third from 5-player groups qualifies automatically.
- Additional best-third qualification from 4-player groups only.
- Third from 3-player groups never qualifies.
- Fourth place never qualifies.

**Stage mapping:** "Entering Final Prediction Window" = after SF finalisation. PW8 bundles Third-Place Play-Off + Final. 8 Prediction Windows total.

See SPEC.md §16.8 for the full locked specification.

## Rationale

- Formula-based generation replaces hard-coded presets, supporting any entrant count 8-96.
- The 2/3 group stage cut preserves social tension without being brutally aggressive.
- Generous halving with minimum-steps clamping guarantees at least 1 elimination per stage.
- Finalist bands prevent awkward 1-person or 5+ person finals.
- All 16 reference curves and the full 8-96 range were verified computationally.

## Consequences

- The existing `getEliminationCurveForPreset()` lookup table must be replaced with the formula generator.
- Group allocation must be target-aware (3/4/5-player groups).
- Best-third ranking must filter by group size.
- Elimination logic must handle variable group sizes.
- Curve storage format should use an ordered array, not a stage-keyed map.
- Proportional curves remain Phase 2 exploration.

## Supersedes

This ADR supersedes the original "deferred" decision. The placeholder curves in `create-world-cup-competition.ts` are incorrect and must be replaced.
