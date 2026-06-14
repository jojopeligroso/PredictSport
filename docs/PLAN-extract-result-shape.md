# PLAN — Extract `extractResultScore()` helper (PR 1 of 5)

**Date:** 2026-06-14
**Status:** Planned. Not started.
**Owner:** next session
**Risk:** Very low. Pure refactor. No visual change, no behaviour change.
**PR sequence position:** 1 of 5 in score-display consolidation. Ships independently.

---

## Why this exists

The nested score-shape trap (see `[[predictsport-result-data-shape]]`) bit us on 2026-06-14 because two places duplicate the same nested-vs-flat fallback chain — and one of them (the cron writer's mental model) was assumed to be the only place. Centralising the shape-normalisation into one helper eliminates the trap and makes the future `<ScoreDisplay>` primitive impossible to misuse.

## The duplication today

**Site A — server, results loader:** `src/app/wc/_landing/fetchFixturesResultsData.ts:73-76`
```ts
const data = row.result_data ?? {};
const score = (typeof data.score === "object" && data.score !== null ? data.score : {}) as Record<string, unknown>;
const homeScore = numOrNull(data.home_score ?? data.homeScore ?? score.home_score ?? score.homeScore ?? score.home);
const awayScore = numOrNull(data.away_score ?? data.awayScore ?? score.away_score ?? score.awayScore ?? score.away);
```

**Site B — client, rival tab:** `src/components/wc/RivalPredictionsTab.tsx:209-213`
```ts
const rd = (eventMeta?.resultData ?? selectedFixture?.resultData) as Record<string, unknown> | null;
const scoreNested = rd?.score as Record<string, unknown> | undefined;
const homeScore = rd ? numOrNull(scoreNested?.home_score ?? rd.home_score ?? rd.homeScore) : null;
const awayScore = rd ? numOrNull(scoreNested?.away_score ?? rd.away_score ?? rd.awayScore) : null;
```

**Drift between them:** Site A tolerates 5 fallback keys per side (`home_score`, `homeScore`, `score.home_score`, `score.homeScore`, `score.home`). Site B tolerates only 3 (`scoreNested.home_score`, `rd.home_score`, `rd.homeScore`). Live data hits at most 2 of those today, but the divergence is exactly the kind of thing that produces "works on results page, doesn't on rivals tab" bugs later.

## The fix

New file: `src/lib/sports/result-shape.ts`

```ts
// Pure helper. No imports beyond what numOrNull needs. Server-safe.

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Extract home/away score from an events.result_data blob.
 *
 * Tolerates THREE shapes that exist in production today:
 *   1. Nested  — { score: { home_score, away_score } }   ← ESPN, current canonical
 *   2. Flat snake_case — { home_score, away_score }       ← legacy/manual results
 *   3. Flat camelCase  — { homeScore, awayScore }         ← in-memory normalisations
 *
 * Returns nulls when the blob is missing or unparseable. Never throws.
 */
export function extractResultScore(
  resultData: Record<string, unknown> | null | undefined
): { home: number | null; away: number | null } {
  if (!resultData) return { home: null, away: null };

  const score =
    typeof resultData.score === "object" && resultData.score !== null
      ? (resultData.score as Record<string, unknown>)
      : {};

  return {
    home: numOrNull(
      resultData.home_score ??
      resultData.homeScore ??
      score.home_score ??
      score.homeScore ??
      score.home
    ),
    away: numOrNull(
      resultData.away_score ??
      resultData.awayScore ??
      score.away_score ??
      score.awayScore ??
      score.away
    ),
  };
}

/**
 * Extract winner from result_data. Always a string or null.
 * Cron writer puts winner at the root; no nested variant exists today.
 */
export function extractResultWinner(
  resultData: Record<string, unknown> | null | undefined
): string | null {
  if (!resultData) return null;
  return typeof resultData.winner === "string" && resultData.winner
    ? resultData.winner
    : null;
}
```

Then the two call sites collapse to:

**Site A — `fetchFixturesResultsData.ts:73-76` becomes:**
```ts
const { home: homeScore, away: awayScore } = extractResultScore(row.result_data);
const winner = extractResultWinner(row.result_data);
```

**Site B — `RivalPredictionsTab.tsx:209-213` becomes:**
```ts
const rd = (eventMeta?.resultData ?? selectedFixture?.resultData) as Record<string, unknown> | null;
const { home: homeScore, away: awayScore } = extractResultScore(rd);
const resultConfirmed = eventMeta?.resultConfirmed ?? selectedFixture?.resultConfirmed ?? false;
const hasResult = resultConfirmed && homeScore !== null;
```

## Blast radius — what could break

| Surface | Affected? | Why |
|---|---|---|
| Results tab (`/wc/results`) | Yes — re-renders, but output identical | Site A change |
| Rivals tab (`/wc/leaderboard?tab=rivals`) | Yes — re-renders, output identical | Site B change |
| Dashboard, Picks, Bracket, Chat | No | No call site there |
| Cron writer (`auto-result.ts`) | No | Writes only, doesn't read its own writes |
| Scoring engine (`src/lib/scoring.ts`) | No | Reads `Prediction.prediction_data`, not `events.result_data` |
| Admin confirm-result | No | Same — writes only |

**Score-coverage check before merge:** the helper accepts 5 fallback keys per side; Site B today accepts only 3. Run this SQL pre-merge to confirm no prod row has a shape Site B would silently drop:
```sql
SELECT id, jsonb_pretty(result_data)
FROM events
WHERE result_confirmed = true
  AND result_data IS NOT NULL
  AND result_data->>'home_score' IS NULL
  AND result_data->>'homeScore' IS NULL
  AND (result_data->'score'->>'home_score') IS NULL
LIMIT 20;
```
Expect zero rows. If rows come back, those events would have shown the WRONG score on rivals tab today — discovering them via this audit is itself a win.

## Touch list

1. **NEW** `src/lib/sports/result-shape.ts` (~50 lines, tested by hand).
2. `src/app/wc/_landing/fetchFixturesResultsData.ts:65-92` — replace the inline parsing with two helper calls.
3. `src/components/wc/RivalPredictionsTab.tsx:209-213` — same replacement.

## PR boundary

This is its own PR. Title: `Extract extractResultScore() helper to dedupe nested-score fallback chain`.

Do NOT bundle with the `<ScoreDisplay>` primitive (PR 2) — it adds risk and makes rollback harder if either piece has a bug.

## Verification

- [ ] Type-check passes (`npm run build`).
- [ ] Run the pre-merge SQL above — expect zero rows.
- [ ] Open `/wc/results` and `/wc/leaderboard?tab=rivals` against any past WC fixture with a confirmed result. Scores render identically to current.
- [ ] Inspect a fixture stored with each shape:
  - Nested (every ESPN-resolved fixture): `result_data.score.home_score`
  - Flat snake_case (manual results): `result_data.home_score`
  - Flat camelCase (any in-memory test fixture): `result_data.homeScore`
- [ ] No console errors in dev or prod build.

## Rollback

Single revert of the PR. No DB state involved. Helper file deletion is free.

## Follow-up unlocked by this PR

PR 2 (`<ScoreDisplay>` primitive) can now accept just `home` and `away` as `number | null`, never raw `result_data`. The leaky-abstraction concern flagged in the Software Architect review is gone once this PR ships.

---

**Related plans:** `[[PLAN-score-display-primitive]]`. **Related memory:** `[[predictsport-result-data-shape]]`.
