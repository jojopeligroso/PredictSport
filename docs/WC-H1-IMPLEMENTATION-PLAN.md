# WC-H1 Implementation Plan: Parallel Execution Strategy

**Status:** Ready for parallel implementation
**Target:** 8 independent streams, ~4-6 weeks with 2-3 concurrent sessions
**Last Updated:** 2026-05-21

---

## Overview

This plan breaks WC-H1 implementation into **8 independent work streams** optimized for concurrent execution by multiple AI agents or developers. Each stream works on isolated files with minimal cross-dependencies.

**Foundation Complete:**
- ✅ Core types (`src/lib/tournament/bracket/types.ts`)
- ✅ Template system (`src/lib/tournament/bracket/templates/`)
- ✅ FIFA WC 2026 adapter (`src/lib/tournament/bracket/adapters/fifa-world-cup-2026.ts`)
- ✅ Tiebreaker rules (`src/lib/tournament/bracket/tiebreakers/fifa.ts`)

---

## Dependency Graph

```
Stream 1 (Engine)
    ↓
Stream 2 (Group UI) ← depends on Stream 1
Stream 3 (Knockout UI) ← depends on Stream 1
Stream 4 (Wizard) ← depends on Streams 2, 3
    ↓
Stream 5 (APIs) ← depends on Streams 1, 4
Stream 6 (R32 Classification) ← depends on Stream 1
Stream 7 (FAQ) ← depends on Stream 1 (light dependency)
    ↓
Stream 8 (Integration) ← depends on Streams 4, 5
```

**Parallel Execution Groups:**
- **Wave 1 (Start First):** Stream 1 (blocking for others)
- **Wave 2 (After Stream 1):** Streams 2, 3, 6, 7 (fully parallel)
- **Wave 3 (After Wave 2):** Streams 4, 5 (parallel)
- **Wave 4 (Final):** Stream 8 (integration)

---

## Stream 1: Generic Bracket Engine 🔴 BLOCKING

**Priority:** HIGHEST - Other streams depend on this
**Files:** `src/lib/tournament/bracket/engine.ts`
**Estimated Time:** 6-8 hours
**Dependencies:** None (uses only types)

### Tasks

#### S1.T1: calculateGroupStandings
```typescript
// Input: predictions, tiebreaker rules
// Output: sorted standings with positions
export function calculateGroupStandings(
  predictions: MatchPrediction[],
  tiebreakers: TiebreakerRule[]
): TeamWithStats[]
```

**Implementation Steps:**
1. Calculate points from match predictions (3 for win, 1 for draw, 0 for loss)
2. Calculate GD, GS, GC from scores (if provided)
3. Sort teams by points
4. Identify ties (teams with equal points)
5. Apply tiebreaker rules in order to resolve ties
6. Assign final positions (1-4)

**Test Cases:**
- All teams different points (no ties)
- 2-team tie on points (use GD)
- 3-team tie (use head-to-head)
- Tie goes all the way to random fallback

#### S1.T2: applyTiebreaker
```typescript
// Input: tied teams, single tiebreaker rule, all predictions
// Output: teams sorted by this tiebreaker
function applyTiebreaker(
  tiedTeams: TeamWithStats[],
  rule: TiebreakerRule,
  allPredictions: MatchPrediction[]
): TeamWithStats[]
```

**Tiebreaker Types to Implement:**
- `overall_gd`: Sort by goal difference
- `overall_gs`: Sort by goals scored
- `head_to_head_points`: Calculate points from H2H matches only
- `head_to_head_gd`: GD from H2H matches
- `head_to_head_gs`: GS from H2H matches
- `random`: Shuffle with deterministic seed, show warning

#### S1.T3: detectTiebreakersNeeded
```typescript
// Input: standings, tiebreaker rules
// Output: which matches need scores to resolve ties
export function detectTiebreakersNeeded(
  standings: TeamWithStats[],
  tiebreakers: TiebreakerRule[],
  predictions: MatchPrediction[]
): {
  tiedTeams: TeamWithStats[][]
  matchesNeedingScores: string[]  // match IDs
  nextTiebreaker: TiebreakerRule
}
```

**Logic:**
1. Find all groups of teams tied on points
2. Try applying tiebreakers without scores (points, H2H points)
3. If still tied and next tiebreaker needs GD/GS → request scores
4. Only request scores for matches involving tied teams
5. Don't request scores for draws (GD = 0)

