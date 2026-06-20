# ADR 0019: Optimistic Scoring with Async Cross-Validation

**Status:** Accepted
**Date:** 2026-06-20

## Context

On 2026-06-20, ESPN returned "United States" as `result.winner` for USA vs Australia, but prediction options used "USA". The string comparison failed silently, scoring all 33 correct winner predictions as wrong. A positional derivation fix (commit `7fe6aba`) eliminated team-name mismatches permanently by deriving the winner from score numbers and options array position. However, the platform still trusts a single API provider's score data with no independent verification. If a provider returns an incorrect score (as opposed to an incorrect name), the positional fix cannot help — wrong numbers produce wrong scoring.

The Provider Chain (`src/lib/sports/fetch-result.ts`) already queries providers in priority order per sport, but stops at the first non-null result. Multiple providers exist for most sports (soccer has 4: API-Football, ESPN, TheSportsDB, BallDontLie). The question was how to use the remaining providers as a cross-check.

Two timing models were considered: **hold-until-verified** (delay scoring until two providers agree) and **score-then-verify** (score immediately, verify asynchronously). The hold model guarantees users never see a wrong score; the optimistic model gives users fast feedback and treats disagreements as a rare exception path.

## Decision

**Score immediately on the first provider's `is_final: true` result. Verify asynchronously against a second provider. Promote to "verified" on agreement; flag as "disputed" on disagreement.**

### Scoring and notification

Predictions are scored, points awarded, and notifications (push + chat system message) fired the moment the primary provider returns a final result. Users see their points immediately with no provisional indicator. The verification status (`pending → verified | disputed | unverifiable`) is tracked internally in `result_data` JSONB and is invisible to participants unless a dispute occurs.

### Verification mechanics

A new pure function `compareResults(primary, verifier, sport)` handles comparison. A separate orchestration function `verifyResult(primaryResult, sport, externalEventId, providerLeague?)` walks the Provider Chain, skipping the provider that returned the primary result, and delegates to `compareResults`. This two-layer split keeps comparison logic fully unit-testable without network or database dependencies.

**What is compared:**
- Team sports (soccer, rugby, GAA, basketball, etc.): `home_score` and `away_score` only. Winner is derived from score via positional derivation — comparing winner strings would reintroduce the name-mismatch problem this system is designed to prevent.
- Position-based sports (F1, golf, horse racing): top 3 finishing positions by name.

**Verifier `is_final` handling:**
- Scores match → **verified** (regardless of verifier's `is_final` — providers update finality flags at different speeds)
- Scores differ, verifier `is_final: false` → **retry** next cron cycle (verifier data is stale) + push notify admin
- Scores differ, verifier `is_final: true` → **disputed** + push notify admin + chat system message to all competition members

### Retry budget

1 immediate attempt after the primary confirms, then 1 retry on the next cron cycle (5 minutes later). If both attempts fail to produce a verifier result, auto-promote to `unverifiable` with a push notification to the admin. Two total API calls per event — trivial for free/unlimited providers, well within API-Football's 100 req/day budget on a 4-match World Cup day (8 verification calls).

### Scope

Generic across all sports. The chain-walking mechanism naturally handles sports with fewer providers: sports with only one provider (GAA/Foireann, F1/OpenF1) produce zero verification attempts and auto-promote to `unverifiable` — correct behaviour since there is nothing to verify against. No sport-specific branching.

### Disagreement resolution

A disputed event triggers:
1. Push notification to the super admin with both scores
2. A chat system message visible to all competition members: "Score under review: [event name] — checking result"

The admin resolves via the existing `POST /api/admin/confirm-result` endpoint with the correct score, which rescores all predictions and posts a neutral follow-up: "Result confirmed: [team] [score]-[score] [team]". The override is recorded in `result_data` with admin ID and timestamp for audit.

### Sibling propagation

Sibling events (same fixture across competition instances) are scored immediately alongside the primary — they share the same fixture and would receive the same wrong score regardless of timing. One admin override on a disputed result fixes all instances.

### State storage

Verification state is stored in the existing `result_data` JSONB column on `events`:

```
verification_status: "pending" | "verified" | "disputed" | "unverifiable"
verification_provider: string | null
verification_attempts: number
verified_at: ISO timestamp | null
```

No migration required.

## Alternatives Considered

1. **Hold-until-verified (pessimistic model):** Don't score until two providers agree. Guarantees users never see a wrong score, but delays results by 5-10 minutes for every event — not just the rare disputes. The delay is invisible to match-watching users but creates a worse experience for users checking results after the fact. More critically, it couples the happy path (99.9% of events) to the availability of a second provider. If TheSportsDB is down for maintenance, every soccer result is delayed.

2. **Majority consensus (3+ providers):** Query all available providers and go with the majority. More robust in theory, but: burns through rate-limited API budgets (API-Football at 100/day), most sports have only 2 providers, and a 2-provider disagreement has no tiebreaker anyway. Overkill for the actual risk profile.

3. **Verification inside `fetchResult()`:** Make the existing fetch function internally query multiple providers and return a verified result. Rejected — `fetchResult()` is also used by the admin confirm-result endpoint and manual fetch API, which don't want verification overhead. Single responsibility: fetching is fetching, verifying is verifying.

## Consequences

- `autoResolveEvent()` in `src/lib/sports/auto-result.ts` gains a verification step after scoring. The early-exit for already-confirmed events must be refined: skip confirmed *and* verified events, but re-enter confirmed events with `verification_status: "pending"`.
- A new `compareResults()` pure function and `verifyResult()` orchestration function are added to `src/lib/sports/fetch-result.ts`.
- A new `notifyResultDisputed()` function targets the super admin with a push notification and posts a system message to competition chat.
- The admin confirm-result endpoint gains a force-rescore capability for dispute resolution.
- Sports with a single provider silently auto-promote with no user-visible difference from current behaviour.
- On a busy WC matchday (4 concurrent matches), verification adds 8 API calls — negligible overhead.
