# Provider Score Shapes

What each sports data provider actually returns for normal FT, AET, and PEN results in soccer. Created after 12 commits over 6 days to fix AET scoring across 4 surfaces — each fix discovered a new provider edge case in production.

## Normalized Result Shape

All providers normalize into this shape (`src/lib/sports/types.ts:46-60`):

```typescript
{
  score: {
    home_team: string;
    away_team: string;
    home_score: number;    // aggregate (includes ET goals, never pen goals)
    away_score: number;
    periods: {
      halftime?: { home: number; away: number };
      full_time?: { home: number; away: number };   // 90-min score
      extra_time?: { home: number; away: number };   // ET-only goals
      penalties?: { home: number; away: number };    // shootout tally
    } | null;
  };
  winner: string | null;
  margin: number | null;
  is_final: boolean;
}
```

## TheSportsDB (primary soccer provider)

**Source:** `src/lib/sports/providers/thesportsdb.ts`

### Raw API fields

| Field | Meaning |
|-------|---------|
| `intHomeScore` / `intAwayScore` | Main score — always the **AET aggregate** (includes ET goals) |
| `intHomeScoreExtra` / `intAwayScoreExtra` | **Penalty shootout scores only** — never ET goals |
| `strStatus` | Match status string |

### Status values → finality

| strStatus | Meaning |
|-----------|---------|
| `"Match Finished"` or `"FT"` | Normal full time |
| `"AET"` | After extra time |
| `"AP"` or `"PEN"` | After penalties |

### Result shapes by scenario

**Normal FT:**
```
home_score = 2, away_score = 1
periods = null
```

**AET (e.g. Belgium 3-2 Senegal, FT was 2-2):**
```
home_score = 3, away_score = 2          ← AET aggregate, NOT 90-min score
periods = { extra_time: { home: 3, away: 2 } }  ← also aggregate (used as signal flag)
```
- `intHomeScoreExtra` = null (only populated for pens)
- **No FT breakdown available** — must be enriched from API-Football

**PEN (e.g. Australia 1-1 Egypt, pens 4-2):**
```
home_score = 1, away_score = 1          ← AET aggregate
periods = { penalties: { home: 4, away: 2 } }
```
- `intHomeScoreExtra = 4`, `intAwayScoreExtra = 2`

### Gotchas

1. `intHomeScore`/`intAwayScore` is ALWAYS the aggregate. For a 2-2 FT match that goes to 3-2 AET, the API returns `intHomeScore = 3`.
2. `intHomeScoreExtra` is penalty shootout ONLY — never ET goal breakdown.
3. **No `periods.full_time` from this provider.** The 90-min FT score must come from `enrichAETFullTimeScore()` which fetches from API-Football.
4. `periods.extra_time` stores the aggregate as a signal flag ("this match had ET"), not a precise ET-only goal count.

## ESPN

**Source:** `src/lib/sports/providers/espn.ts`

### Raw API fields

| Field | Meaning |
|-------|---------|
| `competitors[].score` | String score per competitor |
| `competitors[].homeAway` | `"home"` or `"away"` |
| `competitors[].winner` | Boolean — who advanced |
| `competitors[].linescores` | `Array<{ value: number }>` — per-period breakdown |
| `status.type.completed` | Boolean |
| `status.type.state` | `"pre"` / `"in"` / `"post"` |

### Finality

`status.type.completed === true` OR `status.type.state === "post"`. No distinction between FT/AET/PEN.

### Result shapes by scenario

**Normal FT:**
```
home_score = 2, away_score = 1
periods = null   (linescores has ≤ 2 entries)
```

**AET (linescores has > 2 entries):**
```
home_score = 3, away_score = 2          ← aggregate
periods = {
  full_time: { home: 2, away: 2 },     ← linescores[0] + linescores[1]
  extra_time: { home: 1, away: 0 }     ← sum(linescores[2..n])
}
```
- ESPN is the only provider that gives an explicit FT vs ET breakdown without enrichment.

**PEN:**
```
home_score = 1, away_score = 1          ← aggregate (no pen goals included)
periods = null                          ← NO penalty scores available
winner = "Australia"                    ← from competitors[].winner boolean
```

### Gotchas

1. **ESPN has NO penalty shootout scores.** Only `competitors[].winner` tells you who advanced.
2. ESPN returns `"LIVE"` for ALL in-progress matches — no distinction between regular time, ET, or penalties. Use elapsed wall-time for ET detection.
3. `status.type.description` is informational only, not used in logic.
4. FT breakdown is available via linescores — more reliable than TheSportsDB for AET matches.

