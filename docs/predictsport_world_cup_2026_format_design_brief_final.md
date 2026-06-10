# PredictSport FIFA World Cup 2026 Format Design Brief

## Coding Agent Prompt

You are working in the `jojopeligroso/PredictSport` codebase. Your task is to update the project documentation and prepare an implementation plan for the FIFA World Cup 2026 tournament-format feature. Do not start implementation until you have read and reconciled the existing project rules and the locked decisions below.

Read order:

1. `CLAUDE.md` or the current project rules file. Project rules override all other instructions.
2. `todos.md` to understand current phase, status codes, and pending work.
3. `SPEC.md` for current feature requirements and acceptance criteria.
4. `context.md`, ADRs, and any domain-language documents.
5. Git history and existing files before adding new functionality. Grep the repo and inspect commit history to confirm whether the relevant work already exists.

Core implementation constraint:

The World Cup 2026 shell is not a forked rules engine. It is a product shell over reusable PredictSport tournament-format logic. World Cup-specific behaviour belongs in the tournament blueprint (scoring rules, classification definitions, bracket shape, fixture catalogue), adapter logic, product mode configuration, and seeded schedule data. Do not create one-off tables such as `world_cup_2026_predictions`, `world_cup_2026_leaderboards`, or `world_cup_2026_groups`. The tournament blueprint can be instantiated into multiple concurrent competition instances.

Locked for Phase 1:

- The feature targets FIFA World Cup 2026.
- The product supports four concurrent Classifications inside each World Cup competition instance:
  - Overall Classification.
  - Format Classification.
  - Full Bracket Survivor.
  - Knockout Bracket Survivor.
- Classifications are first-class backend entities scoped to a competition instance.
- Entrant status must be tracked per Classification, not globally.
- Classifications are instantiated from the tournament blueprint when a competition instance is created. Each instance stores immutable configuration snapshots. The same blueprint can produce multiple independent instances.
- The minimum Classification schema is accepted:
  - `classifications`.
  - `classification_memberships`.
  - `classification_standings_snapshots`.
  - `classification_events`.
- Standing snapshots are immutable denormalised JSON records written at finalisation points.
- Overall and Format Classification use the same Phase 1 match scoring model:
  - 2 points for correct match outcome: home win, draw, or away win.
  - 3 additional points for exact score.
  - No approximate-score points.
  - In knockout fixtures, 1 additional point may be awarded for correctly predicting the advancing team.
- Bracket Survivor logic is progression-only. Exact scores do not matter.
- Both bracket modes must use one reusable Bracket Prediction Engine.
- FIFA-specific bracket logic must live in the World Cup 2026 template adapter, not in the generic bracket UI or persistence model.
- Bracket predictions use versioned JSON snapshots in Phase 1.
- Prediction Windows map to the current app's Round concept for Phase 1.
- Each Prediction Window locks before its first Fixture starts.
- Preferred lock offset is 1 minute before first Fixture. Fallback lock offset is 5 minutes if database or operational safety requires it.
- Multiple future Prediction Windows may be open for Pick submission at the same time.
- A World Cup competition instance closes to new Entrants after Prediction Window 1 is finalised, not merely after it locks.
- Provisional results must be user-visible.
- Authoritative scoring, advancement, standings, and eliminations occur only after Super Administrator finalisation or fallback auto-finalisation.
- If a completed Prediction Window or Sporting Stage has not been finalised, the system auto-finalises it 15 minutes before the next dependent Prediction Window locks, provided all required fixture results are present.
- If required results are missing at fallback time, do not finalise, do not eliminate, keep next-window Pick submission open, and escalate urgently to the Super Administrator.
- Fixture result confirmation (blueprint-level, shared across all instances), result correction, official result finalisation, official blueprint changes, and official archive export are Super Administrator actions, not Competition Admin actions.
- Phase 1 entrant presets include 12, 24, 48, 64, and 96.
- Exact elimination curves are deliberately deferred to a separate design session.
- The selected preset and curve become immutable once the first Prediction Window locks.
- The UI must show the consequence table for the selected preset before launch.

Deferred:

- Exact Format Classification elimination curves for 12, 24, 48, 64, and 96 Entrants.
- Exact awkward-count behaviour and curve thresholds between 2, 3, and 4 Final Prediction Window Entrants.
- Any proportional elimination curve. This is Phase 2 exploration.
- Full manual curve editor. This is not Phase 1.
- Live/projection leaderboards as authoritative objects. Phase 1 may display provisional values only if labelled clearly.
- Per-Fixture locking. Phase 1 uses Prediction Window-level locking.
- User-generated activity feed, comments, reactions, direct messaging, and media upload.
- Goalscorer, player, squad, and player-stat prediction features.

Must clarify before implementation:

1. Standalone Knockout Prediction surface.
   - The desired product behaviour is a separate public entry surface and leaderboard after the official Round of 32 is known.
   - It must not duplicate canonical World Cup fixtures, results, finalisation jobs, bracket templates, or bracket logic.
   - The build model must decide whether this is represented as a separate competition instance (instantiated from the same tournament blueprint), a separate Classification, an entry cohort, a view over shared bracket submissions, or another abstraction.
   - The implementation must avoid duplicated predictions where the same user enters the same canonical knockout bracket through both the main World Cup game and the standalone knockout surface.

2. Classification schema details.
   - Finalise exact columns, indexes, RLS policies, server-side checks, status values, JSON config boundaries, and migration order.

3. Best-third rounding for non-standard Format Prediction Group counts.
   - The principle is top two-thirds of third-place finishers.
   - The exact rounding rule for awkward group counts remains to be defined.

4. UI map.
   - Produce the detailed screen map for Overall, Format Classification, Full Bracket Survivor, Knockout Bracket Survivor, Results, Super Admin, Competition Admin, Archive, and the standalone knockout surface.

5. Official schedule source.
   - Store World Cup schedule as a fixture catalogue in the tournament blueprint. Fixtures are shared across all competition instances — they are not duplicated per instance.
   - Verify against official FIFA sources during build.
   - Do not hard-code schedule dates into generic logic.

Acceptance criteria for the documentation update:

- The updated docs must explicitly supersede the old three-Classification model with the four-Classification model.
- The updated docs must explicitly supersede any old final-stage rule that required exactly two Format Classification finalists in all cases.
- The updated docs must explicitly record that 96 finishes with 4 Final Prediction Window Entrants, 64 finishes with 3, 48 finishes with 2, and fewer than 48 finishes with 2 or fewer, subject to final curve design.
- The updated docs must mark exact elimination curves as deferred, not accidentally implied.
- The updated docs must preserve the existing Product Shell principle.
- The updated docs must preserve reusable schema design and avoid World Cup-only tables.
- The updated docs must flag the standalone knockout surface as a pre-implementation clarification.
- The updated docs must include a `todos.md` update plan but should not mark implementation tasks as done until the code and docs are actually committed.