#### S1.T4: rankTeamsByRules
```typescript
// Input: teams, tiebreaker hierarchy
// Output: ranked teams (used for best thirds)
export function rankTeamsByRules(
  teams: TeamWithStats[],
  tiebreakers: TiebreakerRule[]
): TeamWithStats[]
```

**Used For:** Best-third ranking across all groups

#### S1.T5: generateKnockoutBracket
```typescript
// Input: qualified teams, knockout structure
// Output: bracket with all matches
export function generateKnockoutBracket(
  qualifiedTeams: QualifiedTeam[],
  knockoutStages: KnockoutStage[]
): KnockoutBracket
```

**Logic:**
1. For first knockout stage (R32), generate matches using adapter's matchup rules
2. For subsequent stages, propagate winners from previous stage
3. Return bracket structure with all match IDs

#### S1.T6: extractStageQualifiers
```typescript
// Input: bracket data, stage key
// Output: list of teams that made this stage
export function extractStageQualifiers(
  bracketData: BracketData,
  stageKey: string
): string[]
```

**Simple getter with fallback**

#### S1.T7: validateBracketCompleteness
```typescript
// Input: bracket data, template
// Output: validation result with errors
export function validateBracketCompleteness(
  bracketData: BracketData,
  template: TournamentTemplate
): ValidationResult
```

**Validations:**
- All groups predicted (if template has groups)
- All knockout stages predicted
- Champion selected
- Stage qualifiers extracted for each stage pick classification

**Deliverable:** `src/lib/tournament/bracket/engine.ts` (~500 lines)

---

## Stream 2: Group Stage UI Components 🟢 PARALLEL

**Priority:** HIGH
**Files:** 3 separate component files
**Estimated Time:** 6-8 hours
**Dependencies:** Stream 1 (engine functions)

### Tasks

#### S2.T1: GroupMatchPredictor Component
**File:** `src/components/tournament/bracket/GroupMatchPredictor.tsx`

**Props:**
```typescript
interface GroupMatchPredictorProps {
  groupId: string
  teams: string[]  // 4 team names
  tiebreakers: TiebreakerRule[]
  initialPredictions?: MatchPrediction[]
  onPredictionsChange: (predictions: MatchPrediction[]) => void
}
```

**Features:**
- Display 6 round-robin matches (4 teams = 6 matches)
- Home / Draw / Away buttons for each match
- Call `calculateGroupStandings()` on every prediction change
- Display live standings table below matches
- Highlight ties in standings
- Show tiebreaker hierarchy in info banner

**UI Layout:**
```
Group A
┌────────────────────────────────────┐
│ Netherlands vs Senegal             │
│  [HOME]  [DRAW]  [AWAY]           │
├────────────────────────────────────┤
│ Ecuador vs Qatar                   │
│  [HOME]  [DRAW]  [AWAY]           │
├────────────────────────────────────┤
│ ...                                │
└────────────────────────────────────┘

Live Standings:
1. Netherlands  6 pts  +2 GD
2. Ecuador      6 pts  +1 GD  ⚠️ Tied on points
3. Senegal      3 pts
4. Qatar        0 pts

Ties broken by: GD → GS → H2H Points → ...
```

**State Management:**
```typescript
const [predictions, setPredictions] = useState<MatchPrediction[]>([])
const standings = calculateGroupStandings(predictions, tiebreakers)
```

#### S2.T2: LiveGroupStandings Component
**File:** `src/components/tournament/bracket/LiveGroupStandings.tsx`

**Props:**
```typescript
interface LiveGroupStandingsProps {
  standings: TeamWithStats[]
  tiebreakers: TiebreakerRule[]
  highlightTies?: boolean
}
```

**Features:**
- Display group table (position, team, points, GD, GS)
- Highlight tied teams
- Show which tiebreaker applies next for ties
- Animate position changes (optional)

**UI:**
```
| Pos | Team        | Pts | GD  | GS |
|-----|-------------|-----|-----|-----|
| 1   | Netherlands | 6   | +2  | 8  |
| 2   | Ecuador     | 6   | +1  | 7  | ⚠️ Tied
| 3   | Senegal     | 3   | -1  | 5  |
| 4   | Qatar       | 0   | -2  | 2  |

⚠️ 2 teams tied - goal difference will decide
```

#### S2.T3: ScoreCollector Component
**File:** `src/components/tournament/bracket/ScoreCollector.tsx`

