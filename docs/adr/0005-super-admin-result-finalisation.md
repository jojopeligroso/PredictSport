# ADR 0005: Super Administrator result finalisation

**Status:** Accepted
**Date:** 2026-05-20

## Context

The existing PredictSport model allows Competition Admins to confirm results. For a canonical shared tournament like FIFA World Cup 2026, multiple independent Prediction Games reference the same official fixtures and results. Allowing each Competition Admin to independently confirm results would create conflicting authoritative records.

## Decision

Result confirmation, finalisation, correction, and template maintenance for tournament competitions are Super Administrator-only actions. A two-step model is used:

1. **Fixture result confirmation.** Super Administrator confirms an individual match result is correct.
2. **Window/Stage finalisation.** Super Administrator confirms the full result set is complete. Scoring, standings, advancement, snapshots, and eliminations become authoritative.

Competition Admins may manage their own Prediction Game (invites, copy, preset selection) but cannot confirm results, finalise stages, correct results, or alter official fixtures.

**Fallback auto-finalisation:** If the Super Administrator has not finalised a completed window/stage, the system auto-finalises 15 minutes before the next dependent window locks, provided all required results are present. Missing results block finalisation and escalate to the Super Administrator.

## Rationale

- A single authority for official results prevents conflicting leaderboard states across competitions sharing the same tournament.
- The two-step model separates per-match correctness checks from batch-level authoritative finalisation.
- Auto-finalisation prevents operational delays from blocking the tournament flow while maintaining the audit trail.

## Consequences

- Provisional results are user-visible but clearly labelled. Authoritative scoring updates only after finalisation.
- Eliminations are never provisional.
- API routes for tournament result confirmation and finalisation check `is_super_admin`. Existing non-tournament Competition Admin flows are unaffected.
- Corrections require an audited emergency workflow with mandatory reason, old/new data, and snapshot references.
