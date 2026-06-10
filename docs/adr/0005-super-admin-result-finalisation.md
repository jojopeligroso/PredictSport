# ADR 0005: Super Administrator result finalisation

**Status:** Accepted
**Date:** 2026-05-20

## Context

The existing PredictSport model allows Competition Admins to confirm results. For a canonical shared tournament like FIFA World Cup 2026, multiple independent competition instances reference the same official fixture catalogue and results. Allowing each Competition Admin to independently confirm results would create conflicting authoritative records.

## Decision

Fixture result confirmation is a blueprint-level action: the Super Administrator confirms results once in the shared fixture catalogue, and they propagate to all active competition instances. Finalisation, correction, and blueprint maintenance are also Super Administrator-only actions. A two-step model is used:

1. **Fixture result confirmation (blueprint-level).** Super Administrator confirms an individual match result is correct. This confirmation applies to the shared fixture catalogue and is visible to all instances.
2. **Window/Stage finalisation (per-instance).** Each competition instance computes its own scoring, standings, advancement, snapshots, and eliminations as authoritative, based on the confirmed fixture results.

Competition Admins may manage their own competition instance (invites, copy, preset selection) but cannot confirm results, finalise stages, correct results, or alter official fixtures.

**Fallback auto-finalisation:** If the Super Administrator has not finalised a completed window/stage, the system auto-finalises 15 minutes before the next dependent window locks, provided all required results are present. Missing results block finalisation and escalate to the Super Administrator.

## Rationale

- A single authority for official fixture results prevents conflicting leaderboard states across instances sharing the same tournament blueprint.
- The two-step model separates per-match correctness checks (blueprint-level) from batch-level authoritative finalisation (per-instance).
- Auto-finalisation prevents operational delays from blocking the tournament flow while maintaining the audit trail.

## Consequences

- Provisional results are user-visible but clearly labelled. Authoritative scoring updates only after finalisation.
- Eliminations are never provisional.
- API routes for tournament result confirmation check `is_super_admin` and operate on the shared fixture catalogue. Per-instance finalisation routes also require Super Administrator authority. Existing non-tournament Competition Admin flows are unaffected.
- Corrections require an audited emergency workflow with mandatory reason, old/new data, and snapshot references. Corrections propagate to all instances.