---

## Status

This document updates and supersedes the earlier combined markdown brief.

Canonical coverage now includes:

- Decisions 1-66 from the earlier combined design brief.
- Decisions 67-80 from the later design interrogation.
- Corrections on Classification count, finalist-count logic, result authority, snapshot persistence, and knockout-only entry surfaces.

This document is still a feature specification and design brief. It is not yet an implementation plan, migration file, or final task breakdown.

The major unresolved design item is the exact Format Classification elimination curve.

---

## Purpose

This document captures the current shared understanding for Phase 1 of the PredictSport FIFA World Cup 2026 feature.

The feature should support a special tournament-format Prediction Game that can run inside the existing PredictSport application and also as a simplified World Cup 2026 Product Shell.

The World Cup shell is not a forked rules engine. It is a branded Product Shell over shared PredictSport tournament-format logic.

---

## Core Phase 1 Scope

Phase 1 is limited to FIFA World Cup 2026.

The goal is to build a full prediction UI and UX that mimics the real Sporting Tournament structure:

- Group Stage.
- Round of 32.
- Round of 16.
- Quarter-finals.
- Semi-finals.
- Final.
- Third-place play-off.

Phase 1 must not include:

- Goalscorer prediction.
- Squad databases.
- Player-level data.
- Player-stat prediction.
- All-Ireland or GAA backdoor modelling.
- General-purpose tournament-builder UI.

---

## Product Principle

The FIFA World Cup 2026 shell must use reusable PredictSport tournament-format logic.

World Cup specificity belongs in:

- Tournament blueprint data (fixture catalogue, classification definitions, scoring rules, bracket shape).
- Product mode configuration.
- World Cup 2026 adapter logic.
- Seeded official schedule data.
- Branded shell copy and routing.

World Cup specificity must not be hard-coded into:

- Generic bracket engine.
- Generic Classification persistence.
- Generic leaderboard calculations.
- Generic result finalisation jobs.
- Generic Prediction Window locking logic.

Good examples:

```txt
sporting_tournament.slug = "fifa-world-cup-2026"
template_key = "fifa_world_cup_2026"
product_mode = "world_cup_2026_shell"
```

Avoid one-off schema such as:

```txt
world_cup_2026_predictions
world_cup_2026_leaderboards
world_cup_2026_groups
```

---

## Terminology Contract

The following terminology must be used to avoid ambiguity between the app-level game and the real-world tournament.

| Term | Meaning |
|---|---|
| Prediction Game | The app-level game Entrants join. |
| Sporting Tournament | The real-world event being predicted, e.g. FIFA World Cup 2026. |
| Sporting Stage | A real tournament stage, e.g. Group Stage, Round of 32, Final. |
| Prediction Window | A lockable batch of Fixtures Entrants predict before a lock time. |
| Round | Existing app concept. In Phase 1, a Prediction Window maps to a Round. |
| Classification | A concurrent scoring or survival path inside one Prediction Game. |
| Entrant | An authenticated human participant making scored Picks. |
| Fixture | A real sporting match. |
| Pick | An Entrant's match prediction. |
| Prediction Group | A mini-table of Entrants in the Format Classification. |
| Product Shell | A simplified branded deployment over shared core logic. |
| Super Administrator | App-level operator with official template/result/finalisation authority. |
| Competition Admin | User who manages a Prediction Game shell, invites, copy, and settings. |

Existing database table names do not need to be renamed in Phase 1. The spec maps the new domain language onto the current schema where appropriate.

---

## Roles and Authority

### Super Administrator

The Super Administrator is the app-level operator.

Only Super Administrators may:

- Maintain the official FIFA World Cup 2026 template.
- Import or fetch provisional official results.
- Confirm daily official results.
- Finalise Prediction Windows and Sporting Stages.
- Trigger official eliminations.
- Correct confirmed or finalised results.
- Publish official standalone knockout surfaces.
- Export official archives.

### Competition Admin

A Competition Admin is a user-level administrator for a Prediction Game.

Competition Admins may:

- Create or configure a private Prediction Game from the World Cup template.
- Configure invite settings.
- Configure presentation copy where allowed.
- Select an approved entrant preset before launch.
- Configure allowed settings before the first lock.
- View and manage their own competition surface.

Competition Admins must not be able to:

- Confirm official World Cup results.
- Finalise official Sporting Stages.
- Correct official results.
- Alter official fixtures.
- Alter the canonical World Cup bracket.
- Trigger official eliminations outside their permitted scope.

---

## Authentication

Scored participation requires authentication in Phase 1.

| User action | Authentication required? |
|---|---:|
| View landing page | No |
| View public rules | No |
| View public leaderboard | No |
| Join a Prediction Game | Yes |
| Submit Picks | Yes |
| Appear on scored leaderboard | Yes |
| Follow rivals | Yes |

Supported authentication methods:

- Google OAuth.
- Email magic link.

Excluded from Phase 1:

- Anonymous scored play.
- Claim-entry-later flow.
- Unauthenticated Pick submission.

---

## Prediction Game Entry Rules

A World Cup competition instance remains joinable beyond the first Prediction Window lock.

Reason:

- Group Stage is split into three Prediction Windows, corresponding to group matchday cycles.
- Entrants may miss Matchday 1 but still participate in later Group Stage Prediction Windows.

Rules:

- Entrants may join a World Cup competition instance until Prediction Window 1 is finalised.
- The instance closes to all new Entrants after Prediction Window 1 finalisation.
- Prediction Window 1 means the first Group Stage cycle in which every team has played its first group fixture.
- Entrants joining after Prediction Window 1 locks receive zero points for missed Fixtures.
- Entrants joining before Prediction Window 1 finalisation may still participate in future open Prediction Windows.
- No new Entrants may join the instance after Prediction Window 1 finalisation.

This supersedes any earlier interpretation that allowed joining until the final Group Stage Prediction Window locks.

---

## Four Concurrent Classifications

Each World Cup 2026 competition instance contains four concurrent Classifications (as defined by the tournament blueprint).

