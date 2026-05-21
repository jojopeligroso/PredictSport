# Football WC 2026 Bracket Prediction - Design Brief

**Last Updated**: 2025-05-21
**Status**: Ready for UI/UX design implementation
**Designer Agent**: Use this document as your complete design specification

---

## Context & Core Philosophy

Users predict FIFA World Cup 2026 bracket outcomes through a **lightweight, mobile-first, color-driven** interface. The experience prioritizes:

1. **Minimal cognitive load**: Users make ~90-100 decisions (not 80+ score inputs)
2. **Visual clarity over text**: Color signals selection state, not labels
3. **Progressive disclosure**: Show complexity only when needed (tiebreakers, scores)
4. **Personalization**: Users customize "my pick color" during onboarding - reinforces ownership
5. **Mobile-first**: 390px (iPhone 14) primary target, desktop secondary

---

## User Journey Overview

### Phase 1: Group Stage Predictions (12 groups × 6 matches = 72 decisions)

**Per Group Flow**:
1. User sees 6 match cards (compact, scannable)
2. For each match, user taps team name to select winner OR "Draw"
3. System calculates standings in real-time
4. If tiebreaker detected → "Continue" button appears
5. User taps "Continue" → moves to **Tiebreaker Resolution Page** (separate step)
6. After resolving tiebreakers → returns to group list
7. Repeat for all 12 groups

### Phase 2: Third-Place Ranking (1 step)

**After all groups complete**:
1. System extracts 12 third-place teams
2. Ranks by Points → GD → GS (FIFA Article 42.3)
3. If tied on points → triggers score collection
4. User enters exact scores for ONLY the 3 matches that team played
5. System re-ranks → top 8 qualify for R32

### Phase 3: Knockout Stage (separate flow, not in scope for this document)

---

## Design Requirements: Group Stage Match Cards

### Core Layout

**Match Card Structure** (compact, single row per match):

```
┌─────────────────────────────────────────────────┐
│ [France]  vs  [Denmark]  [D]                    │
│   Selected   Neutral    Neutral                 │
│                                                  │
│ ⋮ Exact score (collapsed)                       │
└─────────────────────────────────────────────────┘
```

**When user hasn't selected anything**:
- Both team names appear in **neutral color** (ps-text-sec)
- "D" button for Draw appears in neutral color
- All three are equally weighted visually

**When user selects France**:
- "France" changes to **user's pick color** (customizable, default ps-amber or ps-green)
- "Denmark" and "D" remain neutral
- Visual hierarchy: Selected name is prominent

**When user selects Draw**:
- "D" changes to **user's pick color**
- Both team names remain neutral

### Button Behavior

**Team Name Buttons**:
- Tappable text (not labeled "Home Win" / "Away Win")
- No visual button chrome when unselected (looks like text)
- When selected: color changes + optional subtle background (ps-green/20 or ps-amber/20)
- Large tap target (min 44px height for mobile)
- Team names should be **short** (e.g., "France" not "France National Team")

**Draw Button**:
- Single letter "D" or word "Draw"
- Same visual treatment as team names
- Centered between team names (visually balances)

**Interaction**:
- Tap any option → immediately selected
- Tap same option again → deselects (returns to null)
- Tap different option → switches selection
- Auto-save triggers 500ms after selection (debounced)
- No "Save" button per match

### Exact Score Section

**Default State**: Collapsed, minimal visibility
```
┌─────────────────────────────────────────────────┐
│ [France]  vs  [Denmark]  [D]                    │
│                                                  │
│ ⋮ Exact score                                   │
└─────────────────────────────────────────────────┘
```

**When user taps "⋮ Exact score"**: Expands inline
```
┌─────────────────────────────────────────────────┐
│ [France]  vs  [Denmark]  [D]                    │
│                                                  │
│ ▾ Exact score                                   │
│ France [2] - [1] Denmark                        │
│ (Optional: Used for tiebreakers)                │
└─────────────────────────────────────────────────┘
```

**Important**:
- Exact score is **optional** unless tiebreaker detected
- User can expand and enter score proactively
- If entered, system validates score matches result (2-1 = France win ✓)
- If tiebreaker needed, system uses pre-entered score (no re-entry)

---

## Design Requirements: Tiebreaker Resolution Flow

### Trigger Condition