**Props:**
```typescript
interface ScoreCollectorProps {
  tiedTeams: TeamWithStats[]
  matchesNeedingScores: string[]
  currentTiebreaker: TiebreakerRule
  predictions: MatchPrediction[]
  onScoresProvided: (updatedPredictions: MatchPrediction[]) => void
}
```

**Features:**
- Show tied teams and current tiebreaker
- Display only matches that need scores
- Score inputs (home/away)
- Validate scores entered
- If tiebreaker is 'random', show warning with custom message
- Submit button to apply scores

**UI:**
```
⚠️ Netherlands and Ecuador are tied on 6 points

Goal difference will decide who finishes 1st/2nd.

Please predict scores for these matches:

Netherlands vs Ecuador:  [_3_] - [_1_]
Netherlands vs Qatar:    [_2_] - [_0_]
Ecuador vs Senegal:      [_2_] - [_1_]

[Apply Scores]
```

**Random Fallback UI:**
```
⚠️ Your predictions created an exact tie

FIFA would use fair play scores to decide this,
but for now we've randomly placed Netherlands ahead.

💡 Tip: Predict different scores to avoid ties!
```

**Deliverables:**
- `GroupMatchPredictor.tsx` (~200 lines)
- `LiveGroupStandings.tsx` (~100 lines)
- `ScoreCollector.tsx` (~150 lines)

---

## Stream 3: Knockout Stage UI Components 🟢 PARALLEL

**Priority:** HIGH
**Files:** 3 separate component files
**Estimated Time:** 5-7 hours
**Dependencies:** Stream 1 (engine functions)

### Tasks

#### S3.T1: KnockoutStagePredictor Component
**File:** `src/components/tournament/bracket/KnockoutStagePredictor.tsx`

**Props:**
```typescript
interface KnockoutStagePredictorProps {
  stage: KnockoutStage
  matches: BracketMatch[]
  onPredictionsChange: (predictions: Array<{match_id: string, winner: string}>) => void
}
```

**Features:**
- Display all matches for stage (16 for R32, 8 for R16, etc.)
- Winner picker for each match (no draw in knockouts)
- Show slot_info (?) icons for context
- Grid layout for multiple matches

**UI:**
```
Round of 32 - Pick winners for all 16 matches

Match 1: Netherlands vs USA
  [Netherlands ✓]  [USA]
  (?) Group A Winner vs Group B Runner-up

Match 2: England vs Mexico
  [England]  [Mexico ✓]
  (?) Group B Winner vs Group A Runner-up

... 14 more matches ...

[Continue to Round of 16]
```

#### S3.T2: StageBracketPreview Component
**File:** `src/components/tournament/bracket/StageBracketPreview.tsx`

**Props:**
```typescript
interface StageBracketPreviewProps {
  stage: KnockoutStage
  predictions: Array<{match_id: string, winner: string}>
  onEdit: () => void
}
```

**Features:**
- Read-only view of stage predictions
- Show all matches and predicted winners
- Edit button to jump back to predictor

**UI:**
```
Round of 32 (Completed ✓)

Netherlands def. USA
England def. Mexico
...

[Edit Round of 32]
```

#### S3.T3: BracketReview Component
**File:** `src/components/tournament/bracket/BracketReview.tsx`

**Props:**
```typescript
interface BracketReviewProps {
  bracketData: BracketData
  template: TournamentTemplate
  onEdit: (stageId: string) => void
  onSubmit: () => void
}
```

**Features:**
- Full bracket visualization (can be simple list for MVP)
- Champion highlighted
- Show R32 team list (for R32 classification)
- Edit buttons for each section
- Submit & lock button

**UI:**
```
Your World Cup 2026 Bracket

Champion: Argentina 🏆
Runner-up: Brazil
Third: France

Group Stage:
  Group A: Netherlands, Ecuador, Senegal
  Group B: England, USA, Mexico
  ... [Edit Groups]

Round of 32: (32 teams qualified)
  Netherlands, England, Argentina, ... [Edit R32]

Round of 16: ...

Your R32 Classification: 31/32 teams correct

[Edit Bracket]  [Submit & Lock]
```

**Deliverables:**
- `KnockoutStagePredictor.tsx` (~150 lines)
- `StageBracketPreview.tsx` (~100 lines)
- `BracketReview.tsx` (~200 lines)

---

## Stream 4: Bracket Wizard Shell 🟡 WAVE 3

**Priority:** MEDIUM (depends on Streams 2, 3)
**Files:** 1 main wizard component
**Estimated Time:** 8-10 hours
**Dependencies:** Streams 2, 3 (UI components)