| Classification | Purpose | Eliminates Entrants? | Scoring Basis |
|---|---|---:|---|
| Overall Classification | General leaderboard across the whole tournament. | No | Cumulative match points. |
| Format Classification | Tournament-style survival format for Entrants. | Yes | Stage-local match points and elimination. |
| Full Bracket Survivor | Full pre-tournament bracket prediction from groups onward. | Yes, within bracket status only | Progression correctness. |
| Knockout Bracket Survivor | Bracket prediction after official Round of 32 is known. | Yes, within bracket status only | Progression correctness. |

Classification principles:

- Classifications are first-class backend entities scoped to a Prediction Game.
- Each Classification owns its own membership, scoring strategy, survival state, standing snapshots, elimination history, and archive record.
- Classification status must not be inferred from global competition membership.
- Entrant status is tracked per Classification, not globally.
- An Entrant can remain active in Overall while eliminated from Format Classification and dead in one or both Bracket Survivor Classifications.

---

## First-Class Classification Backend Model

The following minimum schema is accepted for Phase 1:

```txt
classifications
classification_memberships
classification_standings_snapshots
classification_events
```

### `classifications`

Purpose:

- One row per Classification inside a Prediction Game.
- Examples: Overall, Format Classification, Full Bracket Survivor, Knockout Bracket Survivor.
- Owns scoring strategy, elimination strategy, and config snapshot.

Indicative fields:

```txt
id
competition_id
classification_key
classification_type
name
status
scoring_strategy
elimination_strategy
config jsonb
source_template_key nullable
created_at
updated_at
```

### `classification_memberships`

Purpose:

- One row per Entrant per Classification.
- Tracks active, eliminated, dead, winner, withdrawn, and related status values.
- Stores elimination reason and elimination stage/window.

Indicative fields:

```txt
id
classification_id
competition_id
user_id
status
entered_at
eliminated_at nullable
eliminated_window_id nullable
eliminated_stage_id nullable
elimination_reason nullable
metadata jsonb
created_at
updated_at
```

### `classification_standings_snapshots`

Purpose:

- Immutable finalised leaderboard snapshot per Classification per Prediction Window or Sporting Stage.
- Used for archive, audit, recovery, and recalculation comparison.

Indicative fields:

```txt
id
classification_id
competition_id
prediction_window_id nullable
sporting_stage_id nullable
finalisation_id
snapshot_type
standings_data jsonb
entrant_count
generated_at
generated_by nullable
generation_method
checksum nullable
```

Snapshot type values:

```txt
window
stage
final
correction
```

Generation method values:

```txt
manual
automatic
correction
```

`standings_data` should include denormalised rows similar to:

```json
[
  {
    "rank": 1,
    "user_id": "...",
    "display_name": "...",
    "points": 42,
    "status": "active",
    "tie_break_values": {},
    "movement": null,
    "eliminated": false,
    "metadata": {}
  }
]
```

### `classification_events`

Purpose:

- Maps which Events or Prediction Windows count towards each Classification.
- Prevents hard-coding that every Event counts for every leaderboard.

Indicative fields:

```txt
id
classification_id
competition_id
prediction_window_id nullable
event_id nullable
sporting_stage_id nullable
counts_for_scoring boolean
counts_for_elimination boolean
metadata jsonb
created_at
updated_at
```

Do not create subtype-specific tables for every Classification unless implementation proves they are necessary. Store subtype-specific settings in `classifications.config` for Phase 1.

---

## Classification Template Cloning

Classifications are scoped to a competition instance. Each is instantiated from the tournament blueprint when the instance is created.

Rules:

- Each Classification belongs to one Prediction Game.
- A Classification is instantiated from the tournament blueprint when a competition instance is created. The same blueprint can produce multiple independent instances.
- Once created, it stores its own immutable configuration snapshot.
- Later template changes must not silently alter existing competitions.
- Running competitions must not be mutated by template updates unless a Super Administrator explicitly runs a migration or correction workflow.

This is required for commercial trust, archive integrity, and reproducible scoring.

---

## Overall Classification

The Overall Classification is the cumulative leaderboard.

Rules:

- All Entrants remain eligible throughout the Sporting Tournament.
- Eliminated Format Classification Entrants continue making Picks for Overall.
- Entrants with dead brackets continue making Picks for Overall.
- Missing a Prediction Window gives zero points for missed Fixtures but does not remove the Entrant.
- Phase 1 uses flat scoring across all Sporting Stages.
- Phase 2 may add optional Escalating Points mode.

Phase 1 scoring:

| Pick Type | Points |
|---|---:|
| Correct match outcome | 2 |
| Exact score bonus | 3 |
| Correct advancing team in knockout Fixture | 1 |
| Max per Group Stage Fixture | 5 |
| Max per Knockout Fixture | 6 |

Outcome means home win, draw, or away win.

In knockout fixtures:

- Outcome still means match outcome after normal or applicable official result rules, as represented by the app.
- Advancing team is scored separately.
- A team progressing on penalties counts as the advancing team.
- Exact score remains exact score only.
- There are no approximate-score points.

---

## Format Classification

The Format Classification is the tournament-style survival competition.

Rules:

- It is Phase 1's leaderboard-elimination format.
- It does not include head-to-head Entrant Fixtures in Phase 1.
- Entrants are placed into Prediction Groups.
- Prediction Groups are mini-leaderboards, not head-to-head groups.
- Prediction Groups should target 4 Entrants wherever possible.
- Groups of 3 or 5 Entrants are allowed only as fallback cases for awkward entrant counts.
- The allocation algorithm should avoid 3-Entrant and 5-Entrant groups where a clean 4-Entrant distribution is possible.
- Groups of 6 should not occur in normal Phase 1 World Cup public shells.
- Top two Entrants from each Prediction Group qualify automatically where group-stage qualification is used.
- Best third-placed Entrants qualify where needed.
- A dedicated third-place qualification table must be shown.
- Points reset to zero at the start of each Sporting Stage.
- Eliminations happen only at the end of a Sporting Stage, not after every Prediction Window.
- Eliminated Entrants remain active in the Overall Classification.

Phase 1 Format Classification scoring uses the same match scoring model as Overall:

| Pick Type | Points |
|---|---:|
| Correct match outcome | 2 |
| Exact score bonus | 3 |
| Correct advancing team in knockout Fixture | 1 |
| Max per Group Stage Fixture | 5 |
| Max per Knockout Fixture | 6 |

Format Classification points are stage-local for elimination purposes.

---

## Format Prediction Group Allocation

Default Prediction Group allocation uses a random draw.

Rules:

- Prediction Groups are not assigned immediately upon Entrant registration.
- Prediction Group allocation occurs only after registration closes.
- Admins may regenerate the draw before the first Prediction Window locks.
- After the first Prediction Window locks, Prediction Groups are immutable.
- No group rebalancing occurs after the draw is completed.
- Inactive Entrants simply score zero and are eliminated naturally.
- Voluntary withdrawals do not cause rebalancing or replacement.

Private or friend-group competitions:

- The Competition Admin selects registration close time and draw time.
- The draw may occur as a social event before the first Prediction Window locks.

Public competitions:

- Prediction Groups are generated automatically when registration closes.
- No manual intervention is required.

Late Entrant placement before the instance closes:

- If late entry into a Format Classification is allowed before Prediction Window 1 finalisation, a late Entrant is inserted into the smallest existing Prediction Group.
- If multiple groups share the smallest size, the destination group is selected randomly among those groups.
- No group rebalancing occurs.

---

## Best Third-Place Qualification

Within Format Classification groups, best-third qualification means the top two-thirds of third-place finishers advance, using the relevant finalised group standings and tie-break rules.

Example World Cup-style case:

- 12 Prediction Groups.
- Top two from each group qualify automatically.
- 8 of the 12 third-placed Entrants qualify.
- 32 Entrants advance to the next Sporting Stage.

Locked principle:

```txt
best_third_qualifiers = top two-thirds of third-place finishers
```

Unresolved detail:

- Exact rounding rule for non-standard group counts.

This must be resolved before implementation for awkward group counts.

---

## Format Classification Tie-Break Resolution

Format Classification standings use deterministic tie-break rules.

Phase 1 tie-break hierarchy:

1. Total Format Classification points.
2. Total exact-score hits.
3. Total correct-outcome hits.
4. Earlier aggregate Pick-submission timestamp.
5. Random fallback draw.

Definitions:

- Exact-score hit: Entrant predicted the exact final score correctly.
- Correct-outcome hit: Entrant predicted the correct win/draw/loss outcome.

Operational rules:

- Tie-break calculations use only data available at the time standings are computed.
- Tie-break rules apply to Prediction Group standings, best-third qualification ranking, knockout advancement qualification, elimination resolution, and final placement ordering where required.
- Tie-break ordering is globally fixed in Phase 1.
- Competition Admins cannot customise tie-break hierarchies in Phase 1.
- Sport-specific tie-break systems are not supported in Phase 1.
- Random fallback should be extremely rare.
- UI must expose the exact tie-break reason whenever rankings differ between tied Entrants.
- Historical standings must preserve tie-break outcomes permanently for audit consistency.

---

## Format Classification Elimination Curve

Exact elimination curves are deliberately deferred to a separate design session.

Locked Phase 1 principles:

- Phase 1 accepts fixed milestone curves.
- Phase 2 should explore a more elegant proportional curve.
- The curve should not be overfitted to strict 50 percent cuts.
- 50 percent elimination is a useful tension heuristic, not a law.
- Curves must be stored as configurable blueprint data, not hard-coded as a single mathematical formula. The curve is generated per instance from its actual entrant count at PW1 lock.
- The UI must show the consequences of the selected preset before launch.
- The selected preset and curve become immutable once the first Prediction Window locks.

Approved Phase 1 entrant presets:

| Preset | Status |
|---:|---|
| 12 | Included |
| 24 | Included |
| 48 | Included |
| 64 | Included |
| 96 | Included |

Final Prediction Window Entrant count is a consequence of the selected elimination curve, not a separate independent setting.

Locked finalist-count constraints:

| Entrant count | Final Prediction Window Entrants |
|---:|---:|
| 96 | 4 |
| 64 | 3 |
| 48 | 2 |
| Fewer than 48 | 2 or fewer |

No Phase 1 preset may send more than 4 Entrants into the Final Prediction Window.

Important unresolved curve question:

```txt
At what entrant counts does a 3-finalist curve become too severe, and at what point does a 4-finalist curve become justified?
```

This is directly connected to the final elimination curve and must be resolved in the dedicated elimination-curve session.

This section supersedes earlier language that required every Format Classification to end with exactly two surviving Final Stage Entrants.

---

## Bracket Prediction Engine

The Bracket Prediction Engine must be reusable across the wider app.

Rules:

- Build a generic Bracket Prediction Engine.
- World Cup 2026 is the first template adapter.
- FIFA-specific best-third logic must not be baked into the generic bracket component.
- Future use cases may include 8, 16, 24, 32, 48, or 64-team brackets.
- The generic engine stores bracket predictions, lock state, advancement picks, scoring hooks, and validation results.
- The World Cup 2026 adapter defines groups, best-third logic, Round of 32 mapping, third-place play-off toggle, and official bracket allocation.
- The UI wizard renders steps based on the tournament blueprint.
- The visual bracket is a display and review layer.
- The scoring layer reads submitted bracket state against official results.

---

## Full Bracket Survivor

Full Bracket Survivor is a separate Classification inside each World Cup competition instance.

Entrant action before tournament kick-off:

1. Rank each World Cup group from first to fourth.
2. Select the eight best third-placed qualifiers.
3. Let the World Cup 2026 adapter generate the Round of 32 bracket slots.
4. Pick winners through each knockout round.
5. Pick the champion.
6. Pick third place only if the third-place play-off is enabled.
7. Review full visual bracket.
8. Confirm submission.

Rules:

- Full bracket is editable until the tournament-level bracket lock time.
- Bracket lock time should come from the fixture catalogue's first fixture start time.
- After lock, the bracket becomes immutable.
- No exact scores are required.
- Correctness is progression-based.
- Penalty shootouts, scoreline, and method of victory do not matter.
- A team is correct if it advances in the predicted slot/path.
- Correctness is slot-sensitive.
- A team reaching the same Sporting Stage through the wrong side of the bracket is not equivalent.

UI treatment:

- Users whose Full Bracket Survivor entry is still live get a heavy outline around their name on public and private leaderboards.
- If the bracket dies, the outline is removed.
- The Entrant remains active in other Classifications.

---

## Knockout Bracket Survivor Inside Main Game

Knockout Bracket Survivor is a separate Classification inside each World Cup competition instance.

It differs from Full Bracket Survivor:

| Classification | User predicts from | Bracket basis |
|---|---|---|
| Full Bracket Survivor | Before tournament starts | User-predicted group outcomes |
| Knockout Bracket Survivor | After Group Stage finalisation | Official Round of 32 bracket |

Rules:

- It opens only after the Group Stage has been finalised.
- It opens only after the official Round of 32 entrants and bracket slots have been generated.
- It locks before the first Round of 32 fixture.
- It is open to all Entrants in the competition instance.
- Eligibility is not dependent on survival in Full Bracket Survivor, Format Classification, or Overall standing.
- An Entrant eliminated from Full Bracket Survivor or Format Classification may still enter Knockout Bracket Survivor.
- It uses the same reusable Bracket Prediction Engine.
- It must not use a separate duplicate bracket engine.

---

## Standalone Knockout Prediction Surface

There is also a desired standalone knockout-only public entry surface after the final 32 teams are official.

This is not fully resolved for implementation and must be clarified with the build model.

Confirmed product intent:

- Once the official Round of 32 is known, a separate public knockout-only entry surface can become available.
- Users who did not join a World Cup competition instance may join this knockout-only surface.
- Users who join only this knockout-only surface must not appear on the default global World Cup leaderboard.
- They must not appear in the main instance's Overall Classification, Format Classification, Full Bracket Survivor, or main-game Knockout Bracket Survivor.
- They appear only on the leaderboard and archive for that knockout-only surface.

Critical implementation warning:

- This must not duplicate canonical World Cup fixtures.
- This must not duplicate official results.
- This must not duplicate finalisation jobs.
- This must not duplicate bracket templates.
- This must not duplicate bracket logic.
- The system should avoid duplicating identical bracket predictions where the same user participates through both the main instance and the knockout-only surface.

Clarification required before implementation:

```txt
The standalone Knockout Prediction surface is intended to be a separate public entry surface and leaderboard, but it must not duplicate canonical World Cup fixtures, results, finalisation jobs, or bracket logic. The build model must clarify whether this is represented as a separate Competition, a separate Classification, a separate entry cohort, a leaderboard filter, or another abstraction that avoids duplicated predictions while preserving separate leaderboard visibility.
```

Default availability:

- The surface may be pre-created as a hidden competition instance from the blueprint.
- It becomes publicly available only after the Group Stage is finalised.
- It requires official Round of 32 entrants and bracket slots to be generated.
- It requires Super Administrator publication.
- Working preset availability date: 2026-06-28.
- Hard gate: `group_stage_finalised_at` must exist.
- Lock time: before the first Round of 32 fixture using the standard Prediction Window lock offset.

Date alone is not sufficient. A delayed result or correction must block publication even if the calendar says the knockout phase has started.

---

## Bracket Prediction Storage

Phase 1 stores bracket predictions as versioned JSON snapshots.

Accepted model:

```txt
bracket_prediction_submissions
- id
- competition_id
- classification_id
- bracket_template_id
- user_id
- version_number
- status: draft | submitted | locked | superseded
- bracket_data jsonb
- submitted_at
- locked_at
- created_at
- updated_at
```

Snapshot must include:

- Predicted group rankings.
- Predicted best third-place qualifiers.
- Generated Round of 32 bracket.
- Knockout progression picks.
- Champion pick.
- Third-place pick if enabled.
- Version history.
- Lock state.

Core rule:

- Until lock, each save creates or updates the Entrant's current draft/submitted bracket.
- At lock, the latest valid submitted bracket becomes immutable.
- Previous versions are retained for audit and recovery.
- Future normalisation is deferred unless reporting or scoring demands it.

---

## World Cup Third-Place Handling

The 2026 World Cup has 12 groups of four teams.

Advancement structure:

- Top two teams from each group qualify automatically.
- The eight best third-placed teams also qualify.
- 32 teams advance to the knockout stage.

App implication:

- The app should not ask users to manually place third-placed teams into Round of 32 slots.
- Users rank groups and choose/select predicted best third-place qualifiers.
- The World Cup 2026 adapter derives the predicted third-place group-letter combination.
- The adapter uses the official allocation matrix to generate Round of 32 bracket slots.

Implementation warning:

- The hard part is not merely identifying the best third-place qualifiers.
- The hard part is assigning them to Round of 32 slots based on which group letters produce qualifiers.
- This must be implemented and tested in the World Cup 2026 adapter.

Minimum test scenarios:

| Scenario | Expected result |
|---|---|
| User predicts correct 32 qualifiers | Bracket remains live after Group Stage. |
| User predicts wrong third-place qualifier | Bracket Survivor status becomes dead. |
| User predicts correct teams but wrong group positions | Bracket likely dies if bracket path changes. |
| User predicts correct knockout winner | Bracket remains live. |
| User predicts a team eliminated in real match | Bracket becomes dead. |
| Match decided on penalties | Progressing team is what matters. |

---

## Prediction Windows

A Sporting Stage may contain multiple Prediction Windows.

For Phase 1 implementation, a Prediction Window maps to the existing app's Round concept.

Rules:

- Each Prediction Window locks before the first Fixture in that Prediction Window.
- Preferred default lock offset is 1 minute before the first Fixture starts.
- Fallback lock offset is 5 minutes before the first Fixture starts if database or operational safety requires it.
- All Fixtures inside a Prediction Window lock when that Prediction Window locks.
- Individual Fixture-level locking is not supported in Phase 1.
- Pick edits are disabled once the Prediction Window locks.
- Pick audit/version history should preserve pre-lock edits where supported.
- Multiple future Prediction Windows may be open for Pick submission at the same time.
- Each Prediction Window closes independently when its own lock time is reached.

Group Stage default windows:

1. Group Matchday 1.
2. Group Matchday 2.
3. Group Matchday 3.

Group Stage behaviour:

- Entrants may submit all Group Stage Picks early if they wish.
- Once Matchday 1 starts, only the Matchday 1 Prediction Window is locked.
- Later Group Stage Prediction Windows remain editable until their own locks.
- Eliminations still happen only after all three Group Stage Prediction Windows are complete and finalised.

Knockout Sporting Stages use one Prediction Window per Sporting Stage by default:

| Sporting Stage | Prediction Windows | Elimination Timing |
|---|---:|---|
| Group Stage | 3 | After Group Matchday 3 finalisation. |
| Round of 32 | 1 | After Round of 32 finalisation. |
| Round of 16 | 1 | After Round of 16 finalisation. |
| Quarter-finals | 1 | After Quarter-final finalisation. |
| Semi-finals | 1 | After Semi-final finalisation. |
| Final Stage | 1 | After Final Stage finalisation. |

The Final Stage Prediction Window contains the final and, if enabled, the third-place play-off.

---

## Shared Picks

Entrants submit one shared set of match Picks per Prediction Window.

Those Picks feed:

- Overall Classification as cumulative points.
- Format Classification as stage-local points while the Entrant is still alive.

