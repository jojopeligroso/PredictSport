# WC-H1 Integration Guide - Next Steps

**Quick Start:** 3-4 hour implementation to complete Phases 3-4

---

## Current State

✅ **Test Page Works:** `http://localhost:3000/wc/bracket/test`
❌ **Main Wizard Needs Update:** `http://localhost:3000/wc/bracket`

The V2 components are production-ready but not integrated with the main wizard yet.

---

## Integration Tasks (Priority Order)

### Task 1: Create Data Adapter (30 min)

**File:** `src/lib/tournament/bracket/adapters/v2-to-legacy.ts`

```typescript
import { GroupData, MatchPrediction, GroupPredictionData } from '../types'

/**
 * Convert V2 format to legacy API format
 */
export function convertV2ToLegacy(groups: GroupData[]): GroupPredictionData[] {
  return groups.map(group => ({
    group_id: group.group_id,
    team_names: group.teams || [],
    match_predictions: (group.matches || []).map(m => ({
      match_id: m.match_id,
      home_team: m.home_team,
      away_team: m.away_team,
      outcome: resultToOutcome(m.result),
      home_score: m.exact_score?.home_score ?? m.home_score,
      away_score: m.exact_score?.away_score ?? m.away_score,
    })),
    standings: group.standings,
  }))
}

function resultToOutcome(result: string | null): 'home' | 'draw' | 'away' {
  if (result === 'home_win') return 'home'
  if (result === 'away_win') return 'away'
  if (result === 'draw') return 'draw'
  return 'home' // Default fallback
}

/**
 * Convert legacy format to V2 format (for loading existing data)
 */
export function convertLegacyToV2(groups: GroupPredictionData[]): GroupData[] {
  return groups.map(group => ({
    group_id: group.group_id,
    group_name: `Group ${group.group_id}`,
    teams: group.team_names,
    matches: (group.match_predictions || group.predictions || []).map(m => ({
      match_id: m.match_id,
      home_team: m.home_team,
      away_team: m.away_team,
      result: outcomeToResult(m.outcome),
      exact_score: m.home_score !== undefined && m.away_score !== undefined
        ? { home_score: m.home_score, away_score: m.away_score }
        : undefined,
    })),
    has_tiebreaker_scores: false,
  }))
}

function outcomeToResult(outcome: 'home' | 'draw' | 'away'): 'home_win' | 'draw' | 'away_win' | null {
  if (outcome === 'home') return 'home_win'
  if (outcome === 'away') return 'away_win'
  if (outcome === 'draw') return 'draw'
  return null
}
```

---

### Task 2: Update API Routes (45 min)

**File:** `src/app/api/bracket/submit/route.ts`

Add format detection and conversion:

```typescript
import { convertV2ToLegacy } from '@/lib/tournament/bracket/adapters/v2-to-legacy'

export async function POST(request: Request) {
  const body = await request.json()
  const { classificationId, competitionId, bracketData, action } = body

  // Detect V2 format
  const isV2Format = bracketData.groups?.[0]?.matches !== undefined

  // Convert if needed
  let normalizedGroups
  if (isV2Format) {
    console.log('[API] Detected V2 format, converting to legacy...')
    normalizedGroups = convertV2ToLegacy(bracketData.groups)
  } else {
    normalizedGroups = bracketData.groups
  }

  // Continue with existing save logic using normalizedGroups
  const submissionData = {
    ...bracketData,
    groups: normalizedGroups,
  }

  // ... rest of save logic
}
```

**File:** `src/app/api/bracket/status/route.ts`

Return format indicator:

```typescript
export async function GET(request: Request) {
  // ... fetch submission from DB

  return NextResponse.json({
    hasSubmission: !!submission,
    submissionId: submission?.id,
    locked: submission?.locked,
    format: submission?.bracket_data?.groups?.[0]?.matches ? 'v2' : 'legacy',
    lastCheckpoint: submission?.updated_at,
    completionPercentage: calculateCompletion(submission?.bracket_data),
  })
}
```

---

### Task 3: Update BracketWizard State (60 min)

**File:** `src/components/tournament/bracket/BracketWizard.tsx`

Replace group rankings with group predictions:

