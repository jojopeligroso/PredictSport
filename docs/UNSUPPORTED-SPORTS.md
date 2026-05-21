# Unsupported Sports & Workarounds

Date: 2026-05-21

## Context

PredictSport supports 16 sport identifiers in `src/lib/sports/types.ts`. Some have full API coverage, some are effectively manual-only. This doc covers sports NOT yet in the type system and workarounds for sports with limited provider support.

## Sports Not in the Type System

These sports have been requested or are likely candidates. None have a `Sport` type entry or provider chain.

| Sport | Best Available API | Workaround | Notes |
|-------|-------------------|------------|-------|
| **Darts** | TheSportsDB (league 4618) | Use `snooker` type + manual | PDC events have fixtures on TheSportsDB |
| **Boxing / MMA** | TheSportsDB (Boxing: 4443, MMA: 4584) | Manual event creation | Event-driven, not league-scheduled |
| **Cycling** | None | Manual event creation | Tour de France/Giro stages could use manual winner predictions |
| **Swimming** | None | Manual event creation | Same pattern as athletics — individual events |
| **Motorsport (non-F1)** | TheSportsDB (MotoGP: 4415, NASCAR: 4402, IndyCar: 4614, WRC: 4441) | Use `formula_1` type + manual | Position-based results same as F1 |
| **Handball** | TheSportsDB (limited) | Use `soccer` type + manual | Team sport with home/away scores |
| **Australian Rules** | ESPN (AFL coverage), TheSportsDB (league 4416) | Use `rugby` type + manual | Score-based like rugby |
| **Volleyball** | TheSportsDB | Use `soccer` type + manual | Set-based scoring doesn't map well |
| **Esports** | TheSportsDB (limited), PandaScore (paid) | Manual event creation | Fragmented across games |
| **Winter Sports** | None | Manual event creation | Ski/biathlon/skating — Olympic years only |

## Workaround Pattern: "Borrow a Sport Type"

For sports without a type entry, create events manually using the closest existing sport type:

1. **Score-based team sports** (handball, volleyball, AFL) → use `soccer` or `rugby`
2. **Position-based individual sports** (cycling, motorsport) → use `formula_1`
3. **Head-to-head individual sports** (darts, boxing) → use `snooker` or `tennis`
4. **Individual timed/distance sports** (swimming) → use `athletics`

The sport type only affects:
- Provider chain selection (manual fallback always works)
- Score format display (periods structure in `ResultScore`)
- Default prediction type in the fixture browser

Prediction types (winner, H2H, top_n, etc.) work regardless of sport.

## Sports with Limited Provider Support

These are in the type system but have known gaps:

| Sport | Issue | Status | Workaround |
|-------|-------|--------|------------|
| **GAA** | Foireann API key not deployed | Pending key request | Manual event creation works |
| **Snooker** | ESPN returns 400 | api.snooker.org identified (pending header approval) | Manual event creation |
| **Horse Racing** | TheRacingAPI key not deployed | Pending signup | Manual event creation |
| **Athletics** | TheSportsDB has fixtures but no results | By design (see RESEARCH-ATHLETICS-APIS.md) | Manual result entry after events |
| **Tennis** | ESPN search parsing fails | Code fix needed in ESPN provider | TheSportsDB works as backup |
| **Golf** | ESPN search parsing fails | Code fix needed in ESPN provider | TheSportsDB works as backup |

## Adding a New Sport

To formally add a new sport (vs. borrowing a type):

1. Add identifier to `Sport` type in `src/lib/sports/types.ts`
2. Add provider chain in `src/lib/sports/registry.ts` (minimum: `[fixturePool, manual]`)
3. Optionally add to existing provider's `supportedSports` if it covers the sport
4. Add test case in `scripts/audit-providers.ts`

See `docs/PROVIDER-INTEGRATION-GUIDE.md` for the full process.

## Recommended Next Additions

Based on likelihood of user demand and API availability:

1. **Darts** — PDC has high Irish/UK interest; TheSportsDB covers it
2. **MotoGP** — TheSportsDB covers it; same result model as F1
3. **Boxing/MMA** — event-driven but popular for predictions