Full Bracket Survivor and Knockout Bracket Survivor do not use live match Picks. They use locked bracket submissions.

---

## Third-Place Play-off

Third-place play-off inclusion is configurable before launch.

Default split:

| Classification | Default |
|---|---|
| Overall Classification | Included. |
| Format Classification | Included in the Final Stage Prediction Window. |
| Full Bracket Survivor | Included only as a separate third-place pick if enabled. |
| Knockout Bracket Survivor | Included only as a separate third-place pick if enabled. |

Including the third-place play-off must not affect champion survival depth in either Bracket Survivor Classification.

---

## Result Handling and Finalisation

Result handling is competition-configurable.

World Cup 2026 should default to Super Administrator finalisation.

Result source model:

| Source | Phase 1 role |
|---|---|
| API fetch | Convenience/provisional source. |
| Manual entry | Required fallback. |
| Super Administrator confirmation | Authoritative finalisation mechanism. |
| Silent editing after finalisation | Not allowed. |
| Audited correction | Allowed only as rare emergency workflow. |

Two-step confirmation model:

1. Fixture result confirmation.
   - Super Administrator confirms an individual match result is correct.
2. Prediction Window or Sporting Stage finalisation.
   - Super Administrator confirms the full result set is complete.
   - Scoring, standings, advancement, snapshots, and eliminations become authoritative.

Provisional visibility:

- Provisional results must be user-visible.
- Provisional Pick correctness may be visible if clearly labelled provisional.
- Provisional points may be visible if clearly labelled provisional.
- Authoritative standings update only after finalisation.
- Eliminations are never provisional.

Fallback auto-finalisation:

- If the Super Administrator has not finalised a completed Prediction Window or Sporting Stage, the system auto-finalises it 15 minutes before the next dependent Prediction Window locks.
- Auto-finalisation is allowed only if all required fixture results are present.
- The audit trail must record whether finalisation was manual or automatic.

Missing-result edge case:

- If required results are missing at fallback time, do not finalise.
- Do not eliminate.
- Keep next-window Pick submission open.
- Trigger urgent Super Administrator escalation.
- Later apply authoritative standings and eligibility once missing results are confirmed and finalised.

---

## Result Correction Workflow

Confirmed and finalised results are treated as final.

Corrections are allowed only through an audited emergency workflow.

Rules:

- Provisional results are editable.
- Fixture-confirmed results require a correction reason.
- Stage/window-finalised results require emergency correction flow.
- Archived competitions are locked by default.
- Silent edits are not allowed.

Every correction should store:

- Super Administrator user ID.
- Timestamp.
- Old result data.
- New result data.
- Reason.
- Affected Fixtures.
- Affected Prediction Windows or Sporting Stages.
- Whether scoring was recalculated.
- Whether eliminations changed.
- Previous snapshot reference.
- Replacement snapshot reference.

---

## Standing Snapshots

Standing snapshots are immutable denormalised JSON records written at finalisation points.

Spec rule:

```txt
classification_standings_snapshots are immutable records written after Prediction Window or Sporting Stage finalisation.

They store the authoritative leaderboard state for one Classification at one finalisation point.
They are used for archive display, audit, recovery, and comparison against recalculated standings.
```

Rules:

- Final snapshots are authoritative.
- Provisional standings may be displayed before finalisation but are not authoritative.
- Live recalculation may be used for validation and debugging.
- Live recalculation must not replace the stored authoritative snapshot.
- Correction workflows must create new correction snapshots rather than mutating old snapshots.

---

## Archive Mode

Archive mode exports both static JSON and static pages.

| Export | Purpose |
|---|---|
| Static JSON | Durable machine-readable final record. |
| Static Next.js pages | Public-facing archive that survives without Supabase. |

Archive mode should include:

- Final Overall leaderboard.
- Final Format Classification standings.
- Prediction Group histories.
- Elimination history by Sporting Stage.
- Full Bracket Survivor standings.
- Knockout Bracket Survivor standings.
- Standalone knockout surface standings, if implemented.
- Final Fixture results.
- Scoring rules used.
- Template configuration used.
- Finalisation audit summary.

Rules:

- Public competitions may become public archives.
- Private competitions must not become public archives by default.
- Private archives should remain private, export only to the Competition Admin, or anonymise Entrants depending on final privacy settings.
- Archived mode should not require Supabase reads, login, RLS, live scoring, or Pick submission.

---

## Product Mode and Deployment

The standalone World Cup app is a Product Shell, not a separate rules engine.

Product modes:

| Mode | Purpose | Default? |
|---|---|---:|
| predictsport_full | Normal full app with all features. | Yes |
| world_cup_2026_shell | World Cup-only UX shell. | No |
| world_cup_2026_archive | Static archive after the tournament. | No |

Deployment approach:

| Component | Recommendation |
|---|---|
| GitHub repo | One shared PredictSport repo. |
| Vercel project 1 | Full PredictSport app. |
| Vercel project 2 | World Cup 2026 shell. |
| Business logic | Shared. |
| Product mode | Controlled by environment variable. |
| URL/domain | Separate World Cup-specific URL/domain if needed. |

The product mode should hide unrelated routes from navigation and redirect direct access to unsupported generic routes back to the World Cup home page.

For prototype and initial launch, both Vercel projects may point to the same Supabase backend.

Migration risk after tournament:

- The shell may break if it depends on live Supabase data after the main app evolves.

Mitigation:

- Use archive mode after tournament completion.
- Export final results into static JSON/pages.
- Archived shell should not require Supabase reads, login, RLS, live scoring, or Pick submission.

---

## Schema Naming

Phase 1 keeps existing core table names and adds reusable tournament-format domain tables.

Rules:

- Do not rename `competitions`, `rounds`, `events`, or `predictions` in Phase 1.
- Add reusable tournament-format domain tables.
- Avoid World Cup-only tables.
- Revisit naming only after tournament-format architecture stabilises.

Likely reusable tables:

```txt
sporting_tournaments
sporting_stages
prediction_windows
classifications
classification_memberships
classification_standings_snapshots
classification_events
format_prediction_groups
format_group_memberships
bracket_templates
bracket_prediction_submissions
result_finalisations
result_corrections
```

`format_prediction_groups` and `format_group_memberships` may be needed for the Format Classification even though they are not part of the minimum Classification schema.

---

## Rival and Private Competition Features

Rival following is Phase 1 lightweight only.

Rules:

- Maximum 6 followed rivals per Entrant.
- Rival relationships are unilateral.
- Rival systems exist only inside private competitions.
- Public competitions do not support rival-follow functionality in Phase 1.
- Rival-follow notifications are opt-in only.
- Opt-in occurs when an Entrant selects another Entrant as a rival to follow.
- Rival overtake notifications are rate-limited.
- Rival notifications occur only after Prediction Windows or Sporting Stages complete.
- Phase 1 uses limited preset notification options.
- Phase 1 does not include a designated primary rival.

Private competitions support only lightweight and optional profile customisation.

Possible profile elements:

- Avatar.
- Favourite team.
- Country flag.
- Small badge/accent.
- Short display tagline.

Private competitions may support a lightweight activity feed.

Phase 1 activity feeds contain only auto-generated system events:

- Entrant qualified for next Sporting Stage.
- Entrant eliminated.
- Entrant overtook another Entrant.
- Entrant won Prediction Group.
- Entrant reached Final Prediction Window.
- Entrant won Format Classification.

Phase 1 does not support:

- User-generated posts.
- Comments.
- Reactions.
- Direct messaging.
- Media uploads.

---

## UI Map Requiring Follow-Up

The following UI areas need a focused UI specification pass:

1. World Cup shell landing page.
2. Join flow and authentication prompts.
3. Main Prediction Window Pick screen.
4. Overall Classification leaderboard.
5. Format Classification group view.
6. Format Classification best-third table.
7. Format Classification knockout/survival progression view.
8. Full Bracket Survivor wizard.
9. Full Bracket Survivor visual review.
10. Knockout Bracket Survivor wizard.
11. Knockout Bracket Survivor visual review.
12. Standalone knockout surface, if implemented.
13. Results page with provisional/final labels.
14. Super Administrator result confirmation screen.
15. Super Administrator finalisation and correction screen.
16. Competition Admin setup screen.
17. Preset consequence table screen.
18. Archive pages.

UI guardrails:

- Provisional and final states must be visually distinct.
- Eliminations must never appear provisional.
- Bracket-live status uses heavy outline treatment around Entrant names.
- Dead bracket status removes the outline but does not remove the Entrant from other Classifications.
- Knockout-only users must not appear on the main World Cup competition instance leaderboard. They may appear on the Global Classification (cross-instance aggregate) if it is active.

---

## World Cup Fixture Catalogue

The World Cup schedule must be stored as a fixture catalogue within the tournament blueprint. Fixtures are shared across all competition instances — they are not duplicated per instance. Result confirmation on a fixture propagates to all instances.

Do not hard-code dates into generic logic.

Working schedule assumptions for template seeding:

| Stage | Working date range |
|---|---|
| Group Matchday 1 | 2026-06-11 to 2026-06-17 |
| Group Matchday 2 | 2026-06-18 to 2026-06-23 |
| Group Matchday 3 | 2026-06-24 to 2026-06-27 |
| Round of 32 | 2026-06-28 to 2026-07-03 |
| Round of 16 | 2026-07-04 to 2026-07-07 |
| Quarter-finals | 2026-07-09 to 2026-07-11 |
| Semi-finals | 2026-07-14 to 2026-07-15 |
| Third-place play-off | 2026-07-18 |
| Final | 2026-07-19 |

Implementation rule:

- Verify all schedule data against official FIFA sources during build.
- Store official fixture IDs and template keys where possible.
- Use `group_stage_finalised_at`, not calendar date alone, as the hard gate for knockout-only surfaces.

---

## Decisions 67-80 Summary

### Decision 67: Elimination Curve Direction

- Phase 1 accepts fixed milestone curves.
- Phase 2 should explore proportional curves.
- 50 percent cuts are a tension heuristic, not a rule.
- Exact curves are deferred to a dedicated session.

### Decision 68: Authoritative Standings Timing

- Authoritative standings, advancement, best-third rankings, and eliminations update only after finalisation.
- Live standings are not required in Phase 1.
- Projected standings are Phase 2 only and must be labelled provisional.

### Decision 69: Template Locking

- The World Cup 2026 template is structurally locked in Phase 1.
- Admins may edit presentation, invite settings, scoring values before launch, third-place inclusion, and approved entrant preset.
- Admins may not alter Sporting Stages, Prediction Windows, bracket shape, or raw tournament structure.
- Elimination curve is configurable only through approved presets.

### Decision 70: Authentication

- All scored participation requires authentication.
- Google OAuth and email magic link are supported.
- Anonymous scored play is excluded.

### Decision 71: Archive Export

- Archive mode exports both static JSON and static pages.
- Public archives are allowed for public competitions.
- Private competitions are not public by default.

### Decision 72: Result Handling

- Result confirmation mode is competition-configurable.
- World Cup 2026 should default to Super Administrator finalisation.
- Provisional results are visible.
- Finalisation triggers authoritative scoring and elimination.
- Corrections require audited emergency workflow.

### Decision 73: Role Separation

- Super Administrator and Competition Admin are separate roles.
- Competition Admins cannot confirm official World Cup results.

### Decision 74: Provisional Results and Fallback Auto-Finalisation

- Provisional results must be user-visible.
- Auto-finalise 15 minutes before the next dependent Prediction Window locks if all results are present.
- Missing results block finalisation and trigger escalation.

### Decision 75: Bracket Survivor UI and Engine

- Bracket entry uses a wizard plus visual bracket review.
- The Bracket Prediction Engine must be generic and reusable.
- World Cup-specific behaviour belongs in adapter/config.
- Bracket predictions use versioned JSON snapshots.

### Decision 76: Schema Naming

- Do not rename existing core tables in Phase 1.
- Add reusable tournament-format domain tables.

### Decision 77: First-Class Classifications

- Classifications are first-class backend entities.
- Entrant status is tracked per Classification.

### Decision 78: Classification Schema and Fourth Classification

- Minimum Classification schema accepted.
- Add fourth concurrent Classification: Knockout Bracket Survivor.
- Knockout Bracket Survivor opens after Group Stage finalisation and official Round of 32 generation.
- It is available to all parent-game Entrants.

### Decision 79: Standalone Knockout Surface

- There is a desired knockout-only public entry surface after the official Round of 32 is known.
- It must not duplicate canonical fixtures, results, finalisation jobs, bracket templates, or bracket logic.
- Implementation abstraction remains to be clarified.

### Decision 80: Standing Snapshots

- Standing snapshots are immutable denormalised JSON records written at finalisation points.
- Recalculation is validation/audit only, not the authoritative record.

---

## Superseded or Corrected Earlier Language

The following earlier positions are superseded:

