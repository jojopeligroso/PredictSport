# Audit: PredictSport World Cup 2026 Elimination Curve Solution

**Date:** 2026-05-20
**Auditor:** Claude (Opus 4.6)
**Document under review:** `predictsport-world-cup-2026-elimination-curve-solution.md`
**Cross-references:** SPEC.md S16, ADRs 0002-0009, existing tournament codebase

---

## 1. Verdict

**The design is mathematically sound. All 16 claimed curves are correct.** The core
formulas (2/3 group stage cut, generous halving, finalist bands) produce coherent,
fair elimination curves across the full 8-96 entrant range.

Several specification gaps and code mismatches must be resolved before a coding
agent can implement deterministically. These are catalogued below.

---

## 2. Product Architecture Context

The World Cup 2026 feature operates in two concurrent deployment modes sharing a
single Supabase database:

### 2.1 Main PredictSport Application (`predictsport_full`)

The existing PredictSport app at `predictsport-rust.vercel.app`. A **World Cup
tab** (`/wc/*`) is added to the main navigation. This tab is **time-gated** --
visible only from a configured date before the tournament through approximately
one month after the Final (roughly May 2026 through August 2026). Outside that
window, the `/wc` routes are hidden from navigation and may redirect to the main
app.

Users of the main app can access all PredictSport features (personal predictions,
group competitions, admin tools) as well as the World Cup prediction game. The
World Cup tab shares auth, user accounts, and the full navigation shell.

### 2.2 Standalone World Cup Shell (`world_cup_2026_shell`)

A **separate Vercel project** deployed from the same GitHub repo with
`NEXT_PUBLIC_PRODUCT_MODE=world_cup_2026_shell`. This deployment presents **only**
the World Cup prediction game -- no personal predictions, no group competitions,
no admin tools unrelated to the tournament.

- Middleware redirects all non-WC routes to `/wc` (already implemented in
  `src/middleware.ts`).
- The `/wc` layout provides its own branded navigation (Picks, Bracket, Table,
  Results, Rules).
- Shares the same Supabase instance, same `sporting_tournaments` seed data, same
  `competitions` rows, same `classifications` and `bracket_templates`.

### 2.3 Shared Database Implications

Because both deployments share one database:

- A user who joins a World Cup prediction game via the shell appears on the same
  leaderboard as a user who joins via the main app's `/wc` tab.
- Super Administrator actions (result confirmation, finalisation) are performed
  once and affect both deployments.
- The `product_mode` column on `competitions` is informational metadata, not an
  access-control boundary. Any authenticated user hitting the correct API route
  can interact with tournament data regardless of which deployment they use.
- RLS policies must not accidentally scope tournament data to one deployment.

### 2.4 Post-Tournament Archive (`world_cup_2026_archive`)

After the tournament, the shell switches to archive mode: static JSON export,
static Next.js pages, no live Supabase dependency. This is specified in ADR 0006
but not yet implemented.

---

## 3. Mathematical Verification

### 3.1 Curve Generation Algorithm

The document describes the algorithm in prose across S7, S11, S12. The following
pseudocode is the **unique deterministic algorithm** that produces all 16 claimed
curves. This should be added to the document:

```
function generateCurve(N):
  // Group Stage
  gs_survivors = ceil(N * 2 / 3)

  // Finalist band
  if N <= 55:  fpw_count = 2
  else if N <= 79: fpw_count = 3
  else: fpw_count = 4

  // Minimum survivors at each step (working backward from SF = fpw_count)
  // Each step must be strictly greater than the next to guarantee >= 1 elimination
  min_QF  = fpw_count + 1    // QF must be > SF (= fpw_count)
  min_R16 = fpw_count + 2    // R16 must be > QF
  min_R32 = fpw_count + 3    // R32 must be > R16

  // Forward pass with generous halving, clamped to minimums
  r32 = max(ceil(gs_survivors / 2), min_R32)
  r16 = max(ceil(r32 / 2), min_R16)
  qf  = max(ceil(r16 / 2), min_QF)

  // SF elimination always reduces to the band count (not halving)
  sf = fpw_count

  return [N, gs_survivors, r32, r16, qf, sf, 1]
```

**Verified computationally:** This pseudocode produces all 16 document curves
and generates valid strictly-decreasing curves for every integer 8-96.

Note: the document's "Entering Final Prediction Window" column corresponds to the
**After Semi-Finals** elimination point. The FPW itself (Third-Place Play-Off +
Final) has no elimination -- the surviving finalists predict both matches and the
winner is determined by stage-local points.

### 3.2 All 16 Curves Verified

Every curve in S13 and S14 was independently computed from the algorithm above.
All match.

### 3.3 Monotonicity

All curves are strictly decreasing at every step for all N in 8-96. Confirmed.

### 3.4 Minimum-One-Elimination