### Tasks

#### S4.T1: BracketWizard Component
**File:** `src/components/tournament/bracket/BracketWizard.tsx`

**Props:**
```typescript
interface BracketWizardProps {
  competition: Competition
  template: TournamentTemplate
  existingSubmission?: BracketSubmission
  onSubmit: (bracketData: BracketData) => void
  onSaveDraft?: (bracketData: BracketData) => void
}
```

**Features:**
- Multi-step wizard (groups → R32 → R16 → QF → SF → Final)
- Dynamic step generation from template
- Checkpoint save/resume system
- Progress indicator
- "Continue Later" button at each checkpoint
- Review screen before final submission

**State Structure:**
```typescript
const [currentStep, setCurrentStep] = useState(0)
const [bracketData, setBracketData] = useState<Partial<BracketData>>({
  template_id: template.id,
  groups: {},
  stage_qualifiers: {},
  knockout_predictions: {},
  champion: ''
})
const [checkpoints, setCheckpoints] = useState<number[]>([])
```

**Step Generation Logic:**
```typescript
const steps = useMemo(() => {
  const groupSteps = template.groups
    ? Array.from({ length: template.groups.count }, (_, i) => ({
        type: 'group',
        id: `group_${i}`,
        label: `Group ${String.fromCharCode(65 + i)}`, // A, B, C...
        checkpointAfter: true
      }))
    : []

  const knockoutSteps = template.knockoutStages.map(stage => ({
    type: 'knockout',
    id: stage.id,
    label: stage.name,
    checkpointAfter: true
  }))

  return [
    ...groupSteps,
    ...knockoutSteps,
    { type: 'review', id: 'review', label: 'Review Bracket' }
  ]
}, [template])
```

**Checkpoint Logic:**
```typescript
function saveCheckpoint() {
  if (onSaveDraft) {
    onSaveDraft(bracketData)
  }
  setCheckpoints([...checkpoints, currentStep])
}

function resumeFromCheckpoint() {
  const lastCheckpoint = checkpoints[checkpoints.length - 1] || 0
  setCurrentStep(lastCheckpoint)
}
```

**Step Rendering:**
```typescript
const currentStepConfig = steps[currentStep]

switch (currentStepConfig.type) {
  case 'group':
    return (
      <GroupMatchPredictor
        groupId={currentStepConfig.id}
        teams={getGroupTeams(currentStepConfig.id)}
        tiebreakers={template.tiebreakers}
        onPredictionsChange={handleGroupPredictions}
      />
    )

  case 'knockout':
    return (
      <KnockoutStagePredictor
        stage={template.knockoutStages.find(s => s.id === currentStepConfig.id)!}
        matches={getStageMatches(currentStepConfig.id)}
        onPredictionsChange={handleKnockoutPredictions}
      />
    )

  case 'review':
    return (
      <BracketReview
        bracketData={bracketData}
        template={template}
        onEdit={handleEdit}
        onSubmit={handleSubmit}
      />
    )
}
```

**Progress Indicator:**
```typescript
<div className="progress-bar">
  {steps.map((step, index) => (
    <div
      key={step.id}
      className={cn(
        'step',
        index < currentStep && 'completed',
        index === currentStep && 'active'
      )}
    >
      {step.label}
    </div>
  ))}
</div>
```

**Best-Third Processing (Between Groups and R32):**
```typescript
function processGroupStageCompletion() {
  // Extract all 12 third-place teams
  const allThirds = Object.values(bracketData.groups!)
    .map(g => g.standings.find(t => t.position === 3)!)
    .filter(Boolean)

  // Rank using engine
  const rankedThirds = rankTeamsByRules(allThirds, template.tiebreakers)

  // Select top 8
  const bestThirds = rankedThirds.slice(0, 8)

  // Generate R32 bracket using adapter
  const r32Matches = generateFIFAR32Bracket([
    ...getGroupWinners(),
    ...getGroupRunnersUp(),
    ...bestThirds.map(t => ({
      name: t.name,
      source: { type: 'best_third' as const },
      stats: t
    }))
  ])

  // Auto-populate R32 teams for R32 classification
  const r32Teams = [
    ...getGroupWinners().map(t => t.name),
    ...getGroupRunnersUp().map(t => t.name),
    ...bestThirds.map(t => t.name)
  ]

  setBracketData({
    ...bracketData,
    stage_qualifiers: {
      ...bracketData.stage_qualifiers,
      r32: r32Teams
    }
  })
}
```

