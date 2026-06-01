# PredictSport World Cup 2026: Phase 1 Elimination Curve Solution

## 1. Purpose

This document defines the locked Phase 1 elimination-curve solution for the PredictSport FIFA World Cup 2026 Format Classification feature.

The feature belongs to the wider PredictSport application. It must operate as a reusable tournament-format logic layer inside a World Cup 2026 product shell, not as a forked World Cup-only rules engine.

The central design problem resolved here is how entrants are eliminated from Format Classification across the World Cup sporting stages while preserving fairness, competitive integrity, and social tension.

Phase 1 uses fixed milestone elimination curves generated from actual entrant counts at launch. Phase 2 may explore a more elegant proportional or dynamic model, but this document defines the Phase 1 solution only.

---

## 2. Executive Summary

The Phase 1 solution is:

1. Generate the elimination curve from the actual entrant count at launch.
2. Store the resolved curve as immutable template data once the first Prediction Window locks.
3. Reduce the field by approximately one third after the Group Stage.
4. Use generous halving after the Group Stage.
5. Require at least one entrant to be eliminated at every finalised Sporting Stage.
6. Use target-aware group allocation with groups of 3, 4, or 5 entrants.
7. Never allow fourth-place Group Stage qualification.
8. Never allow third place from a 3-player group to qualify.
9. Use fixed Final Prediction Window entrant bands:
   - 8-55 entrants: 2 finalists.
   - 56-79 entrants: 3 finalists.
   - 80-96 entrants: 4 finalists.
10. Show the complete consequence table before launch.

The clean anchor examples must naturally fall out of the formula. They are validation cases, not special exceptions.

For example:

| Entrants | Required curve |
|---:|---|
| 48 | 48 -> 32 -> 16 -> 8 -> 4 -> 2 -> 1 |
| 96 | 96 -> 64 -> 32 -> 16 -> 8 -> 4 -> 1 |

If the formula does not naturally generate those curves, the formula is defective.

---

## 3. Scope

### 3.1 In Scope

This document covers:

- Format Classification elimination curves.
- Group Stage survivor calculation.
- Target-aware group allocation.
- Best-third qualification rules.
- Later-stage survivor calculation.
- Final Prediction Window entrant bands.
- Consequence-table requirements.
- Storage and immutability expectations.
- Coding-agent test cases.

### 3.2 Out of Scope

This document does not define:

- Exact score scoring.
- Match outcome scoring.
- Overall Classification scoring.
- Bracket Classification scoring.
- Full database schema.
- Full UI implementation.
- Tie-break implementation details beyond where they affect qualification eligibility.
- Phase 2 proportional curve design.

---

## 4. Locked Product Principles

The following principles are locked for Phase 1.

### 4.1 Actual Entrant Counts

The system must generate curves from the actual entrant count at launch.

It must not silently pretend that a 41-player competition is a 48-player competition.

Clean presets such as 12, 24, 48, 64, and 96 are reference validation examples, not the only supported counts.

### 4.2 Immutable Resolved Curves

The resolved curve becomes immutable once the first Prediction Window locks.

This prevents disputes after users have seen the consequences and started making predictions.

### 4.3 Finalised-Only Elimination

Eliminations are based only on finalised authoritative standings.

No elimination is provisional.

Projected standings may be considered in a later phase, but they must be clearly labelled provisional and must not drive Phase 1 eliminations.

### 4.4 Elimination at Every Sporting Stage

At least one entrant must be eliminated at every finalised Sporting Stage wherever mathematically possible.

This prevents dead stages where standings finalise but nobody is removed.

### 4.5 Social Product Bias

PredictSport World Cup 2026 is a fun, social, banter-oriented competition.

The curve should therefore prefer generous rounding over aggressive pruning where both are defensible.

The goal is not mathematical neatness alone. The goal is an explainable and enjoyable elimination structure.

---

## 5. Sporting Stage Sequence

The Format Classification curve follows these consequence points:

