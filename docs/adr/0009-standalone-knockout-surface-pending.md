# ADR 0009: Standalone Knockout Prediction surface -- pending

**Status:** Pending
**Date:** 2026-05-20

## Context

There is a desired product behaviour: a separate public knockout-only entry surface and leaderboard that becomes available after the official Round of 32 is known. Users who did not join the parent World Cup competition instance may join this surface. They must not appear on the parent instance's leaderboards.

The implementation must not duplicate canonical World Cup fixtures, results, finalisation jobs, bracket templates, or bracket logic. It must also avoid duplicated predictions where the same user enters the same canonical knockout bracket through both surfaces.

## Decision

The abstraction model for the standalone Knockout Prediction surface is not yet resolved. Implementation is blocked until one of the following is selected:

- A separate competition instance instantiated from the same tournament blueprint (sharing the fixture catalogue and results).
- A separate Classification within a shared competition instance.
- A separate entry cohort with a leaderboard filter.
- Shared bracket-submission scope with scoped visibility.
- Another abstraction.

**Likely approach (pre-decision):** A separate competition instance (its own `competitions` row) instantiated from the same tournament blueprint. It shares the fixture catalogue and confirmed results but has its own classifications, memberships, and leaderboard. This avoids duplicating fixtures, results, finalisation jobs, and bracket engine logic. This is architecturally identical to the auto-provisioning model where a full blueprint spawns new instances on capacity — the standalone knockout surface is simply an instance with a reduced classification set.

## Rationale

- Shipping this surface without a clear abstraction model risks data duplication, conflicting finalisations, or users appearing on leaderboards they should not.
- The constraint set (no duplicated fixtures, no duplicated predictions, separate leaderboards, shared results) is non-trivial and requires focused design.

## Consequences

- This feature is blocked from implementation until the abstraction decision is made.
- The standalone surface may be pre-created as hidden blueprint data.
- It becomes publicly available only after Group Stage finalisation + Super Administrator publication.
- Hard gate: `group_stage_finalised_at` must exist. Calendar date alone is not sufficient.
- Working preset availability date: 2026-06-28.