Every step eliminates at least one entrant for all N in 8-96. Confirmed.

---

## 4. Corrected Stage Mapping

The document's 7-step consequence table maps to the 9 sporting stages as follows.
This mapping was confirmed by the product owner during the audit.

| Consequence Column | Sporting Stage Trigger | Elimination? | Prediction Windows |
|---|---|---|---|
| Start | -- | -- | -- |
| After Group Stage | GM3 finalised | Yes (~1/3 cut) | PW1, PW2, PW3 |
| After Round of 32 | R32 finalised | Yes (halving) | PW4 |
| After Round of 16 | R16 finalised | Yes (halving) | PW5 |
| After Quarter-Finals | QF finalised | Yes (halving) | PW6 |
| Entering Final PW | **SF finalised** | Yes (last elim) | PW7 |
| Winner | Final finalised | No (winner declared) | PW8 |

**PW8 = Third-Place Play-Off + Final**, bundled as a single Prediction Window.
No elimination occurs within PW8. The 2-4 finalists all predict both matches.
The entrant with the most stage-local cumulative points across PW8 wins.

### 4.1 Prediction Window Count

The existing `create-world-cup-competition.ts` creates **9** prediction windows,
with Third-Place and Final as separate PWs (PW8 and PW9). This must be corrected
to **8** prediction windows, with PW8 covering both the Third-Place Play-Off and
the Final.

### 4.2 Group Matchday Elimination Timing

Group Matchday 1 (PW1) and Group Matchday 2 (PW2) do not trigger Format
Classification elimination. Elimination fires only after Group Matchday 3 (PW3)
finalisation, when group rankings are settled.