| Step | Sporting Stage | Description |
|---:|---|---|
| 1 | Start | Entrants join the competition. |
| 2 | After Group Stage | First major elimination cut. |
| 3 | After Round of 32 | Later-stage reduction. |
| 4 | After Round of 16 | Later-stage reduction. |
| 5 | After Quarter-finals | Later-stage reduction. |
| 6 | Entering Final Prediction Window | Finalists remain. |
| 7 | After Final | Winner selected. |

The terminology mirrors the World Cup rhythm, but Format Classification is not a head-to-head bracket. Therefore, it does not need exact powers of two or exact real-world World Cup team counts after every stage.

---

## 6. Minimum and Maximum Entrant Counts

### 6.1 Minimum

The minimum supported Phase 1 field is:

```text
8 entrants
```

The 8-entrant curve is:

```text
8 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1
```

This is intentionally softened so that every later Sporting Stage can still eliminate at least one entrant.

### 6.2 Maximum

The Phase 1 working maximum is:

```text
96 entrants
```

The 96-entrant curve is:

```text
96 -> 64 -> 32 -> 16 -> 8 -> 4 -> 1
```

A larger future maximum may be explored in Phase 2, but Phase 1 must not produce more than 4 Final Prediction Window entrants.

---

## 7. Group Stage Formula

### 7.1 Survivor Target

The Group Stage survivor target is:

```text
ceiling(entrant_count * 2 / 3)
```

This means the Group Stage usually removes approximately one third of entrants.

Examples:

| Entrants | Formula | Target survivors |
|---:|---:|---:|
| 8 | ceiling(8 * 2 / 3) | 6 |
| 9 | ceiling(9 * 2 / 3) | 6 |
| 18 | ceiling(18 * 2 / 3) | 12 |
| 41 | ceiling(41 * 2 / 3) | 28 |
| 48 | ceiling(48 * 2 / 3) | 32 |
| 64 | ceiling(64 * 2 / 3) | 43 |
| 72 | ceiling(72 * 2 / 3) | 48 |
| 96 | ceiling(96 * 2 / 3) | 64 |

### 7.2 Adjustment Rule

The Group Stage target may be adjusted only where:

1. The target cannot be reached fairly under the group qualification rules.
2. A small field needs enough survivors to allow one elimination at every later Sporting Stage.
3. The adjustment avoids fourth-place qualification.
4. The adjustment avoids third-place qualification from a 3-player group.

The adjustment must be explainable in the pre-launch consequence table.

---

## 8. Group Allocation Rules

### 8.1 Valid Group Sizes

Format Prediction Groups may contain:

```text
3, 4, or 5 entrants
```

Four-player groups are preferred where fairness is not damaged.

Three-player and five-player groups are allowed where needed to handle awkward entrant counts or to reach the Group Stage survivor target fairly.

### 8.2 Target-Aware Allocation

Group allocation must be target-aware.

The system should not merely maximise the number of 4-player groups if doing so makes the intended survivor target unreachable or unfair.

The allocation logic should choose group distributions that:

1. Get closest to the Group Stage survivor target.
2. Minimise qualification-rate distortion between group sizes.
3. Preserve meaningful third-place jeopardy.
4. Prefer 4-player groups where fairness is not damaged.
5. Avoid fourth-place qualification entirely.
6. Avoid third-place qualification from 3-player groups entirely.

### 8.3 User-Testing Requirement

The group allocation and qualification model must be user-tested as a high-priority fairness and UX item.

Users must be able to understand why different group sizes and best-third rules apply.

---

## 9. Group Stage Qualification Rules

The locked qualification rules are:

```text
1. Top 2 from every group qualify.
2. Third place from each 5-player group qualifies automatically.
3. Additional best-third qualification may only come from 4-player groups.
4. Third place from a 3-player group never qualifies.
5. Fourth place never qualifies.
```

### 9.1 Why Third Place from 5-Player Groups Is Protected

A third-place finisher in a 5-player group has outperformed two entrants.

That is materially different from third place in a 3-player group, which is last place.

Therefore, third place in a 5-player group qualifies automatically.

### 9.2 Why Third Place from 3-Player Groups Cannot Qualify

A 3-player group already qualifies two entrants.

Allowing the third-place entrant to qualify would mean all entrants in that group survive.

That removes Group Stage jeopardy and creates a clear fairness problem.