**Deliverable:** `BracketWizard.tsx` (~500 lines)

---

## Stream 5: API Routes 🟡 WAVE 3

**Priority:** MEDIUM (depends on Stream 1, 4)
**Files:** 3 API route files
**Estimated Time:** 4-6 hours
**Dependencies:** Stream 1 (engine), Stream 4 (bracket data structure)

### Tasks

#### S5.T1: Submit Bracket API
**File:** `src/app/api/tournament/bracket/submit/route.ts`

**Endpoint:** `POST /api/tournament/bracket/submit`

**Request Body:**
```typescript
{
  competition_id: string
  classification_id: string
  bracket_data: BracketData
  draft: boolean  // true = save checkpoint, false = final submission
}
```

**Logic:**
1. Validate user is authenticated
2. Load template from bracket_data.template_id
3. If draft = false, validate completeness using `validateBracketCompleteness()`
4. Upsert to `bracket_prediction_submissions` table
5. If final submission, set `locked = false` (locks at PW1)
6. Return submission ID

**Response:**
```typescript
{
  success: boolean
  submission_id: string
  errors?: string[]
}
```

#### S5.T2: Lock Bracket API
**File:** `src/app/api/tournament/bracket/lock/route.ts`

**Endpoint:** `POST /api/tournament/bracket/lock`

**Request Body:**
```typescript
{
  submission_id: string
}
```

**Logic:**
1. Verify submission exists and belongs to user
2. Check PW1 has locked (or lock time passed)
3. Set `locked = true` on submission
4. Generate stage_qualifiers if not already done
5. Return success

**Called by:** Cron job when PW1 locks, or manual admin trigger

#### S5.T3: Get Bracket Status API
**File:** `src/app/api/tournament/bracket/status/route.ts`

**Endpoint:** `GET /api/tournament/bracket/status?competitionId=X`

**Response:**
```typescript
{
  hasSubmission: boolean
  submissionId?: string
  locked: boolean
  lastCheckpoint?: string
  completionPercentage: number
}
```

**Used By:** UI to resume or show status

**Deliverables:**
- `submit/route.ts` (~150 lines)
- `lock/route.ts` (~100 lines)
- `status/route.ts` (~80 lines)

---

## Stream 6: R32 Classification Scoring 🟢 PARALLEL

**Priority:** HIGH (can run parallel with Stream 2/3)
**Files:** 2 files (utility + component)
**Estimated Time:** 3-4 hours
**Dependencies:** Stream 1 (extractStageQualifiers)

### Tasks

#### S6.T1: R32 Scoring Utility
**File:** `src/lib/tournament/scoring/r32-classification.ts`

**Functions:**
```typescript
// Extract R32 teams from bracket submission
export function extractR32Teams(bracketData: BracketData): string[] {
  return extractStageQualifiers(bracketData, 'r32')
}

// Score R32 classification
export function scoreR32Classification(
  userR32Teams: string[],
  actualR32Teams: string[]
): {
  score: number
  correctTeams: string[]
  missedTeams: string[]
  incorrectTeams: string[]
} {
  const correct = userR32Teams.filter(team =>
    actualR32Teams.includes(team)
  )

  const missed = actualR32Teams.filter(team =>
    !userR32Teams.includes(team)
  )

  const incorrect = userR32Teams.filter(team =>
    !actualR32Teams.includes(team)
  )

  return {
    score: correct.length,
    correctTeams: correct,
    missedTeams: missed,
    incorrectTeams: incorrect
  }
}
```

#### S6.T2: R32 Leaderboard Component
**File:** `src/components/tournament/R32Leaderboard.tsx`

**Props:**
```typescript
interface R32LeaderboardProps {
  competitionId: string
  classificationId: string
}
```

**Features:**
- Fetch standings from API
- Display ranked by score (X/32)
- Show percentage
- Highlight user's position

**UI:**
```
R32 Classification Standings

1. Alice     31/32  (96.9%)  ← You
2. Bob       30/32  (93.8%)
3. Charlie   28/32  (87.5%)
...
```

#### S6.T3: R32 Dashboard Widget
**File:** `src/components/tournament/R32DashboardWidget.tsx`

**Features:**
- Shows user's R32 score
- "You correctly predicted 29 of the final 32 teams!"
- Link to detailed breakdown