After user completes all 6 matches in a group:
- System calculates standings
- If 2+ teams tied on points → tiebreaker detected
- **Continue button appears at bottom** (no inline error message)

### Continue Button State

**When tiebreaker detected**:
```
┌─────────────────────────────────────────────────┐
│                                                 │
│  [Continue to Group B]                          │
│  ⚠️ Tiebreaker needed for Group A               │
│                                                 │
└─────────────────────────────────────────────────┘
```

**When no tiebreaker**:
```
┌─────────────────────────────────────────────────┐
│                                                 │
│  [Continue to Group B]                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

**User taps Continue**:
- If tiebreaker exists → Navigate to **Tiebreaker Resolution Page**
- If no tiebreaker → Navigate to next group

---

## Design Requirements: Tiebreaker Resolution Page

**This is a SEPARATE page/step**, not inline in the group view.

### Layout

```
┌─────────────────────────────────────────────────┐
│ ← Back to Groups                                │
│                                                 │
│ ⚠️ Tiebreaker Needed: Group A                   │
│                                                 │
│ Denmark and Peru are tied on 4 points.         │
│ Enter exact scores for their matches to break  │
│ the tie using Goal Difference and Goals Scored. │
│                                                 │
│ ─────────────────────────────────────────────   │
│                                                 │
│ Denmark's Matches:                              │
│ France [3] - [1] Denmark                        │
│ Denmark [0] - [0] Peru                          │
│ Denmark [2] - [1] Australia                     │
│                                                 │
│ Peru's Matches:                                 │
│ France [2] - [0] Peru                           │
│ Denmark [0] - [0] Peru                          │
│ Peru [1] - [1] Australia                        │
│                                                 │
│ [Resolve Tiebreaker]                            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Key Features

**Messaging**:
- Clear warning: "⚠️ Tiebreaker Needed: Group [X]"
- Explain which teams are tied
- Explain why scores are needed (GD/GS calculation)

**Score Entry**:
- Show ALL matches for each tied team (3 matches per team)
- Score inputs appear inline (not collapsed here)
- Validate score matches previously predicted result
- If user already entered score in Group view → pre-fill here

**Navigation**:
- "Back to Groups" → returns to group view (scores saved as draft)
- "Resolve Tiebreaker" → validates all scores → returns to group view
- Continue button on group view remains disabled until tiebreaker resolved

---

## Design Requirements: Third-Place Ranking Step

**After all 12 groups complete**:
- User advances to "Third-Place Ranking" step
- Shows 12 third-place teams ranked by Points → GD → GS
- Top 8 qualify for R32 (highlighted in green)
- If teams tied on points → score collection triggered

### Layout

```
┌─────────────────────────────────────────────────┐
│ Third-Place Team Ranking                        │
│ Top 8 advance to Round of 32                    │
│                                                 │
│ 1. ✅ France (Group A)        6 pts | +3 GD    │
│ 2. ✅ Brazil (Group B)        6 pts | +2 GD    │
│ 3. ✅ Spain (Group C)         5 pts | +4 GD    │
│ ...                                             │
│ 8. ✅ Denmark (Group H)       4 pts | +1 GD    │
│ ─────────────────────────────────────────────   │
│ 9. ❌ Peru (Group I)          4 pts | 0 GD     │
│ 10. ❌ Iran (Group J)         3 pts | -1 GD    │
│ ...                                             │
│                                                 │
│ [Continue to Knockouts]                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

**If tied teams need scores**:
- Similar flow to group tiebreakers
- "Enter Scores" button for each tied team
- Expands to show their 3 matches
- User enters scores → system recalculates GD/GS → re-ranks

---

## Color System & Personalization

### Default Pick Color

**Default**: ps-green (#0aa86d) or ps-amber (#f59e0b)

**Onboarding Flow** (future enhancement):
```
┌─────────────────────────────────────────────────┐
│ Customize Your Picks                            │
│                                                 │
│ Choose the color that represents YOUR picks:    │
│                                                 │
│ [Green]  [Amber]  [Blue]  [Purple]  [Red]      │
│   ●                                             │
│                                                 │
│ This color will highlight all your selections.  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**User's pick color** is used throughout:
- Selected team names
- Selected "D" button
- Qualified teams in third-place ranking
- Knockout bracket selections