### 9.3 Why Fourth Place Cannot Qualify

Fourth-place qualification is excluded for Phase 1.

This keeps the Group Stage intuitive and defensible.

If a curve target would require fourth-place qualification, the survivor target must be adjusted instead.

---

## 10. Best-Third Qualification Rule

Best-third qualification applies only to third-place finishers from 4-player groups.

The number of best-third qualifiers is determined by the gap between:

1. The Group Stage survivor target.
2. Automatic qualifiers.

Automatic qualifiers are:

```text
top_two_qualifiers + protected_third_place_qualifiers_from_5_player_groups
```

The remaining slots may be filled by best-third finishers from 4-player groups only.

### 10.1 Formula

```text
best_third_slots = group_stage_survivor_target - automatic_qualifiers
```

Where:

```text
automatic_qualifiers = (number_of_groups * 2) + number_of_5_player_groups
```

The system must then clamp best-third slots so that:

```text
0 <= best_third_slots <= number_of_4_player_groups
```

If the required number is outside that range, the allocation or survivor target must be reconsidered.

---

## 11. Later-Stage Formula

After the Group Stage, each Sporting Stage generally uses generous halving:

```text
ceiling(previous_survivor_count / 2)
```

This is applied after:

1. Round of 32.
2. Round of 16.
3. Quarter-finals.

The final transition into the Final Prediction Window is governed by the finalist-count band.

### 11.1 Override Conditions

Generous halving is overridden where necessary to:

1. Preserve at least one elimination at every remaining Sporting Stage.
2. Respect the Final Prediction Window entrant band.
3. Avoid a one-person Final Prediction Window.
4. Prevent more than 4 Phase 1 finalists.

---

## 12. Final Prediction Window Entrant Bands

The Final Prediction Window entrant count is fixed by launch entrant count.

| Launch entrants | Final Prediction Window entrants |
|---:|---:|
| 8-55 | 2 |
| 56-79 | 3 |
| 80-96 | 4 |

These bands are Phase 1 only.

Phase 2 may explore a more proportional model.

### 12.1 Band Override Rule

The Final Prediction Window band overrides generic generous halving at the final boundary.

Example:

```text
73 -> 49 -> 25 -> 13 -> 7 -> 3 -> 1
```

Raw generous halving from 7 would suggest 4, but 73 is in the 56-79 band, so it must enter the Final Prediction Window with 3 entrants.

---

## 13. Required Preset Consequence Table

| Entrants | Start | After Group Stage | After Round of 32 | After Round of 16 | After Quarter-finals | Entering Final Prediction Window | Winner |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 12 | 12 | 8 | 5 | 4 | 3 | 2 | 1 |
| 24 | 24 | 16 | 8 | 4 | 3 | 2 | 1 |
| 48 | 48 | 32 | 16 | 8 | 4 | 2 | 1 |
| 64 | 64 | 43 | 22 | 11 | 6 | 3 | 1 |
| 96 | 96 | 64 | 32 | 16 | 8 | 4 | 1 |

---

## 14. Additional Validation Examples

| Entrants | Curve |
|---:|---|
| 8 | 8 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1 |
| 9 | 9 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1 |
| 12 | 12 -> 8 -> 5 -> 4 -> 3 -> 2 -> 1 |
| 18 | 18 -> 12 -> 6 -> 4 -> 3 -> 2 -> 1 |
| 24 | 24 -> 16 -> 8 -> 4 -> 3 -> 2 -> 1 |
| 41 | 41 -> 28 -> 14 -> 7 -> 4 -> 2 -> 1 |
| 48 | 48 -> 32 -> 16 -> 8 -> 4 -> 2 -> 1 |
| 56 | 56 -> 38 -> 19 -> 10 -> 5 -> 3 -> 1 |
| 64 | 64 -> 43 -> 22 -> 11 -> 6 -> 3 -> 1 |
| 72 | 72 -> 48 -> 24 -> 12 -> 6 -> 3 -> 1 |
| 73 | 73 -> 49 -> 25 -> 13 -> 7 -> 3 -> 1 |
| 74 | 74 -> 50 -> 25 -> 13 -> 7 -> 3 -> 1 |
| 79 | 79 -> 53 -> 27 -> 14 -> 7 -> 3 -> 1 |
| 80 | 80 -> 54 -> 27 -> 14 -> 7 -> 4 -> 1 |
| 95 | 95 -> 64 -> 32 -> 16 -> 8 -> 4 -> 1 |
| 96 | 96 -> 64 -> 32 -> 16 -> 8 -> 4 -> 1 |

