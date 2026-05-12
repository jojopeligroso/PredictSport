# Round Builder Improvements — Two-Phase Plan

**Created:** 2026-05-12
**Context:** Fixing UX issue where all 8 prediction types shown for Team A vs Team B fixtures, causing confusion (Top N, Progression, Winner don't apply to 2-team matches).

---

## Phase 1: Smart Filtering (30-45 mins, low risk)

**Goal:** Filter prediction types based on fixture structure (2-team vs multi-competitor).

### Tasks

**1.1** Add helper function `getValidPredictionTypes()`
- File: `src/app/admin/components/RoundBuilder.tsx`
- Location: After line 190 (after `buildDefaultPredictionTypes`)
- Logic:
  ```typescript
  function getValidPredictionTypes(fixture: SearchResult): PredictionTypeName[] {
    const isTwoTeam = !!(fixture.homeTeam && fixture.awayTeam);

    if (isTwoTeam) {
      // Head-to-head sports (rugby, soccer, GAA, NFL, NBA, etc.)
      return ['head_to_head', 'margin', 'over_under', 'handicap', 'yes_no'];
    } else {
      // Multi-competitor sports (F1, golf, tournaments)
      return ['winner', 'top_n', 'final_standings', 'progression', 'yes_no'];
    }
  }
  ```

**1.2** Update "Apply to all" section in Step2Configure
- File: `src/app/admin/components/RoundBuilder.tsx`
- Lines: 582-638 (grid of prediction type checkboxes)
- Change: Filter `ALL_PREDICTION_TYPES` to only show valid types
- Logic:
  ```typescript
  // Add after line 446 (in Step2Configure function)
  const validTypes = useMemo(() => {
    if (fixtureConfigs.length === 0) return ALL_PREDICTION_TYPES;
    // Use first fixture as reference for detecting event type
    return getValidPredictionTypes(fixtureConfigs[0].fixture);
  }, [fixtureConfigs]);

  // Then replace ALL_PREDICTION_TYPES with validTypes in:
  // - Line 583: {ALL_PREDICTION_TYPES.map((t) => { ... }
  // - Line 573: const activeGlobalTypes = ALL_PREDICTION_TYPES.filter(...)
  ```

**1.3** Update per-fixture override section
- File: `src/app/admin/components/RoundBuilder.tsx`
- Lines: 722-777 (per-fixture customisation grid)
- Change: Filter to valid types per fixture
- Logic:
  ```typescript
  // Line 722, replace ALL_PREDICTION_TYPES with:
  const fixtureValidTypes = getValidPredictionTypes(fc.fixture);
  {fixtureValidTypes.map((t) => { ... }
  ```

**1.4** Update initialisation logic
- File: `src/app/admin/components/RoundBuilder.tsx`
- Lines: 450-465 (initial globalTypes state)
- Change: Only enable valid types by default
- Logic:
  ```typescript
  const validTypes = useMemo(() => { ... }); // from 1.2

  const [globalTypes, setGlobalTypes] = useState<...>(() => {
    const first = fixtureConfigs[0];
    const allowedTypes = first ? getValidPredictionTypes(first.fixture) : ALL_PREDICTION_TYPES;

    if (!first) {
      return allowedTypes.reduce(
        (acc, t) => ({ ...acc, [t]: defaultPoints[t] > 0 }),
        {} as Record<PredictionTypeName, boolean>
      );
    }
    // ... rest of logic
  });
  ```

**1.5** Test with mixed fixtures
- Manually test:
  - All rugby fixtures → should show only H2H, margin, O/U, handicap, yes/no
  - All F1 races → should show only winner, top_n, standings, progression, yes/no
  - Mixed rugby + F1 → should show all types (fallback to full list)

**1.6** Add sport-specific draw logic
- File: `src/app/admin/components/RoundBuilder.tsx`
- Add helper:
  ```typescript
  function allowsDraws(sport: string): boolean {
    const drawSports = ['soccer', 'rugby', 'gaa', 'hockey', 'nhl'];
    return drawSports.includes(sport.toLowerCase());
  }
  ```
- Use in head_to_head config auto-population (future enhancement)

### Review, Assessment & Verification Tasks

**1.7** Code review of smart filtering logic
- Review `getValidPredictionTypes()` implementation
- Verify TypeScript types are correct
- Check edge cases:
  - What if `homeTeam` is set but `awayTeam` is null?
  - What if both are empty strings?
  - What if fixture has 3+ participants (future expansion)?
- Verify function location doesn't break existing code flow
- Check for any console warnings/errors in browser

**1.8** Verify prediction type mappings are correct
- Cross-reference with `SPEC.md` §6:
  - **2-team types:** head_to_head ✓, margin ✓, over_under ✓, handicap ✓, yes_no ✓
  - **Multi-competitor types:** winner ✓, top_n ✓, final_standings ✓, progression ✓, yes_no ✓
- Confirm `yes_no` appears in both (generic type, applies to all)
- Verify no prediction type is accidentally excluded
- Check SPEC.md for any type applicability notes we missed

**1.9** Test with real URC fixtures
- Navigate to admin panel
- Click "Create Round"
- Select URC rugby fixtures (Cardiff vs Stormers, etc.)
- **Verify in Step 2:**
  - Only 5 checkboxes visible (not 8)
  - Types shown: Head to Head, Margin, Over/Under, Handicap, Yes/No
  - Types hidden: Winner, Top N, Progression
  - Default checkboxes match competition scoring rules
- Try selecting "Head to Head" and assigning 5 points
- Continue to Step 3, verify payload looks correct

**1.10** Test with F1 fixtures (multi-competitor)
- In same round builder, clear rugby fixtures
- Search for F1 races (if available in fixture browser)
- **Verify in Step 2:**
  - Only 5 checkboxes visible
  - Types shown: Winner, Top N, Final Standings, Progression, Yes/No
  - Types hidden: Head to Head, Margin, Over/Under, Handicap
- Continue to Step 3, verify payload

**1.11** Test mixed fixture scenario
- Select 2 URC rugby matches + 1 F1 race (if possible)
- **Expected behavior:**
  - Falls back to showing ALL_PREDICTION_TYPES (all 9)
  - Reason: Mixed event types, can't smart-filter
  - Verify this is intentional in code (task 1.2 logic)
- Alternative: Show intersection or union? (Design decision)
- Document actual behavior observed

**1.12** Test per-fixture override customization
- In Step 2, expand one fixture
- **Verify:**
  - Same filtered types appear (not all 9)
  - Can toggle types on/off
  - Can customize points
  - "Reset to global" button works
  - Custom fixture shows correct badge
- Test with both rugby and F1 fixtures

**1.13** Regression testing
- Test existing round creation flow still works:
  - Create round with just Winner type (F1 race)
  - Create round with just Head to Head (rugby match)
  - Create round with multiple types enabled
  - Verify all rounds save successfully to database
  - Check API response has correct `event_prediction_types` rows

**1.14** Browser console & network inspection
- Open browser DevTools
- Monitor Console tab for errors/warnings during:
  - Fixture selection (Step 1)
  - Type configuration (Step 2)
  - Round creation (Step 3)
- Monitor Network tab:
  - Verify POST to `/api/admin/rounds` has correct payload
  - Check `prediction_type_configs` array structure
  - Confirm no 400/500 errors
  - Verify response includes created round + events

**1.15** Accessibility check
- Keyboard navigation:
  - Tab through prediction type checkboxes
  - All focusable?
  - Visible focus indicators?
- Screen reader test (basic):
  - Checkboxes have labels?
  - ARIA attributes correct?
  - No unlabeled controls?

**1.16** Performance check
- With 10+ fixtures selected:
  - Step 2 renders quickly? (<1s)
  - No lag when toggling types?
  - `useMemo` optimizations working?
  - React DevTools Profiler: any unnecessary re-renders?

**1.17** Documentation review
- Re-read `ROUND-BUILDER-IMPROVEMENTS.md` Phase 1
- Confirm all tasks completed
- Update any outdated assumptions
- Note any edge cases discovered during testing
- Document any deviations from plan

**1.18** Final checklist before Phase 2
- [ ] All 6 implementation tasks (1.1-1.6) complete
- [ ] All 12 verification tasks (1.7-1.18) complete
- [ ] No console errors
- [ ] No TypeScript errors (`npm run build` succeeds)
- [ ] URC rugby fixtures show 5 types
- [ ] F1 fixtures show 5 types (different set)
- [ ] API payload correct, round creates successfully
- [ ] Git committed with descriptive message
- [ ] Ready to proceed to Phase 2 (or iterate on Phase 1 findings)

### Success Criteria
- ✅ Rugby fixtures show 5 types (not 8)
- ✅ F1 races show 5 types (different 5)
- ✅ No regression in mixed fixture scenarios
- ✅ Existing functionality unchanged
- ✅ All verification tasks pass
- ✅ No console errors or TypeScript warnings
- ✅ Round creation works end-to-end with real fixtures

### Files Modified
- `src/app/admin/components/RoundBuilder.tsx` (lines 190-805)

### Reference Docs
- `SPEC.md` §6 — Prediction Types (defines all 9 types, their applicability)
- `CLAUDE.md` lines 42-48 — Lists all 9 prediction types
- `src/types/database.ts` — PredictionType union type

---

## Phase 2: Card-Based UI (4-5 hours, higher complexity)

**Goal:** Replace checkbox grid with progressive disclosure cards that guide users through predictions.

### Tasks

**2.1** Design card component structure
- File: Create `src/app/admin/components/PredictionCards.tsx`
- Components:
  - `PrimaryOutcomeCard` — Required: HOME/DRAW/AWAY or Winner picker
  - `ScoringPredictionsCard` — Optional: Margin, O/U, Handicap (collapsible)
  - `YesNoCard` — Optional: Custom yes/no question (collapsible)
  - `PredictionCardContainer` — Wrapper with expand/collapse state

**2.2** Create new state model
- File: `src/app/admin/components/RoundBuilder.tsx`
- Add interfaces:
  ```typescript
  interface CardBasedPredictionState {
    primaryOutcome: {
      type: 'head_to_head' | 'winner';
      points: number;
      config: { options?: string[], allow_draw?: boolean };
    };
    scoringPredictions: {
      margin?: { enabled: boolean, points: number, partialPoints?: number };
      over_under?: { enabled: boolean, points: number, line?: number };
      handicap?: { enabled: boolean, points: number, value?: number };
    };
    yesNo?: {
      enabled: boolean;
      question?: string;
      points: number;
    };
  }
  ```

**2.3** Build PrimaryOutcomeCard component
- Features:
  - For 2-team: Three large buttons (HOME / DRAW / AWAY)
  - Auto-populate team names from `fixture.homeTeam`, `fixture.awayTeam`
  - Show/hide DRAW based on sport (use `allowsDraws()` helper)
  - For multi-competitor: Dropdown or radio list
  - Points input (defaults from scoring rules)
- UX: Always visible, always required
- Styling: Match existing ps-* tokens, amber accent for selection

**2.4** Build ScoringPredictionsCard component
- Features:
  - Collapsible card (starts collapsed)
  - Three checkboxes: Margin, Over/Under, Handicap
  - When checked, reveal:
    - Points input
    - Config input (margin threshold, O/U line, handicap value)
  - Optional: Fetch suggested O/U line from fixture data
- UX: Optional, only show for 2-team fixtures
- Styling: Subtle border, expand icon rotates

**2.5** Build YesNoCard component
- Features:
  - Collapsible card (starts collapsed)
  - Enable checkbox
  - When checked:
    - Question text input (e.g., "Will there be a red card?")
    - Points input
- UX: Optional, available for all fixture types
- Styling: Match ScoringPredictionsCard

**2.6** Refactor Step2Configure to use cards
- File: `src/app/admin/components/RoundBuilder.tsx`
- Replace lines 439-805 (entire Step2Configure function)
- New flow:
  1. "Apply to all" section → Card config UI
  2. Per-fixture list → Show card summaries, expand to override
  3. Transform cards → `PredictionTypeConfig[]` for existing API
- Keep backward compatibility: Still output same `fixtureConfigs` structure

**2.7** Add auto-population for head_to_head config
- Logic:
  ```typescript
  // When building primary outcome card for 2-team fixture:
  if (fixture.homeTeam && fixture.awayTeam) {
    config = {
      options: [fixture.homeTeam, fixture.awayTeam],
      allow_draw: allowsDraws(fixture.sport),
      draw_points: defaultPoints.head_to_head // from scoring rules
    };
  }
  ```
- Location: Step3Review when building API payload (lines 849-869)
- Update API payload transformation to include full config

**2.8** Add validation
- Primary outcome must be selected
- If margin enabled, threshold must be > 0
- If O/U enabled, line must be valid number
- If yes/no enabled, question text required
- Show inline errors, disable "Next" if invalid

**2.9** Add "Show all types" escape hatch
- Toggle at top of Step2Configure
- If enabled, ignore smart filtering and show all 9 types
- Use case: Edge cases where admin wants Top N for a 2-team event
- Default: Off (smart filtering on)

**2.10** Mobile optimization
- Cards stack vertically on mobile
- Team buttons go vertical if names are long
- Collapsible sections reduce scroll on small screens
- Touch-friendly tap targets (min 44px)

**2.11** Update fixture summary display
- In Step2 per-fixture list (collapsed state)
- Show card icons: "🏉 H2H (5pts) + 📊 O/U (3pts)" instead of type badges
- Clearer at-a-glance view

**2.12** Write tests
- Test smart filtering logic with fixtures
- Test card state → API transformation
- Test validation rules
- Test mobile responsiveness

### Success Criteria
- ✅ Cards visually clearer than checkbox grid
- ✅ Team names auto-populate in head-to-head
- ✅ Faster to configure common case (just pick winner)
- ✅ Advanced options available but not overwhelming
- ✅ Mobile-friendly
- ✅ No breaking changes to API contract

### Files Created/Modified
- **Created:** `src/app/admin/components/PredictionCards.tsx` (~400 lines)
- **Modified:** `src/app/admin/components/RoundBuilder.tsx` (lines 439-805 replaced, ~500 lines changed)
- **Modified:** `src/app/api/admin/rounds/route.ts` (add config auto-population if needed)

### Reference Docs
- `docs/DESIGN-BRIEF-ROUND-BUILDER.md` — Original design intent
- `SPEC.md` §6 — Prediction type definitions, config structure
- `SPEC.md` §6 H2H section — Draw handling, config schema
- `design/README.md` — Brand tokens (ps-amber, ps-chip, etc.)
- `CLAUDE.md` lines 100-120 — Design system reference

---

## Document Sync Verification

**Current uncommitted changes:**
```
M src/app/admin/components/RoundBuilder.tsx
```

**Critical docs to sync across devices:**
- ✅ `CLAUDE.md` — Project overview, last updated 2026-05-12
- ✅ `SPEC.md` — Single source of truth, §6 prediction types, §15 punch list
- ✅ `todos.md` — All P0-P2 items complete, post-launch items remain
- ✅ This file: `ROUND-BUILDER-IMPROVEMENTS.md` (new, created today)

**Before starting work on another device:**
1. Commit current fix: `git add . && git commit -m "fix: correct prediction_type_configs payload in RoundBuilder"`
2. Push: `git push`
3. On other device: `git pull`
4. Verify `ROUND-BUILDER-IMPROVEMENTS.md` exists
5. Run `/PredictSport-next-task` to load Phase 1 context

**Phase dependencies:**
- Phase 1 is **independent** — can start immediately
- Phase 2 **requires** Phase 1 complete — builds on smart filtering logic
- Both phases reference same docs (SPEC.md §6, CLAUDE.md design system)

---

## Next Steps

1. **Commit current bug fix** (prediction_type_configs payload)
2. **Push to sync devices**
3. **On clean device:** Pull latest, verify docs synced
4. **Start Phase 1:** `/PredictSport-next-task` will load this file
5. **After Phase 1:** Test with real URC fixtures, iterate
6. **Decision point:** Evaluate Phase 1 UX before committing to Phase 2
7. **If proceeding to Phase 2:** Create feature branch, implement cards, test thoroughly

**Estimated timeline:**
- Phase 1: 60-90 mins (30-45 impl + 30-45 verify)
- Phase 2: 4-5 hours (2-3 sessions, includes testing)
- Total: ~6-7 hours for Phases 1-2

**Related improvements (see `MANUAL-EVENTS-AND-API-GAPS.md`):**
- Phase 3: Manual Event Management (3-4 hours, independent)
- Phase 4: Sports API Coverage Analysis (2-3 hours, independent)
- **Grand total: ~15-18 hours across all 4 phases**