**Deliverables:**
- `r32-classification.ts` (~80 lines)
- `R32Leaderboard.tsx` (~100 lines)
- `R32DashboardWidget.tsx` (~60 lines)

---

## Stream 7: FAQ Generator & Page 🟢 PARALLEL

**Priority:** MEDIUM (nice-to-have for launch)
**Files:** 2 files
**Estimated Time:** 3-4 hours
**Dependencies:** Stream 1 (light - uses template types only)

### Tasks

#### S7.T1: FAQ Content Generator
**File:** `src/lib/tournament/bracket/faq-generator.ts`

**Function:**
```typescript
export function generateFAQContent(template: TournamentTemplate): FAQContent {
  const bestThirdCount = template.groups?.advancePerGroup
    .find(rule => rule.position === 3)?.count || 0

  const tiebreakerLabels = template.tiebreakers
    .filter(t => t.type !== 'random')
    .map(t => formatTiebreakerLabel(t.type))

  return {
    tournamentName: template.name,

    groupTiebreakers: {
      title: 'Group Stage Tiebreakers',
      content: `If teams finish level on points:\n${
        template.tiebreakers.map((t, i) =>
          `${i + 1}. ${formatTiebreakerLabel(t.type)}`
        ).join('\n')
      }\n\nWe'll ask for match scores only when ties occur in your predictions.`
    },

    bestThirdQualification: bestThirdCount > 0 ? {
      title: 'Best-Third Qualification',
      content: `The top ${bestThirdCount} third-place teams advance.\n\nRanked by:\n${
        tiebreakerLabels.join(' → ')
      }\n\nYour bracket wizard calculates this automatically.`
    } : null,

    knockoutStages: {
      title: 'Knockout Stages',
      stages: template.knockoutStages.map(stage => ({
        name: stage.name,
        matchCount: stage.matchCount,
        description: `${stage.matchCount} matches${
          stage.advancesTo ? ` advancing to ${stage.advancesTo}` : ''
        }`
      }))
    },

    classifications: {
      title: 'Classifications',
      items: [
        {
          name: 'Full Bracket',
          description: 'Predict everything before tournament starts. Did you predict the champion through the exact path?'
        },
        template.stagePickClassifications?.r32 && {
          name: template.stagePickClassifications.r32.name,
          description: 'How many of the knockout teams did you correctly predict? Automatic from your bracket.'
        },
        {
          name: 'Knockout Bracket',
          description: 'Opens after Group Stage. Fresh start with actual R32 teams.'
        }
      ].filter(Boolean)
    }
  }
}

function formatTiebreakerLabel(type: TiebreakerType): string {
  const labels: Record<TiebreakerType, string> = {
    'head_to_head_points': 'Head-to-head points',
    'head_to_head_gd': 'Head-to-head goal difference',
    'head_to_head_gs': 'Head-to-head goals scored',
    'overall_gd': 'Overall goal difference',
    'overall_gs': 'Overall goals scored',
    'fair_play': 'Fair play score (yellow/red cards)',
    'ranking': 'FIFA world ranking',
    'random': 'Random selection'
  }
  return labels[type]
}
```

#### S7.T2: FAQ Page Component
**File:** `src/app/wc/rules/page.tsx`

**Features:**
- Load template (FIFA WC 2026)
- Generate FAQ content
- Collapsible accordion sections
- Searchable (optional)
- Anchor links for deep linking

**UI:**
```
World Cup 2026 Rules

▼ Group Stage Tiebreakers
  [content]

▼ Best-Third Qualification
  [content]

▼ Knockout Stages
  [content]

▼ Classifications
  [content]

▼ Scoring Rules
  [content]

▼ Can I change my bracket?
  [content]
