# Provider Gap Analysis — Priority Ranking

Generated: 2026-05-20

## Methodology

Gap priority = `usage_frequency * provider_reliability_risk`

- **Usage frequency**: Event counts from production DB (competition + personal events)
- **Provider reliability risk**: From `docs/PROVIDER-AUDIT.md` — search/result failures, API key dependencies, single-provider sports

## Current Usage (Production DB)

| Sport | Competition Events | Personal Events | Total | Manual Rate |
|-------|-------------------|-----------------|-------|-------------|
| rugby | 1 | 15 | 16 | 0% |
| cricket | 0 | 8 | 8 | 0% |
| mlb | 0 | 7 | 7 | 0% |
| gaa | 4 | 1 | 5 | 0% |
| soccer | 1 | 2 | 3 | 0% |
| nba | 0 | 2 | 2 | 0% |
| formula_1 | 0 | 1 | 1 | 0% |

All events are currently API-linked (0% manual). However, this reflects early adoption — gaps will emerge as usage grows.

## Priority Gap Ranking

### P0 — High Usage + Provider Risk

| Sport | Risk | Detail |
|-------|------|--------|
| **GAA** | Key-gated, fallback=manual only | Foireann requires `FOIREANN_API_KEY`. If key unavailable, only fallback is manual entry. 5 events already, expected to grow significantly (core user base is Irish sports fans). |
| **Soccer** | Key-gated primary provider | API-Football (best for results) needs `API_FOOTBALL_KEY` (free tier: 4 req/hr cap). ESPN and TheSportsDB provide backup but less accurate for lower leagues (League of Ireland). |

### P1 — Medium Usage + Single Provider Risk

| Sport | Risk | Detail |
|-------|------|--------|
| **Cricket** | ESPN parsing fragile | ESPN works but cricket scoreboard format varies. TheSportsDB backup is reliable. 8 personal events shows active usage. |
| **Rugby** | Solid coverage | ESPN + TheSportsDB both work. 16 events (highest usage). Low risk. |
| **MLB** | ESPN-dependent for results | ESPN works, BallDontLie disabled without key. 7 events. |

### P2 — Low Usage + Known Failures

| Sport | Risk | Detail |
|-------|------|--------|
| **Tennis** | ESPN search FAILS | ESPN tennis search throws parsing error. TheSportsDB works as backup. No usage yet but likely when Wimbledon/US Open arrive. |
| **Golf** | ESPN search FAILS | Same issue — ESPN golf parsing error. TheSportsDB covers it. Will spike during majors. |
| **Horse Racing** | TheRacingAPI key-gated | Needs `THERACING_API_KEY`. No backup provider. Zero usage so far. |
| **Snooker** | ESPN 400 error | ESPN returns 400 for snooker. Manual-only effective. Low usage expected. |

### P3 — US Sports (Adequate Coverage)

| Sport | Risk | Detail |
|-------|------|--------|
| **NBA** | BallDontLie disabled, ESPN backup works | Low risk — ESPN covers it. |
| **NFL** | Same as NBA | Off-season. ESPN works. |
| **NHL** | Same as NBA | ESPN works. |

## Recommended Actions

1. **Fix ESPN tennis/golf parsing** — These are the only sports where the primary non-key provider fails. Fix the scoreboard parser for these sports to ensure coverage when majors arrive.
2. **Ensure Foireann API key is deployed** — GAA is a core sport for the user base. Verify the production env has `FOIREANN_API_KEY` set.
3. **Add API-Football key to production** — Free tier covers the usage volume. Improves League of Ireland and Champions League result accuracy.
4. **Monitor cricket result accuracy** — 8 events already. ESPN's cricket parsing should be validated against completed matches.
5. **Tennis/golf ESPN fix** — Investigate the parsing error in the ESPN provider's searchEvents for these sports.