---

## 15. Worked Examples

### 15.1 Eight Entrants

```text
8 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1
```

Group allocation:

```text
2 groups of 4
```

Group Stage qualification:

```text
Top 2 from each group = 4
Best third from both 4-player groups = 2
Total survivors = 6
```

Rationale:

- The field is small.
- A one-third cut is still possible.
- Every later stage eliminates exactly one entrant.

### 15.2 Nine Entrants

```text
9 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1
```

Group allocation:

```text
3 groups of 3
```

Group Stage qualification:

```text
Top 2 from each group = 6
Third place from 3-player groups never qualifies
```

Rationale:

- Three groups of three is cleaner than one group of five and one group of four.
- No fourth-place qualification is needed.
- No third-place finisher from a 3-player group qualifies.

### 15.3 Eighteen Entrants

```text
18 -> 12 -> 6 -> 4 -> 3 -> 2 -> 1
```

Rationale:

- 18 * 2 / 3 = 12.
- The Group Stage can cleanly reduce the field to 12.
- Later stages are softened only where needed to preserve one elimination per stage and a 2-finalist ending.

### 15.4 Forty-One Entrants

```text
41 -> 28 -> 14 -> 7 -> 4 -> 2 -> 1
```

Likely group allocation:

```text
9 groups of 4
1 group of 5
```

Group Stage qualification:

```text
Top 2 from all 10 groups = 20
Protected third place from the 5-player group = 1
Best third-place qualifiers from 4-player groups = 7
Total survivors = 28
```

Rationale:

- 28 is ceiling(41 * 2 / 3).
- The cut removes 13 entrants.
- Third-place finishers retain jeopardy because not all third-place finishers from 4-player groups qualify.
- Later stages produce a social and intuitive curve: 28, 14, 7, 4, 2.

### 15.5 Seventy-Two Entrants

```text
72 -> 48 -> 24 -> 12 -> 6 -> 3 -> 1
```

Group allocation:

```text
18 groups of 4
```

Group Stage qualification:

```text
Top 2 from each group = 36
Best third-place qualifiers = 12 of 18
Total survivors = 48
```

Rationale:

- 72 is one of the cleanest non-preset counts.
- The Group Stage removes exactly one third.
- Later stages halve cleanly until the 3-finalist boundary.

### 15.6 Seventy-Three Entrants

```text
73 -> 49 -> 25 -> 13 -> 7 -> 3 -> 1
```

Rationale:

- 73 is in the 56-79 entrant band.
- Therefore, it must produce 3 Final Prediction Window entrants.
- The curve remains generous and avoids an arbitrary jump to 4 finalists.

### 15.7 Seventy-Four Entrants

```text
74 -> 50 -> 25 -> 13 -> 7 -> 3 -> 1
```

Likely group allocation:

```text
16 groups of 4
2 groups of 5
```

Group Stage qualification:

```text
Top 2 from all 18 groups = 36
Protected third place from both 5-player groups = 2
Best third-place qualifiers from 4-player groups = 12 of 16
Total survivors = 50
```

Rationale:

- 50 is ceiling(74 * 2 / 3).
- The cut removes 24 entrants.
- The 3-finalist band keeps 72, 73, and 74 aligned in product shape.

### 15.8 Ninety-Six Entrants

```text
96 -> 64 -> 32 -> 16 -> 8 -> 4 -> 1
```

Group allocation:

```text
24 groups of 4
```

Group Stage qualification:

```text
Top 2 from each group = 48
Best third-place qualifiers = 16 of 24
Total survivors = 64
```

Rationale:

- This perfectly mirrors double the real World Cup team count at each stage.
- It is the cleanest large Phase 1 curve.
- It validates the formula rather than requiring a special exception.