```

**Deliverables:**
- `faq-generator.ts` (~150 lines)
- `wc/rules/page.tsx` (~200 lines)

---

## Stream 8: Integration & Pages 🔴 WAVE 4

**Priority:** FINAL INTEGRATION
**Files:** 2 page files + onboarding updates
**Estimated Time:** 4-6 hours
**Dependencies:** ALL OTHER STREAMS (integration point)

### Tasks

#### S8.T1: Bracket Wizard Page
**File:** `src/app/wc/bracket/page.tsx`

**Features:**
- Load FIFA WC 2026 template
- Check for existing submission (resume)
- Render `<BracketWizard>`
- Handle submission to API
- Redirect on completion

**Code:**
```typescript
export default async function BracketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/wc/bracket')
  }

  const template = getTemplate('fifa-world-cup-2026')!

  // Check for existing submission
  const { data: existingSubmission } = await supabase
    .from('bracket_prediction_submissions')
    .select('*')
    .eq('user_id', user.id)
    .eq('competition_id', WC_2026_COMPETITION_ID)
    .single()

  return (
    <div className="max-w-[480px] mx-auto">
      <BracketWizard
        competition={competition}
        template={template}
        existingSubmission={existingSubmission}
        onSubmit={handleSubmit}
        onSaveDraft={handleSaveDraft}
      />
    </div>
  )
}
```

#### S8.T2: Update WC Onboarding Flow
**File:** `src/app/wc/join/page.tsx` (or wherever onboarding lives)

**Changes:**
1. Add "Full Bracket" step after Classifications Overview
2. Show "Want to fill out your bracket now?" prompt
3. [Start Full Bracket] → redirect to `/wc/bracket`
4. [Skip for now] → continue to Format enrollment
5. Save state: user can return to bracket later

**UI Addition:**
```typescript
// After Classifications Overview
<div className="bracket-prompt">
  <h2>Complete Your Bracket?</h2>
  <p>Predict the full tournament now (optional)</p>

  <button onClick={() => router.push('/wc/bracket')}>
    Start Full Bracket
  </button>

  <button variant="ghost" onClick={handleSkip}>
    Skip for now
  </button>
</div>
```

#### S8.T3: Add Bracket Tab to WC Navigation
**File:** `src/app/wc/layout.tsx`

**Add Tab:**
```typescript
<nav>
  <NavLink href="/wc">Dashboard</NavLink>
  <NavLink href="/wc/bracket">My Bracket</NavLink>  {/* NEW */}
  <NavLink href="/wc/leaderboard">Leaderboard</NavLink>
  <NavLink href="/wc/rules">Rules</NavLink>
</nav>
```

**Deliverables:**
- `wc/bracket/page.tsx` (~150 lines)
- Updated onboarding flow (~50 lines added)
- Updated WC layout navigation (~10 lines)

---

## Testing Strategy

### Unit Tests (Per Stream)

**Stream 1 (Engine):**
```typescript
// Test calculateGroupStandings
describe('calculateGroupStandings', () => {
  it('calculates points correctly')
  it('sorts by points')
  it('applies tiebreakers in order')
  it('handles random fallback')
  it('assigns positions 1-4')
})