| Earlier language | Updated position |
|---|---|
| Three concurrent Classifications | Four inside each World Cup competition instance: Overall, Format, Full Bracket Survivor, Knockout Bracket Survivor. |
| Format Classification final always has exactly 2 Entrants | Final entrant count is curve-derived. 96 has 4, 64 has 3, 48 has 2, fewer than 48 has 2 or fewer. |
| Child Format Classification hard cap of 48 | Phase 1 supports approved presets 12, 24, 48, 64, 96. Exact curve still deferred. |
| New Entrants may join until final Group Stage Prediction Window locks | Competition instance closes after Prediction Window 1 finalisation. |
| Knockout-only game as separate duplicated backend competition | Clarification required. It should be a separate entry surface/leaderboard without duplicated canonical data. |
| Admin confirms results | Super Administrator confirms official results. Competition Admin does not. |

---

## Open Questions Remaining

### Open Question 1: Exact Elimination Curves

This is the main deferred question.

Must define curves for:

- 12 Entrants.
- 24 Entrants.
- 48 Entrants.
- 64 Entrants.
- 96 Entrants.

Must resolve:

- At what sizes 2 Final Prediction Window Entrants are correct.
- At what sizes 3 Final Prediction Window Entrants are correct.
- At what sizes 4 Final Prediction Window Entrants are correct.
- Whether awkward counts near threshold values require special handling.
- How to balance tournament rhythm, tension, fairness, and user engagement.

### Open Question 2: Standalone Knockout Surface Abstraction

Must decide whether this is represented as:

- Separate Competition.
- Separate Classification.
- Separate entry cohort.
- Shared bracket-submission scope.
- Leaderboard filter over canonical bracket submissions.
- Another abstraction.

Must avoid duplicated fixtures, results, finalisation, bracket templates, bracket logic, and logically identical predictions.

### Open Question 3: Best-Third Rounding

Must define how to round top two-thirds of third-place finishers for awkward group counts.

### Open Question 4: Detailed Schema Implementation

Must finalise:

- Columns.
- Constraints.
- Indexes.
- RLS policies.
- Server-side guards.
- Status enums or check constraints.
- Migration order.
- Seed data.
- Rebuild and correction functions.

### Open Question 5: UI Map

Must produce detailed UI spec for all user, Competition Admin, Super Administrator, and archive flows.

### Open Question 6: Official FIFA Schedule Verification

Must verify schedule data against official FIFA sources during implementation and store it as the tournament blueprint's fixture catalogue.

---

## Documentation Update Plan

Recommended file updates:

| File | Update |
|---|---|
| `SPEC.md` | Add World Cup 2026 tournament-format feature requirements and acceptance criteria. |
| `context.md` | Add terminology decisions, Classification abstraction, and role separation. |
| ADR docs | Add ADRs for first-class Classifications, bracket engine, standing snapshots, result finalisation, and product shell. |
| `todos.md` | Add tasks grouped by phase and status code. Do not mark implementation tasks done until completed. |
| `CLAUDE.md` | Only update if project rules need a new mandatory read order or naming convention. |
| Schema docs | Add proposed reusable tournament-format tables. |
| Test docs | Add required test scenarios for brackets, result finalisation, snapshots, and eliminations. |

Recommended ADRs:

1. ADR: World Cup 2026 Product Shell over Shared Tournament Logic.
2. ADR: First-Class Classification Entities.
3. ADR: Versioned JSON Bracket Prediction Snapshots.
4. ADR: Immutable Classification Standing Snapshots.
5. ADR: Super Administrator Result Finalisation.
6. ADR: Prediction Window Locking as Current Round Mapping.
7. ADR: Format Classification Elimination Curves, deferred.
8. ADR: Standalone Knockout Surface, pending abstraction decision.

---

## Implementation Guardrails

- Do not implement the exact elimination curve until the separate curve session resolves it.
- Do not create World Cup-only tables.
- Do not duplicate canonical fixtures or results for the knockout-only surface.
- Do not allow Competition Admins to confirm official results.
- Do not silently mutate Classification config after competition creation.
- Do not rely on live recalculation as archive truth.
- Do not hard-code World Cup schedule dates into generic logic.
- Do not bake FIFA best-third logic into the generic bracket engine.
- Do not make provisional eliminations visible as if final.
- Do not make private archives public by default.

---

## Minimum Acceptance Tests To Add Later

### Classification model

- User can be active in Overall, eliminated in Format, dead in Full Bracket, and active in Knockout Bracket simultaneously.
- Classification status is not inferred from `competition_members` alone.
- Template changes do not mutate existing Classification config snapshots.

### Prediction Window locking

- Multiple future Prediction Windows can be open simultaneously.
- Only the relevant Prediction Window locks when its lock time arrives.
- Later windows remain editable.

### Scoring

- Correct outcome gives 2 points.
- Exact score gives 3 additional points.
- Approximate score gives 0 score-bonus points.
- Knockout advancing team gives 1 additional point when applicable.
- Group Stage max is 5 per Fixture.
- Knockout max is 6 per Fixture.

### Result finalisation

- Provisional results are visible.
- Provisional standings are clearly labelled.
- Authoritative standings do not update before finalisation.
- Eliminations do not occur before finalisation.
- Auto-finalisation occurs 15 minutes before the next dependent Prediction Window locks if all required results are present.
- Missing results block finalisation and trigger Super Administrator escalation.

### Standing snapshots

- Finalisation writes immutable standings snapshot.
- Correction writes replacement correction snapshot.
- Historical snapshot remains preserved.
- Archive reads snapshot rather than recalculating live standings.

### Bracket engine

- Full Bracket Survivor can be saved, edited, submitted, and locked.
- Knockout Bracket Survivor opens only after Group Stage finalisation.
- Wrong third-place qualifier kills Full Bracket Survivor status.
- Correct advancing team preserves bracket-live status.
- Penalties do not matter except for which team advances.
- World Cup-specific third-place slot allocation is handled by the adapter.

### Standalone knockout surface

- Users who join only the standalone knockout surface do not appear in main World Cup instance leaderboards.
- Standalone knockout surface does not duplicate fixtures or results.
- Shared canonical result finalisation feeds both relevant surfaces.

---

## End State

After this document is applied, the PredictSport World Cup 2026 feature should be specified as:

- A reusable tournament-format feature.
- A World Cup 2026 Product Shell.
- A four-Classification competition instance (instantiated from the tournament blueprint).
- A generic bracket engine with World Cup-specific adapter logic.
- A Super Administrator-controlled official result pipeline.
- A snapshot-based authoritative leaderboard archive.
- A configurable but not yet finalised Format Classification elimination-curve system.