---

## 16. UI Consequence Table Requirements

Before launch, the UI must show the resolved consequence table.

At minimum, the table must include:

1. Launch entrant count.
2. Group allocation.
3. Number of groups by size.
4. Group Stage survivor count.
5. Best-third qualification rule.
6. Entrants remaining after each Sporting Stage.
7. Final Prediction Window entrant count.
8. Confirmation that the curve becomes immutable once the first Prediction Window locks.

### 16.1 Example UI Copy

```text
This competition starts with 41 entrants.

After the Group Stage, 28 entrants will remain.
After the Round of 32, 14 entrants will remain.
After the Round of 16, 7 entrants will remain.
After the Quarter-finals, 4 entrants will remain.
2 entrants will enter the Final Prediction Window.
1 entrant will win the Format Classification.

This consequence table will lock once the first Prediction Window locks.
```

---

## 17. Storage Requirements

The system should store the resolved curve as launch-time template data.

The stored data should include:

1. Launch entrant count.
2. Group allocation.
3. Qualification rules applied.
4. Survivor counts per Sporting Stage.
5. Final Prediction Window entrant count.
6. Lock timestamp or status.
7. Version or template identifier.
8. Denormalised explanation data for UI display.

The system should not rely on recalculating the curve after lock.

### 17.1 Suggested Storage Shape

This is illustrative only and not a full schema requirement.

```json
{
  "entrantCount": 41,
  "locked": true,
  "groupAllocation": {
    "groupsOf3": 0,
    "groupsOf4": 9,
    "groupsOf5": 1
  },
  "qualificationRules": {
    "topTwoFromEveryGroup": true,
    "thirdFromFivePlayerGroupsQualifies": true,
    "bestThirdFromFourPlayerGroupsOnly": true,
    "thirdFromThreePlayerGroupsQualifies": false,
    "fourthPlaceQualifies": false
  },
  "curve": [
    { "stage": "start", "remaining": 41 },
    { "stage": "after_group_stage", "remaining": 28 },
    { "stage": "after_round_of_32", "remaining": 14 },
    { "stage": "after_round_of_16", "remaining": 7 },
    { "stage": "after_quarter_finals", "remaining": 4 },
    { "stage": "entering_final_prediction_window", "remaining": 2 },
    { "stage": "after_final", "remaining": 1 }
  ]
}
```

---

## 18. Finalisation and Snapshot Requirements

Authoritative standings and eliminations are triggered by:

1. Super Administrator finalisation.
2. Fallback auto-finalisation.

Both paths must produce the same authoritative elimination output.

Standing snapshots must be immutable denormalised JSON records written at finalisation points.

The elimination curve should reference the snapshot outcome, not mutable live standings.

---

## 19. Risk Register

| Risk | Description | Mitigation |
|---|---|---|
| User confusion | Users may not understand why group sizes differ. | Show group allocation and consequence table before launch. |
| Fairness challenge | Entrants in different group sizes may perceive unequal difficulty. | Use target-aware allocation and user-test the explanation. |
| Over-complexity | The generation logic may become too dynamic for Phase 1. | Generate once at launch and store immutable resolved data. |
| Late-stage cliff | Finalist bands may override generous halving. | Make Final Prediction Window entrant count visible before launch. |
| Edge-count errors | Counts like 9, 41, 73, 74, and 80 may expose flaws. | Add explicit test cases. |

---

## 20. Spec-Ready Language

For Phase 1, Format Classification elimination curves are generated from the actual entrant count at launch and stored as immutable resolved template data once the first Prediction Window locks.

The Group Stage survivor target is ceiling(entrant_count * 2 / 3). Group allocation is target-aware and may use groups of 3, 4, or 5 entrants. The system must prefer fair qualification-rate distribution over purely maximising 4-player groups.

Top two entrants from every group qualify. Third place from a 5-player group qualifies automatically. Additional best-third qualification may only come from 4-player groups. Third place from a 3-player group never qualifies. Fourth place never qualifies.

After the Group Stage, each Sporting Stage targets ceiling(previous_survivor_count / 2), subject to preserving at least one elimination at every remaining stage and respecting the required Final Prediction Window entrant count.