```typescript
// Old state:
const [groupRankings, setGroupRankings] = useState<Record<string, string[]>>({})

// New state:
const [groupsData, setGroupsData] = useState<GroupData[]>(
  existingData?.groupsV2 ?? buildInitialGroups()
)
const [tiebreakerContext, setTiebreakerContext] = useState<{
  groupIndex: number
  teams: string[]
} | null>(null)

// Add tiebreaker step
type Step = "groups" | "tiebreaker" | "review_r32" | "knockout" | "champion" | "review"

// Initialize groups data
function buildInitialGroups(): GroupData[] {
  return WC2026_GROUPS.map(g => ({
    group_id: g.groupId,
    group_name: `Group ${g.groupId}`,
    teams: g.teams.map(t => t.name),
    matches: generateGroupMatches(g.teams.map(t => t.name)),
    has_tiebreaker_scores: false,
  }))
}

function generateGroupMatches(teams: string[]): MatchPrediction[] {
  const matches: MatchPrediction[] = []
  let matchNum = 0

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchNum++
      matches.push({
        match_id: `match-${matchNum}`,
        home_team: teams[i],
        away_team: teams[j],
        result: null,
      })
    }
  }

  return matches
}
```

---

### Task 4: Replace GroupRankingStep (45 min)

**File:** `src/components/tournament/bracket/BracketWizard.tsx`

```typescript
// Import V2 components
import GroupResultsStepV2, { GroupData } from './GroupResultsStepV2'
import TiebreakerResolutionPage from './TiebreakerResolutionPage'

// In render:
{currentStep === "groups" && (
  <GroupResultsStepV2
    groups={groupsData}
    pickColor="green"
    onUpdate={handleGroupsUpdate}
    onGroupComplete={handleGroupComplete}
    onTiebreakerNeeded={handleTiebreakerNeeded}
  />
)}

{currentStep === "tiebreaker" && tiebreakerContext && (
  <TiebreakerResolutionPage
    group={groupsData[tiebreakerContext.groupIndex]}
    tiedTeams={tiebreakerContext.teams}
    onResolve={handleTiebreakerResolved}
    onBack={() => {
      setCurrentStep("groups")
      setTiebreakerContext(null)
    }}
  />
)}

// Handlers
function handleGroupsUpdate(updated: GroupData[]) {
  setGroupsData(updated)
  // Trigger auto-save
  saveDraft()
}

function handleGroupComplete(groupId: string) {
  console.log(`Group ${groupId} complete`)
  // Could show toast notification
}

function handleTiebreakerNeeded(groupIndex: number, tiedTeams: string[]) {
  setTiebreakerContext({ groupIndex, teams: tiedTeams })
  setCurrentStep("tiebreaker")
}

function handleTiebreakerResolved(updatedGroup: GroupData) {
  const updated = [...groupsData]
  if (tiebreakerContext) {
    updated[tiebreakerContext.groupIndex] = updatedGroup
  }
  setGroupsData(updated)
  setCurrentStep("groups")
  setTiebreakerContext(null)
}
```

---

### Task 5: Auto-Calculate Best Thirds (30 min)

**File:** `src/components/tournament/bracket/BracketWizard.tsx`

Remove `BestThirdsStep`, calculate automatically:

```typescript
// Import helper
import { rankThirdPlaceTeams } from './ThirdPlaceRankingStep'

// Remove from steps array
const FULL_STEPS: Step[] = ["groups", "tiebreaker", "review_r32", "knockout", "champion", "review"]

// Calculate when all groups complete
function handleAllGroupsComplete() {
  // Extract all third-place teams
  const thirdPlaceTeams = groupsData
    .map(group => {
      const standings = calculateGroupStandings(group)
      return standings.find(t => t.position === 3)
    })
    .filter(Boolean)

  // Rank by FIFA rules
  const ranked = rankThirdPlaceTeams(thirdPlaceTeams)

  // Take top 8
  const top8 = ranked.slice(0, 8).map(t => t.name)

  setBestThirdPicks(top8)
  setCurrentStep("review_r32")
}

// Add to Continue button handler in GroupResultsStepV2
// (or create a "Review Groups" step before R32)
```

---

### Task 6: Update saveDraft (15 min)