### Color States

**Neutral (unselected)**:
- Text: ps-text-sec (#191512 at 60% opacity)
- Background: transparent or ps-bg

**Selected**:
- Text: user's pick color (ps-green or ps-amber)
- Background: user's pick color at 10-20% opacity (ps-green/10 or ps-amber/10)
- Optional: subtle border (1px solid pick color at 30% opacity)

**Correct (post-tournament, Phase 2)**:
- Text/background: ps-green
- Used for scoring/results view

**Incorrect (post-tournament)**:
- Text/background: ps-red (#e23d4f)
- Used for scoring/results view

---

## Responsive Behavior

### Mobile (390px - 480px)

**Primary target**:
- Single column layout
- Match cards full width minus 16px padding each side
- Team names may wrap if long (e.g., "Costa Rica")
- Tap targets minimum 44px height
- 12pt font for team names (readable, not cramped)

### Tablet (481px - 768px)

**Secondary target**:
- Single column layout (same as mobile, just more whitespace)
- Max width 480px, centered
- Slightly larger fonts (13pt)

### Desktop (769px+)

**Tertiary target**:
- Single column layout, max width 480px, centered
- Larger fonts (14pt)
- Hover states on team name buttons (subtle background color change)

---

## Animation & Micro-interactions

### Selection Feedback

**When user taps team name**:
1. Immediate color change (0ms delay)
2. Optional: subtle scale animation (1.02x for 150ms)
3. Optional: ripple effect from tap point

**When standings recalculate**:
1. Brief loading spinner (if calculation >200ms)
2. Smooth fade-in of updated standings (200ms ease-out)

### Progress Indicators

**Group completion progress bar**:
```
┌─────────────────────────────────────────────────┐
│ Group Stage Progress       [4/12 Complete]      │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
└─────────────────────────────────────────────────┘
```

- Fill color: user's pick color
- Animates smoothly as groups complete

---

## Technical Implementation Notes

### Component Architecture

**GroupResultsStep.tsx**:
- Renders 12 group cards (collapsible/expandable)
- Each group shows 6 match cards
- Real-time standings calculation
- Detects tiebreakers
- Shows "Continue" button (no inline errors)
- Navigates to TiebreakerResolutionPage when Continue tapped

**TiebreakerResolutionPage.tsx** (NEW):
- Separate page/step for resolving tiebreakers
- Shows tied teams + their 3 matches each
- Validates scores match results
- Returns to GroupResultsStep after resolution

**ThirdPlaceRankingStep.tsx**:
- Shows 12 third-place teams ranked
- Top 8 highlighted (green)
- Bottom 4 grayed out
- Score collection for tied teams (inline expandable)

**MatchCard.tsx** (refactor):
- Team name buttons (not W/D/L)
- Draw button centered
- Exact score section (collapsed by default)
- Color-driven selection states

### Data Model

**MatchPrediction**:
```typescript
interface MatchPrediction {
  match_id: string
  home_team: string
  away_team: string
  result: 'home_win' | 'draw' | 'away_win' | null
  exact_score?: {
    home_score: number
    away_score: number
  }
}
```

**No changes needed** - existing model supports new UX

### Auto-Save Strategy

- Debounced save (500ms after last change)
- localStorage backup (resilience)
- API save (async, non-blocking)
- Visual indicator: "Saved" checkmark appears for 2s after save

---

## Edge Cases & Error States

### User Changes Result After Entering Score

**Scenario**: User predicts France 2-1 Denmark (France win), then changes to Draw

**Behavior**:
1. System detects result TYPE changed (win → draw)
2. Clears exact_score silently (no modal)
3. If user changes back to France win → score field is blank (must re-enter)
4. If tiebreaker later needed → prompts for score again

**Rationale**: Avoid stale data (2-1 score incompatible with draw result)

### User Forgets to Enter Score in Group View

**Scenario**: User completes group, tiebreaker detected, but user didn't expand exact score section

**Behavior**:
1. "Continue" button shows "⚠️ Tiebreaker needed"
2. User taps Continue → navigates to TiebreakerResolutionPage
3. User enters scores there
4. System saves + returns to group view
5. Continue button now enabled (tiebreaker resolved)

**Rationale**: Progressive disclosure - don't force users to enter scores proactively

### Network Failure During Save

**Scenario**: User makes selections, auto-save fails (offline/network error)

**Behavior**:
1. System saves to localStorage (backup)
2. Shows "Offline" indicator (yellow warning)
3. On reconnect → syncs localStorage → API
4. Shows "Synced" checkmark

**Rationale**: Never lose user work, offline-first design

---

## Accessibility Requirements

### Keyboard Navigation

- Tab order: Team 1 → Draw → Team 2 → Exact score toggle → Next match
- Enter/Space to select
- Escape to collapse exact score section

### Screen Readers

- Announce selection: "France selected for match 1"
- Announce standings update: "Standings updated, France 1st with 3 points"
- Announce tiebreaker: "Tiebreaker needed for Group A, tap Continue"

### Color Contrast

- All text meets WCAG AA (4.5:1 contrast ratio)
- Selected state must be distinguishable without color (icon + color)
- Colorblind-safe palette (tested with deuteranopia/protanopia simulators)

---

## Future Enhancements (Out of Scope for V1)

1. **Multi-classification support**: Same UX for Format, Overall classifications
2. **Score pre-fill from other classifications**: If user entered score in Format, pre-fill in Overall
3. **Pick color customization**: Onboarding flow to choose personal pick color
4. **Animation polish**: More sophisticated transitions, confetti on completion
5. **Social sharing**: "Share my bracket" generates shareable image
6. **Live updates**: Real-time collaboration (see friend's picks as they make them)

---

## Design Deliverables Checklist

### Required for Implementation

- [ ] Figma mockups: Match card (3 states: empty, France selected, Draw selected)
- [ ] Figma mockups: Tiebreaker Resolution Page (full flow)
- [ ] Figma mockups: Third-Place Ranking Step (with score entry)
- [ ] Component specs: MatchCard (dimensions, spacing, colors, tap targets)
- [ ] Component specs: TiebreakerResolutionPage (layout, content, CTAs)
- [ ] Interaction design: Tap → color change animation (timing, easing)
- [ ] Color palette: User pick colors (5 options for onboarding)
- [ ] Responsive breakpoints: Mobile (390px), Tablet (768px), Desktop (1024px)
- [ ] Accessibility audit: Keyboard nav, screen reader, color contrast

### Nice-to-Have

- [ ] Lottie animations for selection feedback
- [ ] Illustration: Empty state ("No groups completed yet")
- [ ] Illustration: Success state ("All groups completed!")
- [ ] Brand mark variations for WC 2026 theme

---

## Open Questions for Designer

1. **Team name truncation**: If team name is very long (e.g., "Bosnia and Herzegovina"), truncate or wrap?
2. **Exact score icon**: Use "⋮" (vertical ellipsis) or "▶" (right arrow) or "+" (plus icon)?
3. **Tiebreaker page transition**: Slide from right, fade, or modal overlay?
4. **Pick color default**: Start with ps-green or ps-amber? (User can change later)
5. **Standings display**: Show in sidebar, below matches, or separate tab?
6. **Progress indicator**: Show percentage, fraction (4/12), or both?

---

## Success Metrics (Post-Launch)

**Engagement**:
- Average time to complete 1 group: Target <3 minutes
- Completion rate (all 12 groups): Target >80%
- Tiebreaker resolution rate: Target >95% (users don't abandon)

**Usability**:
- Error rate (invalid scores): Target <5%
- Score re-entry rate: Target <10% (good score retention logic)
- Help/FAQ views: Target <20% (intuitive UX, minimal confusion)

**Performance**:
- Match card interaction latency: Target <50ms (feels instant)
- Standings calculation: Target <200ms (no perceived lag)
- Auto-save latency: Target <1s (user sees "Saved" quickly)

---

## Contact & Collaboration

**For questions or clarifications**:
- Product lead: [User]
- Design agent: Use this document as source of truth
- Dev team: Refer to component specs in "Technical Implementation Notes"

**Feedback loop**:
- Share Figma mockups for review before implementation
- Prototype key interactions (team selection, tiebreaker flow) for user testing
- Iterate based on test page feedback (already in progress)

---

**END OF DESIGN BRIEF**

This document serves as the complete specification for designing the Football WC 2026 bracket prediction UX. All design decisions should align with the principles of **lightweight, color-driven, mobile-first** interaction.
