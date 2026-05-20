# ADR 0009: Standalone Knockout Prediction surface -- pending

**Status:** Pending
**Date:** 2026-05-20

## Context

There is a desired product behaviour: a separate public knockout-only entry surface and leaderboard that becomes available after the official Round of 32 is known. Users who did not join the parent World Cup Prediction Game may join this surface. They must not appear on the parent game's leaderboards.

The implementation must not duplicate canonical World Cup fixtures, results, finalisation jobs, bracket templates, or bracket logic. It must also avoid duplicated predictions where the same user enters the same canonical knockout bracket through both surfaces.

## Decision

The abstraction model for the standalone Knockout Prediction surface is not yet resolved. Implementation is blocked until one of the following is selected:

- Separate Competition (sharing the same `sporting_tournaments` fixtures/results).
- Separate Classification within a shared Competition.
- Separate entry cohort with a leaderboard filter.
- Shared bracket-submission scope with scoped visibility.
- Another abstraction.

**Likely approach (pre-decision):** A separate `competitions` row that shares the same `sporting_tournaments` fixtures and results but has its own classifications, memberships, and leaderboard. This avoids duplicating fixtures, results, finalisation jobs, and bracket engine logic.

## Rationale

- Shipping this surface without a clear abstraction model risks data duplication, conflicting finalisations, or users appearing on leaderboards they should not.
- The constraint set (no duplicated fixtures, no duplicated predictions, separate leaderboards, shared results) is non-trivial and requires focused design.

## Consequences

- This feature is blocked from implementation until the abstraction decision is made.
- The standalone surface may be pre-created as hidden template data.
- It becomes publicly available only after Group Stage finalisation + Super Administrator publication.
- Hard gate: `group_stage_finalised_at` must exist. Calendar date alone is not sufficient.
- Working preset availability date: 2026-06-28.
