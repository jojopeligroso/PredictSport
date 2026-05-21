# WC-H1 Design: Full Bracket Prediction System

**Status:** Approved (2026-05-21)
**Phase:** WC-H (5th Classification - Pre-Tournament Stage Pick)
**Related:** SPEC.md §16.2, §16.8

---

## Overview

Pre-tournament wizard where entrants predict all group matches and knockout stages before PW1 locks. Creates default picks for PW1-PW3 to ensure engagement even if users forget to submit live picks.

**Generates Two Classifications:**
1. **Full Bracket Classification** - Did you predict the champion via the exact path?
2. **R32 Classification** - How many of the final 32 teams did you correctly predict? (automatic byproduct, no separate flow)

**Optional Participation:**
- Users can skip Full Bracket entirely
- If skipped: excluded from Full Bracket and R32 classifications
- Can still compete in: Overall, Format, Knockout Bracket

**Core Purpose:**
- "Skilled lottery" engagement
- Pre-fill mechanism for forgetful users
- R32 classification provides achievable metric when Full Bracket goes sideways

---

## User Flow

### Checkpoint System

Users can save and resume at these checkpoints:
1. After completing any full group (12 checkpoints)
2. After R32 predictions
3. After R16 predictions
4. After QF predictions
5. After SF predictions
6. After Final predictions

**Resume Behavior:** Returns to last completed checkpoint (not mid-group)

### Step 1: Group Stage Predictions

**Layout:** One group at a time (12 sequential screens)

**Per Group:**
- Show 4 teams
- Show 6 matches (round-robin)
- For each match: Home / Draw / Away buttons
- Live standings update as user predicts

**Example - Group A:**
```
Match 1: Netherlands vs Senegal    [H] [D] [A]
Match 2: Ecuador vs Qatar          [H] [D] [A]
Match 3: Netherlands vs Ecuador    [H] [D] [A]
Match 4: Senegal vs Qatar          [H] [D] [A]
Match 5: Netherlands vs Qatar      [H] [D] [A]
Match 6: Ecuador vs Senegal        [H] [D] [A]

Live Standings:
1. Netherlands  6 pts  (+2 GD)
2. Ecuador      6 pts  (+1 GD)  ← Tied on points
3. Senegal      3 pts
4. Qatar        0 pts
```

**After 6 matches:**
- Show predicted group standings
- Identify ties → proceed to Score Collection

### Step 2: Smart Score Collection

**Trigger:** System detects ties in predicted standings

