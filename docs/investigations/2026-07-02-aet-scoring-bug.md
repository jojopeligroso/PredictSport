# AET Scoring Bug — Belgium vs Senegal (2026-07-02)

## Summary

Belgium vs Senegal (R32, 2026-07-01) went to **extra time** (`strStatus: "AET"`). TheSportsDB returned the AET aggregate score (3-2) in `intHomeScore`/`intAwayScore`. The system treated this as the FT (90-minute) result, causing:

- **Winner predictions scored against wrong result:** "Draw" pickers got 0 pts (should get 2), "Belgium" pickers got 2 pts (should get 0)
- **Exact score predictions scored against AET aggregate:** Nobody predicted 3-2, so no false positives, but draw-score predictions that might match the actual FT score got 0 instead of potentially 3

## Root Cause

TheSportsDB `intHomeScore`/`intAwayScore` for AET matches include extra-time goals. The provider (`thesportsdb.ts:normalizeEvent`) doesn't check `strStatus` and treats the aggregate as the definitive score. The knockout guard (`auto-result.ts:290-326`) only fires when the score IS a draw — for AET, the aggregate (3-2) isn't a draw, so the guard passes.

**Why penalties work but AET doesn't:** For AP/PEN matches, TSDB keeps `intHomeScore`/`intAwayScore` as the draw score and puts the shootout in `intHomeScoreExtra`/`intAwayScoreExtra`. The knockout guard sees the draw and waits for pen data. For AET, TSDB bakes ET goals into the main score fields.

## Affected Event

- Event ID: `cac7175d-8709-4c90-b92b-beff6c023273`
- TSDB ID: `2503392`
- Result: Belgium 3-2 Senegal AET (FT was a draw)
- Competition: `1a4448e5-a178-45ab-b819-a0dfab370306`

## Affected Predictions

### Winner = "Draw" (should be CORRECT, 2pts each)
Adrian Kilgallon, Damian Bohanna, Dimitri Saridakis, James Donohoe, Jason St Ledger, John Kirwan, Martin Manning, Niall Parker, Ricardo Galicia, Sustainable, + 6 cross-instance users

### Winner = "Belgium" (should be WRONG, 0pts each)
AnaIza Garcia, Brian English, Castleforbes College, Eoin Malone, Kevin Mcgrath, Tuisku Kumpulainen, + 7 cross-instance users

### H2H = Belgium → correctly scored (unchanged)
### H2H = Senegal → correctly scored (unchanged)
### Exact score → scored against AET aggregate (draw predictions voided in fix)

## Fix Applied

1. **TheSportsDB provider** — detect `strStatus === "AET"`, store `periods: { extra_time: { home, away } }`
2. **Scoring engine** — `scoreWinner()`: if `periods.extra_time` and 3+ options, FT was a draw
3. **Scoring engine** — `scoreExactScore()`: if `periods.extra_time`, void draw predictions (FT score unknown), keep non-draw as wrong
4. **Migration** — update result_data + re-score predictions

## Other R32 Matches (verified clean)

| Match | Score | Status | Handling |
|-------|-------|--------|----------|
| South Africa vs Canada | 0-1 | FT | Correct |
| Brazil vs Japan | 2-1 | FT | Correct |
| Germany vs Paraguay | 1-1 (pens 3-4) | AP | Correct |
| Netherlands vs Morocco | 1-1 (pens 2-3) | AP | Correct |
| Ivory Coast vs Norway | 1-2 | FT | Correct |
| France vs Sweden | 3-0 | FT | Correct |
| Mexico vs Ecuador | 2-0 | FT | Correct |
| **Belgium vs Senegal** | **3-2** | **AET** | **BUG — fixed** |