```typescript
const saveDraft = useCallback(async () => {
  setSaving(true)
  setSubmitError(null)
  try {
    const data = {
      groupsV2: groupsData, // Save V2 format
      bestThirdPicks,
      knockoutPicks,
      champion,
      thirdPlace: thirdPlace || undefined,
    }

    const res = await fetch("/api/tournament/bracket/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classificationId,
        competitionId,
        bracketData: data,
        action: "save_draft",
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setSubmitError(err.error ?? "Failed to save draft")
    }
  } catch {
    setSubmitError("Network error")
  } finally {
    setSaving(false)
  }
}, [groupsData, bestThirdPicks, knockoutPicks, champion, thirdPlace, classificationId, competitionId])
```

---

## Testing Checklist

After completing integration:

### Smoke Tests:
- [ ] `/wc/bracket` loads without errors
- [ ] Can navigate through all groups
- [ ] Tiebreaker page appears when needed
- [ ] Can enter scores on tiebreaker page
- [ ] Returns to groups after resolving tiebreaker
- [ ] Auto-save triggers (check network tab)
- [ ] Draft saved to DB (check Supabase)
- [ ] Can reload page and resume

### Edge Cases:
- [ ] Enter all groups without tiebreakers → best thirds auto-calculated
- [ ] Create 3-way tie → H2H tiebreaker logic works
- [ ] Enter scores proactively → retained when tiebreaker triggered
- [ ] Navigate back mid-wizard → state preserved
- [ ] Network error during save → error displayed
- [ ] Concurrent edit (two tabs) → last write wins (acceptable for MVP)

### Regression Tests:
- [ ] Legacy brackets still load correctly
- [ ] Knockout stages still work
- [ ] Champion selection still works
- [ ] Review & submit still works
- [ ] Locked brackets can't be edited

---

## Rollback Plan

If integration fails, rollback is simple:

```bash
# Revert to legacy components
git revert HEAD~2  # Reverts Phase 2 commit
git revert HEAD~2  # Reverts Phase 1 commit

# Or create new commit reverting changes:
git checkout 7218b72~1 src/components/tournament/bracket/BracketWizard.tsx
git commit -m "chore: rollback to legacy bracket wizard"
```

Legacy wizard will continue to work - V2 components are additive, not destructive.

---

## Performance Considerations

### Current Auto-Save:
- **Debounce:** 500ms after last user action
- **Payload:** Full `groupsData` array (~50KB)
- **Frequency:** Every match prediction (~72 saves for full bracket)

### Optimization Options (if needed):
1. **Delta sync:** Send only changed group, not all groups
2. **Increase debounce:** 1000ms instead of 500ms
3. **Batch saves:** Save every N predictions instead of every prediction
4. **LocalStorage primary:** Save to server only on checkpoint (every group complete)

### Current Performance: Acceptable for MVP
- Test page auto-save works smoothly
- No lag or jank during predictions
- localStorage backup ensures no data loss

---

## FAQs

### Q: Why not replace legacy format entirely?
**A:** Existing brackets in DB use legacy format. Migration would require data transformation and rollback plan.

### Q: Can we run both formats in parallel?
**A:** Yes! That's the design. API detects format and converts as needed.

### Q: What if server validation fails?
**A:** Client-side validation prevents invalid submissions. If server rejects, show error and keep draft.

### Q: How do we handle localStorage vs. DB conflicts?
**A:** Server is source of truth. On load, fetch from server first. LocalStorage is backup only.

### Q: Will this break existing user brackets?
**A:** No. Legacy brackets load via `convertLegacyToV2()`. New brackets save as V2.

---

## Success Metrics

After deployment:

1. **Completion Rate:** % of users who finish bracket vs. abandon
2. **Time to Complete:** Minutes from start to submit (expect 40% faster with V2)
3. **Error Rate:** % of submissions that fail validation
4. **Support Tickets:** User confusion about tiebreakers (expect 60% reduction)
5. **Mobile vs. Desktop:** Usage split (expect 70% mobile with V2)

---

## Next Session Agenda (3-4 hours)

1. **Hour 1:** Create adapter + update API routes
2. **Hour 2:** Update BracketWizard state management
3. **Hour 3:** Replace components + test integration
4. **Hour 4:** Fix bugs, polish, deploy

**Goal:** Ship V2 to production by end of session.

---

**Document Version:** 1.0
**Last Updated:** 2026-05-21 16:40 UTC
**Prerequisites:** Complete WC-H1-IMPLEMENTATION-SUMMARY.md first