**Smart Filtering Rules:**
- Only ask for scores where BOTH teams are:
  - Tied on points, AND
  - Match was predicted as a win (draws don't affect GD)
- Don't ask for matches involving non-tied teams

**Example:**
```
Your predictions have tied teams in Group A:

Netherlands and Ecuador are level on 6 points.
Goal difference will decide who finishes 1st/2nd.

Predict scores for these matches:
├── Netherlands vs Ecuador: [_] - [_]
├── Netherlands vs Qatar:   [_] - [_]
├── Ecuador vs Senegal:     [_] - [_]
```

**Tiebreaker Hierarchy (Phase 1 Implementation):**

For 3+ teams tied:
1. Head-to-head points ✅
2. Head-to-head goal difference ✅
3. Head-to-head goals scored ✅
4. Overall goal difference ✅
5. Overall goals scored ✅
6. **Random selection** (with clear UI warning)

For 2 teams tied:
1. Overall goal difference ✅
2. Overall goals scored ✅
3. **Random selection** (with clear UI warning)

**Phase 2:** Add fair play score (6) and FIFA ranking (7) tiebreakers.

**Random Fallback Messaging:**
```
⚠️ Your predictions created an exact tie between [Team A] and [Team B].

FIFA would use fair play scores to decide this, but for now we've
randomly placed [Team A] ahead.

💡 Tip: Predict different scores to avoid ties in your bracket!
```

### Step 3: Best-Third Allocation (Automatic)

After user completes all 12 groups:

1. System collects all 12 third-place teams
2. Ranks by: points → GD → goals scored → (fair play) → (FIFA ranking)
3. Identifies top 8 (auto-qualify to R32)
4. Applies FIFA slot allocation rules silently

**No user input required.**

**UI Feedback:**
```
Generating your Round of 32 bracket...

✓ 12 group winners identified
✓ 12 runners-up identified
✓ Best 8 third-place teams ranked
✓ R32 matchups created per FIFA rules

Ready to predict the knockouts →
```

### Step 4: R32 Predictions

**Layout:** All 16 R32 matches on one screen

**Match Cards:**
- Team A vs Team B (from user's group predictions)
- Winner picker (no draw in knockouts)
- (?) icon: explains slot allocation

**Example:**
```
Match 1: Netherlands vs USA          [Netherlands ▼] [USA]
  (?) Group A Winner vs Group B Runner-up

Match 2: England vs Mexico           [England] [Mexico ▼]
  (?) Group B Winner vs Group A Runner-up
```

### Step 5: R16, QF, SF, Final

Same pattern:
- All matches for stage shown together
- Winners auto-populated from previous stage
- Save checkpoint after each stage

**Final Stage (PW8):**
- Third-Place match
- Final
- Two separate predictions

### Step 6: Review Bracket

**Pre-submission review:**
- Visual bracket tree
- Highlight champion path
- Show R32 team list (for R32 classification)
- Edit buttons to jump back to any stage

**Confirmation Screen:**
```
Your World Cup 2026 Bracket

Champion: Argentina
Runner-up: Brazil
Third: France

Teams you predict will make R32: (list of 32)

Classifications you'll compete in:
✓ Full Bracket (champion path)
✓ R32 Pick (32 team accuracy)
✓ Overall
✓ Format
(Knockout Bracket opens after Group Stage)

[Edit Bracket] [Submit & Lock]
```

---

## R32 Classification (Automatic)

**Type:** `stage_pick` (automatic, no separate flow)

**How It Works:**
1. User completes Full Bracket group predictions
2. System extracts 32 teams (12 winners + 12 runners-up + 8 best thirds)
3. After real Group Stage finalizes → check accuracy
4. Score: 1 point per correct team (max 32)

**Scoring Logic:**
```typescript
const userR32Teams = extractR32TeamsFromBracket(submission)
const actualR32Teams = getActualQualifiedTeams()
const correctCount = userR32Teams.filter(team =>
  actualR32Teams.includes(team)
).length

score = correctCount // 0-32
```

**Leaderboard:**
```
R32 Classification Standings

1. Alice    31/32  (96.9%)
2. Bob      30/32  (93.8%)
3. Charlie  28/32  (87.5%)
```

**Purpose:**
- Engagement when Full Bracket fails
- Rewards good group predictions
- Dashboard widget: "You got 29 of 32 teams right!"

**Entry:** Automatic if user completes Full Bracket

---

## FAQ Page

**Location:** `/wc/rules` or `/wc/faq`

**Sections:**

### How do the Classifications work?
Explains all 5 with examples

### Group Stage Tiebreakers
```
If teams finish level on points, FIFA uses:

1. Goal difference in all group matches
2. Goals scored in all group matches
3. Fair play score (yellow/red cards)
4. FIFA world ranking

We'll ask for match scores only when ties occur
in your predictions.
```

### Best-Third Qualification
```
The top 8 third-place teams advance to R32.

Ranked by:
1. Points
2. Goal difference
3. Goals scored
4. Fair play score (Phase 2)
5. FIFA ranking (Phase 2)

Your wizard calculates this automatically.
```

### Best-Third Slot Allocation
```
FIFA assigns the 8 best thirds to specific R32 matches
based on which groups they came from.

Applied automatically in your bracket.

[See full FIFA allocation table ▼]
```

### Full Bracket vs Knockout Bracket
```
Full Bracket: Predict before tournament starts
  - Harder, locked in early
  - Creates R32 Classification automatically

Knockout Bracket: Predict after Group Stage
  - Fresh start with actual R32 teams
  - Opens after groups finalize

You can compete in both!
```

### Scoring Rules
Standard match scoring (SPEC.md §16.4)

### Can I change my bracket?
```
Full Bracket: Editable until PW1 locks
Knockout Bracket: Separate picks, opens later
```

### What if I skip Full Bracket?
```
Excluded from:
- Full Bracket Classification
- R32 Classification

Can still compete in:
- Overall
- Format
- Knockout Bracket (opens later)
```

**UI:** Collapsible accordion, searchable

---

## Onboarding Integration

### Updated Flow

**Phase 1: Quick Admin**
1. Display name
2. Avatar (optional)
3. Privacy: public / anonymous / private-only

**Phase 2: UI Warmers**
4. Favorite team (heart)
5. Champion pick (head)
   - Copy: "Just because you love them doesn't mean that's what your head wants to pick"

**Phase 3: Classifications Overview**
6. Quick explainer:
   ```
   5 Ways to Win:

   🏆 Overall → Cumulative points
   ⚔️  Format → Elimination groups
   📊 Full Bracket → Predict upfront
   🔄 Knockout Bracket → Fresh start
   ✓  R32 Pick → Team accuracy
   ```

**Phase 4: Full Bracket (OPTIONAL)**
7. "Want to fill out your bracket now?"
   - [Start Full Bracket] → Wizard (Steps 1-6)
   - [Skip for now] → Format enrollment

**Phase 5: Format Classification**
8. Join elimination bracket
9. Done! → `/wc` dashboard

**Continue Later:**
- Available at any checkpoint
- "Save & finish later" button
- Resume from last checkpoint

---

## Data Model

### Bracket Submission

```typescript
// bracket_prediction_submissions table
{
  id: uuid
  competition_id: uuid
  user_id: uuid
  classification_id: uuid
  bracket_data: {
    groups: {
      [groupId]: {
        predictions: Array<{
          match_id: string
          outcome: 'home' | 'draw' | 'away'
          home_score?: number
          away_score?: number
        }>
        standings: Array<{
          team: string
          points: number
          gd: number
          gs: number
          position: 1 | 2 | 3 | 4
        }>
      }
    }
    r32_teams: string[] // auto-extracted for R32 classification
    knockouts: {
      r32: Array<{match_id: string, winner: string}>
      r16: Array<{match_id: string, winner: string}>
      qf: Array<{match_id: string, winner: string}>
      sf: Array<{match_id: string, winner: string}>
      third_place: {match_id: string, winner: string}
      final: {match_id: string, winner: string}
    }
    champion: string
  }
  submitted_at: timestamp
  locked: boolean
  version: integer
}
```

### R32 Classification Config

```typescript
// classifications table
{
  id: uuid
  type: 'stage_pick'
  name: 'R32 Pick'
  config: {
    source: 'bracket_group_stage' // auto-derived
    target_stage: 'r32'
    scoring: {
      correct_team: 1
    }
  }
}
```

---

## Implementation Components

### New Components

1. `<BracketWizard>` - Multi-step wizard shell
2. `<GroupMatchPredictor>` - Single group predictions
3. `<LiveGroupStandings>` - Real-time table
4. `<ScoreCollector>` - Smart score input for ties
5. `<R32BracketPreview>` - Generated R32 display
6. `<KnockoutStagePredictor>` - Knockout picker
7. `<BracketReview>` - Full visualization
8. `<BracketTree>` - Visual tree renderer
9. `<FAQPage>` - Rules explainer

### Utility Functions

1. `calculateGroupStandings(predictions)` - Pts, GD, GS
2. `detectTiebreakersNeeded(standings)` - Which teams need scores
3. `rankBestThirds(allThirds)` - FIFA ranking logic (steps 1-5 + random)
4. `allocateBestThirdsToSlots(bestThirds)` - FIFA slot rules
5. `generateR32Bracket(winners, runnersUp, thirds)`
6. `extractR32Teams(bracketData)` - For R32 classification
7. `validateBracketCompleteness(bracketData)`

---

## Scoring Logic

### Full Bracket Classification

**Slot-sensitive:** Champion must win through exact predicted path

**Correctness:**
- If any knockout match along champion's path is wrong → eliminated
- If team appears in wrong slot → wrong (e.g., Argentina in Match 3 instead of Match 5)

### R32 Classification

**Simple set comparison:**
```typescript
score = countMatches(userR32Teams, actualR32Teams)
```

**Leaderboard:** Ranked by score, ties broken by submission timestamp

---

## Phase 2 Enhancements

1. **Fair play score tiebreaker** (requires card data tracking)
2. **FIFA ranking tiebreaker** (requires ranking dataset maintenance)
3. **Favorites/underdogs toggle** (show odds/rankings during picks)
4. **Bracket comparison** (compare yours vs friends)
5. **"What if" simulator** (change one match, see impact)
6. **Admin config for private codes** (pre-set required classifications)

---

## Open Questions for Phase 2

1. Can users change privacy settings after onboarding?
2. Tiebreaker UI: show fair play scores explicitly or just apply?
3. Bracket editing: UX for edits after initial submission?
4. Admin private code configs: which classifications can be pre-required?

---

## Summary

**WC-H1 Delivers:**
- ✅ Full Bracket wizard (group-by-group, smart scores, R32 gen, knockouts)
- ✅ R32 classification (automatic, no separate flow)
- ✅ Tiebreakers 1-5 + random fallback (Phase 2: add 6-7)
- ✅ FAQ page
- ✅ Onboarding integration with checkpoints
- ✅ Optional participation

**Design Philosophy:**
- Full Bracket = "skilled lottery" fun
- R32 Classification = achievable engagement metric
- Real meat = Format/Overall/Knockout Bracket
- Purpose = default picks + keep users engaged