Final Prediction Window entrant counts are banded for Phase 1: 8-55 entrants produce 2 finalists; 56-79 entrants produce 3 finalists; 80-96 entrants produce 4 finalists.

The Final Prediction Window entrant band overrides generic halving at the final boundary. No Phase 1 curve may produce more than 4 Final Prediction Window entrants.

The UI must show the resolved consequence table before launch, including group allocation, Group Stage survivor count, survivors after each Sporting Stage, and the number of entrants entering the Final Prediction Window.

---

## 21. Coding-Agent Test Cases

The coding agent must implement tests for the following cases.

### 21.1 Curve Output Tests

```text
1. 8 entrants resolves to 8 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1.
2. 9 entrants uses three groups of three and resolves to 9 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1.
3. 12 entrants resolves to 12 -> 8 -> 5 -> 4 -> 3 -> 2 -> 1.
4. 18 entrants resolves to 18 -> 12 -> 6 -> 4 -> 3 -> 2 -> 1.
5. 24 entrants resolves to 24 -> 16 -> 8 -> 4 -> 3 -> 2 -> 1.
6. 41 entrants resolves to 41 -> 28 -> 14 -> 7 -> 4 -> 2 -> 1.
7. 48 entrants resolves to 48 -> 32 -> 16 -> 8 -> 4 -> 2 -> 1.
8. 56 entrants resolves to 56 -> 38 -> 19 -> 10 -> 5 -> 3 -> 1.
9. 64 entrants resolves to 64 -> 43 -> 22 -> 11 -> 6 -> 3 -> 1.
10. 72 entrants resolves to 72 -> 48 -> 24 -> 12 -> 6 -> 3 -> 1.
11. 73 entrants resolves to 73 -> 49 -> 25 -> 13 -> 7 -> 3 -> 1.
12. 74 entrants resolves to 74 -> 50 -> 25 -> 13 -> 7 -> 3 -> 1.
13. 79 entrants resolves to 79 -> 53 -> 27 -> 14 -> 7 -> 3 -> 1.
14. 80 entrants resolves to 80 -> 54 -> 27 -> 14 -> 7 -> 4 -> 1.
15. 95 entrants resolves to 95 -> 64 -> 32 -> 16 -> 8 -> 4 -> 1.
16. 96 entrants resolves to 96 -> 64 -> 32 -> 16 -> 8 -> 4 -> 1.
```

### 21.2 Qualification Constraint Tests

```text
1. No generated curve allows fourth-place Group Stage qualification.
2. No generated curve allows third place from a 3-player group to qualify.
3. Third place from a 5-player group qualifies automatically.
4. Additional best-third qualifiers come only from 4-player groups.
5. Every group has exactly 3, 4, or 5 entrants.
6. Group allocation is target-aware and can justify deviation from maximising 4-player groups.
```

### 21.3 Lifecycle Tests

```text
1. Every finalised Sporting Stage eliminates at least one entrant.
2. The resolved curve becomes immutable once the first Prediction Window locks.
3. The UI displays the full consequence table before launch.
4. Super Administrator finalisation triggers authoritative standings and eliminations.
5. Fallback auto-finalisation triggers the same authoritative elimination output.
6. Standing snapshots are immutable denormalised JSON records.
7. Eliminations are never provisional.
```

---

## 22. Confirmed Design Decisions (from Audit)

The following decisions were confirmed during the 2026-05-20 audit session and
are now locked. See `docs/AUDIT-elimination-curve-solution.md` for full rationale.

### 22.1 Stage Mapping

The "Entering Final Prediction Window" consequence column corresponds to the
**After Semi-Finals** elimination point. The 7-step consequence table maps to
the 9 sporting stages as follows:

| Consequence Column | Sporting Stage Trigger | Elimination? | Prediction Windows |
|---|---|---|---|
| Start | -- | -- | -- |
| After Group Stage | GM3 finalised | Yes (~1/3 cut) | PW1, PW2, PW3 |
| After Round of 32 | R32 finalised | Yes | PW4 |
| After Round of 16 | R16 finalised | Yes | PW5 |
| After Quarter-Finals | QF finalised | Yes | PW6 |
| Entering Final PW | **SF finalised** | Yes (last elimination) | PW7 |
| Winner | Final finalised | No (winner declared) | PW8 |