## API-Football

**Source:** `src/lib/sports/providers/api-football.ts`

### Raw API fields

| Field | Meaning |
|-------|---------|
| `goals.home` / `goals.away` | Final aggregate (includes ET, not pens) |
| `score.halftime` | `{ home, away }` — halftime score |
| `score.fulltime` | `{ home, away }` — **90-minute FT score** |
| `score.extratime` | `{ home, away }` — **ET-only goals** |
| `score.penalty` | `{ home, away }` — **shootout scores** |
| `fixture.status.short` | `"FT"` / `"AET"` / `"PEN"` |

### Result shapes by scenario

**Normal FT:**
```
home_score = 2, away_score = 1
periods = {
  halftime: { home: 1, away: 0 },
  full_time: { home: 2, away: 1 }
}
```

**AET (e.g. FT 2-2, ET winner scores 1 more):**
```
home_score = 3, away_score = 2          ← aggregate
periods = {
  halftime: { home: 1, away: 1 },
  full_time: { home: 2, away: 2 },     ← 90-min score (always a draw in knockout)
  extra_time: { home: 1, away: 0 }     ← ET-only goals
}
```

**PEN (e.g. FT 1-1, ET 0-0, pens 4-2):**
```
home_score = 1, away_score = 1          ← aggregate (ET 0-0 so same as FT)
periods = {
  halftime: { home: 0, away: 1 },
  full_time: { home: 1, away: 1 },
  extra_time: { home: 0, away: 0 },
  penalties: { home: 4, away: 2 }
}
```

### Gotchas

1. **Richest provider** — explicit halftime, fulltime (90 min), extratime (ET-only), and penalty as separate objects.
2. `score.fulltime` is the 90-minute score, NOT the aggregate. This is the key field used by `enrichAETFullTimeScore()`.
3. `goals.home`/`goals.away` aggregate includes ET but NOT penalty shootout goals.
4. **Rate limited:** 100 req/day free tier, budgeted at 4/hour in code.

## Enrichment: enrichAETFullTimeScore()

**Source:** `src/lib/sports/fetch-result.ts:224-287`

When TheSportsDB returns an AET/PEN result (has `periods.extra_time` or `periods.penalties` but no `periods.full_time`), this function fetches the 90-minute FT score from API-Football and patches it in.

**Trigger:** `periods.extra_time || periods.penalties` exists AND `periods.full_time` is missing.

**Sanity check:** FT score must be a draw (ET only happens after a draw at 90 min).

**Why it exists:** exact_score predictions must be scored against the 90-minute score, not the AET aggregate. Without enrichment, a 2-2 FT match that goes to 3-2 AET would score against 3-2 instead of the correct 2-2.

## How Scoring Uses These Shapes

**Source:** `src/lib/scoring.ts`

### scoreExactScore — FT derivation priority (lines 776-809)

1. `periods.full_time` → use directly (from API-Football enrichment or ESPN)
2. `periods.extra_time` → subtract from aggregate: `ftHome = home_score - et.home`
3. `periods.penalties` only (no `extra_time`) → aggregate IS the FT score (straight to pens)
4. No periods → use `home_score`/`away_score` as-is

### scoreWinner — AET override

When `periods.extra_time` exists AND the match has 3+ options (1X2): forces actual result to `"draw"` because FT was definitionally a draw. The winner prediction is about the 90-minute result, not who advances.

For H2H (2 options only): AET override does NOT apply — H2H asks "who goes through."

### scoreMargin / scoreOverUnder / scoreHandicap

All use `home_score`/`away_score` (the aggregate) directly. No period awareness. For AET matches, these score against the AET aggregate, not the 90-min score.

## Provider Comparison Matrix

| Aspect | TheSportsDB | ESPN | API-Football |
|--------|-------------|------|--------------|
| FT score (90 min) | Not provided | `linescores[0]+[1]` | `score.fulltime` |
| ET goals (ET-only) | Not broken out | `linescores[2+]` | `score.extratime` |
| Penalty shootout | `intHomeScoreExtra` | Not available | `score.penalty` |
| Aggregate in home_score | Yes (incl. ET) | Yes (incl. ET) | Yes (incl. ET, not pens) |
| Status: FT | `"FT"` / `"Match Finished"` | `completed=true` | `"FT"` |
| Status: AET | `"AET"` | No specific status | `"AET"` |
| Status: PEN | `"AP"` / `"PEN"` | No specific status | `"PEN"` |
| Halftime | No | `linescores[0]` | `score.halftime` |
| Needs enrichment for FT? | **Yes** (always) | No | No |