// Test tiebreaker functions
describe('applyTiebreaker', () => {
  it('sorts by overall GD')
  it('sorts by H2H points')
  it('shows warning for random')
})
```

**Stream 2/3 (Components):**
```typescript
// Test component rendering
describe('GroupMatchPredictor', () => {
  it('renders 6 matches')
  it('updates standings on prediction')
  it('highlights ties')
})
```

### Integration Tests

**After Wave 2:**
- Group predictor → Engine → Standings display
- Knockout predictor → Match selection

**After Wave 3:**
- Wizard → Components → API submission

**After Wave 4:**
- Full user flow: Onboarding → Bracket → Submission

---

## Session Assignment Strategy

### Optimal Parallelization

**Session 1 (Primary - Longest Stream):**
- Stream 1 (Engine) - 6-8 hours

**Session 2 (Parallel with Session 1 end):**
- Stream 2 (Group UI) - 6-8 hours
- Start when Stream 1 is 70% complete

**Session 3 (Parallel with Session 2):**
- Stream 3 (Knockout UI) - 5-7 hours
- Start when Stream 1 is 70% complete

**Session 4 (Quick Win):**
- Stream 6 (R32 Classification) - 3-4 hours
- Can start immediately (light Stream 1 dependency)

**Session 5 (Quick Win):**
- Stream 7 (FAQ) - 3-4 hours
- Can start immediately (minimal dependencies)

**Session 6 (After Wave 2):**
- Stream 4 (Wizard) - 8-10 hours
- Start after Streams 2, 3 complete

**Session 7 (After Wave 2):**
- Stream 5 (APIs) - 4-6 hours
- Start after Stream 1 complete

**Session 8 (Final):**
- Stream 8 (Integration) - 4-6 hours
- After all other streams complete

### Timeline with 3 Concurrent Sessions

**Week 1:**
- Session A: Stream 1 (Engine)
- Session B: Stream 6 (R32 Classification)
- Session C: Stream 7 (FAQ)

**Week 2:**
- Session A: Stream 2 (Group UI)
- Session B: Stream 3 (Knockout UI)
- Session C: Stream 5 (APIs)

**Week 3:**
- Session A: Stream 4 (Wizard)
- Session B: Stream 8 (Integration)

**Total: 3 weeks with 3 concurrent sessions**

---

## Success Criteria

### Per Stream

- ✅ All files created and TypeScript compiles
- ✅ No ESLint errors
- ✅ Exports match expected interfaces
- ✅ Basic unit tests pass
- ✅ Integration points validated

### Overall (Wave 4 Complete)

- ✅ User can complete full bracket wizard
- ✅ Bracket saves as draft at checkpoints
- ✅ Bracket submits successfully to API
- ✅ R32 classification automatically created
- ✅ FAQ page displays template-driven content
- ✅ No breaking changes to existing app
- ✅ FIFA WC 2026 template works end-to-end

---

## File Ownership Matrix

| File | Stream | Dependencies | Conflicts With |
|------|--------|--------------|----------------|
| `engine.ts` | 1 | None | None |
| `GroupMatchPredictor.tsx` | 2 | Stream 1 | None |
| `LiveGroupStandings.tsx` | 2 | Stream 1 | None |
| `ScoreCollector.tsx` | 2 | Stream 1 | None |
| `KnockoutStagePredictor.tsx` | 3 | Stream 1 | None |
| `StageBracketPreview.tsx` | 3 | None | None |
| `BracketReview.tsx` | 3 | Stream 1 | None |
| `BracketWizard.tsx` | 4 | Streams 2, 3 | None |
| `submit/route.ts` | 5 | Stream 1, 4 | None |
| `lock/route.ts` | 5 | Stream 1 | None |
| `status/route.ts` | 5 | None | None |
| `r32-classification.ts` | 6 | Stream 1 | None |
| `R32Leaderboard.tsx` | 6 | None | None |
| `faq-generator.ts` | 7 | None | None |
| `wc/rules/page.tsx` | 7 | Stream 7 | None |
| `wc/bracket/page.tsx` | 8 | Streams 4, 5 | None |
| `wc/join/page.tsx` | 8 | Stream 4 | Possible* |
| `wc/layout.tsx` | 8 | None | Possible* |

**Possible conflicts:* If another session modifies WC onboarding/layout concurrently

---

## Communication Protocol

### For Each Session

**Starting Work:**
```markdown
Starting Stream [N]: [Stream Name]
Files: [list of files this session will create/modify]
Dependencies: [list of other streams needed]
ETA: [hours]
```

**Progress Updates:**
```markdown
Stream [N] Progress: [X]% complete
Completed: [list of completed tasks]
In Progress: [current task]
Blocked: [any blockers]
```

**Completion:**
```markdown
Stream [N] Complete ✅
Deliverables: [list of files created]
Integration Points: [exports provided]
Tests: [test coverage]
Ready for: [dependent streams]
```

### Integration Checkpoints

**After Wave 1:**
- Verify Stream 1 exports work as expected
- Test calculateGroupStandings with sample data
- Confirm tiebreaker system works

**After Wave 2:**
- Test Group UI → Engine integration
- Test Knockout UI → Engine integration
- Confirm all components render correctly

**After Wave 3:**
- Test full wizard flow
- Test API submission
- Verify checkpoint save/resume

**After Wave 4:**
- E2E test: complete bracket wizard
- Verify R32 classification generates
- Confirm FAQ page renders

---

## Known Risks & Mitigations

### Risk 1: Stream 1 Blocks Everything
**Mitigation:** Prioritize Stream 1, assign to most experienced session

### Risk 2: Integration Conflicts in Wave 4
**Mitigation:** Stream 8 waits for all others, single session owns integration

### Risk 3: Type Mismatches Between Streams
**Mitigation:** All streams use shared types from `types.ts`, no local type definitions

### Risk 4: Wizard State Management Complex
**Mitigation:** Stream 4 is single-session task, well-defined state structure

### Risk 5: Database Schema Changes Needed
**Mitigation:** Schema already designed, migrations written in parallel if needed

---

## Next Steps

1. **Assign streams to sessions** based on availability and expertise
2. **Start Stream 1 immediately** (blocks Wave 2)
3. **Start Streams 6, 7 in parallel** (quick wins)
4. **Launch Wave 2** when Stream 1 is 70% complete
5. **Launch Wave 3** when Wave 2 completes
6. **Final integration** (Wave 4) when all streams ready

**Ready to begin parallel execution! 🚀**