**PW8 = Third-Place Play-Off + Final**, bundled as a single Prediction Window.
This means there are **8 Prediction Windows**, not 9.

GM1 (PW1) and GM2 (PW2) finalisations do not trigger elimination. Elimination
fires only after GM3 (PW3) when group rankings are settled.

### 22.2 FPW Winner Determination

The Final Prediction Window (PW8) is scored as a single stage-local block
covering the Third-Place Play-Off and the Final. Points are cumulative within
PW8. The finalist with the most PW8 points wins the Format Classification.

The standard tie-break hierarchy applies: total points, exact-score hits,
correct-outcome hits, earlier aggregate submission timestamp, random fallback.

No elimination occurs within PW8. The 2-4 finalists all predict both matches.

### 22.3 Curve Immutability Timing

The curve is calculated from the entrant count at the moment PW1 locks.

Late joiners before PW1 lock are included in the count. After PW1 lock, the
curve is immutable and late joiners are slotted into the smallest existing group
via the smallest-group allocation rule. Their addition does not change the
survivor targets.

Admin may also choose to disallow late joining entirely when configuring the
competition. This is a per-competition setting, not a global rule.

### 22.4 Group Allocation Algorithm

When multiple group configurations can reach the survivor target, use this
deterministic algorithm:

```text
1. Start with max 4-player groups:
   remainder = N mod 4
   if remainder == 0: all groups of 4
   if remainder == 1: convert one 4-group to a 5-group
   if remainder == 2: convert two 4-groups to two 3-groups
   if remainder == 3: add one 3-group

2. Compute reachable survivors:
   auto_qualifiers = (num_groups * 2) + num_5_player_groups
   best_third_available = num_4_player_groups
   max_reachable = auto_qualifiers + best_third_available

3. If max_reachable < target:
   Convert 3-player groups to 5-player groups until target is reachable.

4. If surplus (more best-thirds than needed):
   Prefer fewer 5-player groups and more 4-player groups.

5. Validate:
   best_third_needed = target - auto_qualifiers
   0 <= best_third_needed <= num_4_player_groups
```

---

## 23. Curve Generation Pseudocode

This is the deterministic algorithm that produces all claimed curves. Verified
computationally against all 16 test cases and the full range 8-96.

```text
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

  // Step 4: Forward pass -- generous halving clamped to minimums
  r32 = max(ceil(gsTarget / 2), minR32)
  r16 = max(ceil(r32 / 2), minR16)
  qf  = max(ceil(r16 / 2), minQF)

  // Step 5: SF elimination always reduces to the band count
  sf = fpw

  return [entrantCount, gsTarget, r32, r16, qf, sf, 1]
```

---

## 24. Implementation Notes for Coding Agents

Do not hard-code only the listed examples.

The listed examples are validation cases for the generic Phase 1 rules.

The implementation should separate:

1. Entrant-count validation.
2. Group allocation resolution (see S22.4).
3. Group Stage survivor target calculation.
4. Best-third slot calculation.
5. Later-stage survivor calculation (see S23).
6. Finalist-band enforcement.
7. Immutable template storage.
8. UI consequence-table generation.

Avoid speculative Phase 2 abstractions.

Build the simplest deterministic Phase 1 generator that satisfies the locked rules and test cases.

---

## 25. Final Locked Summary

The Phase 1 elimination-curve solution is:

```text
Actual entrant count at launch
-> target-aware Group Stage allocation
-> Group Stage survivor target = ceiling(entrants * 2 / 3)
-> generous later-stage halving = ceiling(previous / 2)
-> finalist band override
-> immutable resolved consequence table
-> finalised-only authoritative eliminations
```

The design prioritises fairness, explainability, and fun.

It avoids bracket rigidity because Format Classification is not a head-to-head knockout bracket.

It preserves World Cup rhythm without requiring exact World Cup team counts at every stage.

It is ready to insert into the main PredictSport World Cup 2026 specification.