This does not violate S4.4 ("at least one entrant must be eliminated at every
finalised Sporting Stage wherever mathematically possible") because group rankings
are not settled until all matchdays are complete. The "wherever mathematically
possible" qualifier applies.

---

## 5. Critical Gaps

### 5.1 Curve Algorithm Not Stated Explicitly

**Severity:** Must-fix before implementation.

The document describes the algorithm across multiple sections (S7, S11, S12) using
prose and override conditions. A coding agent could interpret the overrides
differently for edge cases not covered by the 16 test cases.

**Recommendation:** Add the pseudocode from S3.1 of this audit (or equivalent)
to the document's S22 (Implementation Notes for Coding Agents).

### 5.2 Group Allocation Algorithm Not Specified

**Severity:** Must-fix before implementation.

The document gives principles (S8) and worked examples but no deterministic
algorithm for choosing between valid group allocations. For many entrant counts,
multiple allocations satisfy the constraints.

Examples of ambiguity:

- **12 entrants:** 3x4 (top-2 = 6, best-third = 2, total 8) and 4x3 (top-2 = 8,
  no thirds, total 8) both reach the target. Different fairness profiles.
- **74 entrants:** 16x4 + 2x5 is given, but 14x4 + 2x5 + 2x3 also works.

**Recommendation:** Define a deterministic allocation algorithm. Suggested approach:

```
function allocateGroups(N, target):
  // Start with all 4-player groups
  remainder = N mod 4
  if remainder == 0: groups = N/4 groups of 4
  if remainder == 1: (N/4 - 1) groups of 4 + 1 group of 5
  if remainder == 2: (N/4 - 1) groups of 4 + 2 groups of 3
  if remainder == 3: (N/4) groups of 4 + 1 group of 3

  // Verify target is reachable
  auto_qualifiers = (num_groups * 2) + num_5_player_groups
  best_third_available = num_4_player_groups
  max_survivors = auto_qualifiers + best_third_available

  if max_survivors < target: adjust (convert 3-groups to 5-groups)
  if best_third_needed < 0: adjust (convert 4-groups to 3-groups)
```

### 5.3 FPW Winner Determination Mechanism

**Severity:** Should-fix.

The document says "1 entrant will win" but doesn't specify how the winner is
selected from the 2-4 FPW finalists. Based on the audit discussion, the confirmed
mechanism is:

> The Final Prediction Window is scored as a single stage-local block covering the
> Third-Place Play-Off and the Final. Points are cumulative within PW8. The
> finalist with the most PW8 points wins. The standard tie-break hierarchy applies
> (total points, exact-score hits, correct-outcome hits, earlier aggregate
> submission timestamp, random fallback).

This should be added to the document.

### 5.4 Curve Immutability Timing

**Severity:** Should-fix.

The document says the curve is generated from "actual entrant count at launch"
(S4.1) and becomes immutable "once the first Prediction Window locks" (S4.2).
The interval between "launch" and "PW1 lock" may see late joiners.

**Recommendation:** Clarify: "The curve is calculated from the entrant count at
the moment PW1 locks. Late joiners before PW1 lock are included in the count.
After PW1 lock, the curve is immutable and late joiners are slotted into existing
groups via the smallest-group allocation rule. Their addition does not change the
survivor targets."

---

## 6. Code Mismatches

All items below are existing code that conflicts with the document and must be
updated during implementation.

### 6.1 Hard-Coded Preset Curves Are Wrong

**File:** `src/lib/tournament/create-world-cup-competition.ts:206-243`

The existing `getEliminationCurveForPreset()` contains hard-coded curves that
do not match the document:

| Preset | Existing code | Document |
|---:|---|---|
| 48 | 48 -> 24 -> 12 -> 6 -> 3 -> 2 | 48 -> 32 -> 16 -> 8 -> 4 -> 2 -> 1 |
| 64 | 64 -> 32 -> 16 -> 8 -> 4 -> 2 | 64 -> 43 -> 22 -> 11 -> 6 -> 3 -> 1 |
| 96 | 96 -> 48 -> 24 -> 12 -> 6 -> 3 | 96 -> 64 -> 32 -> 16 -> 8 -> 4 -> 1 |

**Action:** Replace the preset lookup table with the formula-based generator.
The function must accept any entrant count 8-96, not just presets.

### 6.2 Storage Structure Differs

**File:** `src/lib/tournament/format/elimination.ts:217-234`

Existing code reads curves as `Record<string, { target_survivors: number }>`
keyed by stage slug. The document proposes an ordered array of
`{ stage, remaining }` objects (S17.1).

**Action:** Align on one format. The array format from the document is
recommended because it preserves stage ordering and maps cleanly to the
consequence table UI. The `getEliminationCurve()` reader and all call sites
must be updated.

### 6.3 Best-Third Ranking Ignores Group Size

**File:** `src/lib/tournament/format/scoring.ts:130-178`

`computeBestThirdRanking()` collects ALL third-place finishers across all groups.
The document requires:

- Third from 5-player groups: auto-qualifies (excluded from best-third pool).
- Third from 3-player groups: never qualifies (excluded from pool).
- Only thirds from 4-player groups enter the best-third competition.

**Action:** Filter by group size before ranking. The group's `target_size` field
(already in `format_prediction_groups`) provides the group size.

### 6.4 Elimination Logic Assumes Uniform Groups

**File:** `src/lib/tournament/format/elimination.ts:118-200`

`eliminateFromFormat()` hard-codes "top 2 per group qualify" and puts all thirds
into the best-third pool. It does not handle:

- 5-player group auto-qualification of third place.
- 3-player group exclusion of third place.
- Variable best-third pool sizes.

**Action:** Rewrite the qualification logic to respect group size per S9 of the
document.

### 6.5 Prediction Window Count

**File:** `src/lib/tournament/create-world-cup-competition.ts:23-33`

Creates 9 prediction windows (Third-Place and Final as PW8 and PW9). Must be
8 prediction windows (Third-Place + Final bundled as PW8).

**Action:** Merge the last two entries in `PREDICTION_WINDOWS` into one.

### 6.6 Group Allocation Is Not Target-Aware

**File:** `src/lib/tournament/format/group-allocation.ts:9-82`

`allocatePredictionGroups()` chunks entrants into groups of 4 with overflow
handling. It does not consider the survivor target when choosing group sizes
(3, 4, or 5). It also does not handle 3-player or 5-player groups.

**Action:** Rewrite to implement target-aware allocation per S8 of the document.

---

## 7. Terminology Clarification

The document uses "Entering Final Prediction Window" as a consequence-table
column header. During the audit, this was confirmed to mean:

> The number of entrants surviving after Semi-Finals finalisation. These entrants
> enter the Final Prediction Window (PW8: Third-Place Play-Off + Final).

The term "Final Prediction Window" is potentially confusing because:

1. It is not a "window" in the prediction-window/round sense -- it IS a
   prediction window (PW8).
2. "Entering" implies a boundary, but the elimination happens at SF finalisation,
   not at PW8 entry.
3. Readers may confuse it with the Final match itself.

**Recommendation:** In the consequence table, rename the column to
"After Semi-Finals" for consistency with the other column names. In prose,
define "Final Prediction Window" once and refer back.

---

## 8. Edge Cases Not Covered

The following entrant counts are not in the worked examples or test cases.
They were generated by the verified pseudocode from S3.1 and should be added
as spot-check test cases during implementation:

| N | Expected Curve |
|---:|---|
| 10 | 10 -> 7 -> 5 -> 4 -> 3 -> 2 -> 1 |
| 11 | 11 -> 8 -> 5 -> 4 -> 3 -> 2 -> 1 |
| 15 | 15 -> 10 -> 5 -> 4 -> 3 -> 2 -> 1 |
| 33 | 33 -> 22 -> 11 -> 6 -> 3 -> 2 -> 1 |
| 50 | 50 -> 34 -> 17 -> 9 -> 5 -> 2 -> 1 |
| 55 | 55 -> 37 -> 19 -> 10 -> 5 -> 2 -> 1 |

The **55/56 band boundary** is notable: 55 entrants produce 2 finalists while
56 produce 3. At the QF stage both have 5 survivors, but the SF elimination
reduces to different targets (2 vs 3). The QF minimum constraint (`fpw + 1`)
guarantees that QF is always strictly greater than the SF/FPW count, so the
SF step always eliminates at least 1.

The full range 8-96 was verified programmatically: all 89 curves are strictly
monotonically decreasing with at least 1 eliminated at every step.

---

## 9. Summary of Required Actions

### Must-Fix Before Implementation

| # | Action | Document Section | Code Files |
|---|---|---|---|
| 1 | Add explicit curve generation pseudocode | S22 | -- |
| 2 | Define deterministic group allocation algorithm | S8, S22 | -- |
| 3 | Clarify "Entering FPW" = "After SF finalisation" | S5 | -- |
| 4 | Specify FPW winner determination mechanism | New section | -- |
| 5 | Replace preset-only curves with formula generator | -- | `create-world-cup-competition.ts` |
| 6 | Merge PW8/PW9 into single prediction window | -- | `create-world-cup-competition.ts` |
| 7 | Add group-size filtering to best-third ranking | -- | `format/scoring.ts` |
| 8 | Rewrite elimination logic for 3/4/5-player rules | -- | `format/elimination.ts` |
| 9 | Rewrite group allocation for target-awareness | -- | `format/group-allocation.ts` |
| 10 | Align curve storage format (array vs stage-keyed) | S17 | `format/elimination.ts` |

### Should-Fix

| # | Action | Section |
|---|---|---|
| 11 | Clarify curve immutability timing (launch vs PW1 lock) | S4.1, S4.2 |
| 12 | Rename "Entering FPW" column to "After Semi-Finals" | S5, S13 |
| 13 | Use consistent terminology ("protected" vs "automatic") | S9, S15 |
| 14 | Add spot-check test cases for boundary entrant counts | S21 |

---

## 10. Appendix: Corrected Pseudocode

This replaces the informal algorithm described across S7, S11, and S12 of the
document. It produces all 16 claimed curves and is the intended implementation
target.

```
function generateEliminationCurve(entrantCount):
  if entrantCount < 8 or entrantCount > 96:
    reject("Phase 1 supports 8-96 entrants")

  // Step 1: Group Stage survivor target
  gsTarget = ceil(entrantCount * 2 / 3)

  // Step 2: Finalist band
  if entrantCount <= 55:      fpw = 2
  else if entrantCount <= 79:  fpw = 3
  else:                        fpw = 4

  // Step 3: Minimum values (backward from SF = fpw)
  // Each step must be strictly greater than the next
  minQF  = fpw + 1    // QF must be > SF (= fpw)
  minR16 = fpw + 2    // R16 must be > QF
  minR32 = fpw + 3    // R32 must be > R16

  // Step 4: Forward pass — generous halving clamped to minimums
  r32 = max(ceil(gsTarget / 2), minR32)
  r16 = max(ceil(r32 / 2), minR16)
  qf  = max(ceil(r16 / 2), minQF)

  // Step 5: SF elimination always reduces to the band count
  sf = fpw

  // Step 6: Validate QF > SF (guaranteed by minQF = fpw + 1)
  assert qf > sf

  return {
    start: entrantCount,
    afterGroupStage: gsTarget,
    afterR32: r32,
    afterR16: r16,
    afterQF: qf,
    afterSF: sf,       // = "Entering Final Prediction Window"
    winner: 1
  }
```

### Verification against document's anchor cases

```
generateEliminationCurve(48):
  gsTarget = 32, fpw = 2
  minQF = 3, minR16 = 4, minR32 = 5
  r32 = max(16, 5) = 16
  r16 = max(8, 4) = 8
  qf  = max(4, 3) = 4
  sf  = 2
  => 48, 32, 16, 8, 4, 2, 1  CORRECT

generateEliminationCurve(96):
  gsTarget = 64, fpw = 4
  minQF = 5, minR16 = 6, minR32 = 7
  r32 = max(32, 7) = 32
  r16 = max(16, 6) = 16
  qf  = max(8, 5) = 8
  sf  = 4
  => 96, 64, 32, 16, 8, 4, 1  CORRECT

generateEliminationCurve(12):
  gsTarget = 8, fpw = 2
  minQF = 3, minR16 = 4, minR32 = 5
  r32 = max(4, 5) = 5       // override: halving too aggressive for small field
  r16 = max(3, 4) = 4       // override
  qf  = max(2, 3) = 3       // override
  sf  = 2
  => 12, 8, 5, 4, 3, 2, 1   CORRECT (minimum-steps override in action)
```

All 16 document curves verified. Full sweep of 8-96 verified programmatically.
