# User Test Plan — World Cup 2026 Predict (Round 3)

**App:** https://predictsport-rust.vercel.app/wc
**Date of this plan:** 6 June 2026
**Supersedes:** USER-TEST-2 (pre-accordion/card-swap overhaul)

---

## Executive Summary

This document covers round 3 user testing for the World Cup 2026 Predict app. Since round 2, the app has undergone ~60 commits of UI work: dashboard cards now expand/collapse inline, the Fixtures tab uses a card-swap pattern for picks, Rules/FAQs have been refactored into nested accordions, the leaderboard shows real display names, navigation has been consolidated (Picks · Table · Rules · More), and the hamburger menu has been redesigned. Mobile polish (iOS zoom prevention, viewport handling) and onboarding spotlight fixes were also shipped.

Round 2 found 10 issues (P0–P3). All P0/P1 issues were resolved. This test validates the new interaction patterns and checks for regressions introduced by the UI overhaul.

The core questions this test is answering:

1. Do the new expand/collapse and card-swap interaction patterns feel intuitive on mobile?
2. Does the accordion state management work correctly (only one expanded at a time)?
3. Has the navigation consolidation created any dead ends or confusion?
4. Are the onboarding and iOS viewport regressions actually fixed?

---

## Test Prerequisites

### Accounts

- **Test Account A** — a Google account that is NOT already a competition member. Use for Journeys 1–5 (first-time user flow).
- **Test Account B** — a Google account that IS already a member with predictions made. Use for Journey 6 (returning user).
- **Admin account** — eoinmaleoin@gmail.com or any account with `is_super_admin = true`. Use for admin link verification in Journey 4.

### Invite Code

Have a valid invite code ready. Confirm it works (case-insensitive) before starting. Either an `invite_tokens` row or the `competitions.invite_code` value.

### Devices

- **Primary:** Physical iOS or Android device at 390px viewport (iPhone 14 or equivalent). Mobile is the primary test target.
- **Secondary:** Desktop browser at 1280px+ to verify desktop layout.
- **Orientation:** Portrait first. Landscape during Journey 7 edge cases.

### Network

Normal mobile connection for most testing. DevTools "Slow 3G" for Journey 7 edge cases.

### Before You Start

1. Clear browser cookies/session for Test Account A.
2. Vercel free tier queues deploys — if the build looks stale, wait 2–3 min and hard-refresh.
3. Tournament may or may not have started. Groups/results may be limited — this is expected and noted where relevant.

---

## Priority Definitions

**P0 — Blocker.** Cannot launch with this unfixed. Prevents joining, making picks, or seeing core content.

**P1 — Critical.** Significant user confusion or broken behavior on a main flow. Fix before inviting real users.

**P2 — Significant.** Noticeable but users can work around it. Fix before tournament starts.

**P3 — Polish.** Minor visual or copy issues. Fix when convenient.

---

## Journey 1: First-Time Anonymous Visitor

**Goal:** Verify the landing experience and join overlay for a non-member.

**Preconditions:** Logged out. Navigate to https://predictsport-rust.vercel.app/wc

### Steps

1. **Land on /wc.**
   Expected: Page loads. Blurred picks preview visible beneath a join overlay. Overlay shows competition name, invite code input, and brief description.
   Watch for: Layout flash, unblurred picks leaking before overlay renders.

2. **Without entering a code, try to interact with blurred picks area.**
   Expected: Overlay blocks interaction. Blurred state persists.

3. **Tap the invite code input on mobile.**
   Expected: Keyboard opens. Viewport does NOT zoom in (iOS auto-zoom fix). Overlay remains usable.

4. **Tap outside the input to dismiss keyboard.**
   Expected: Page returns to normal scroll position. No persistent zoom. Viewport resets cleanly.

5. **Tap "See the rules" or the Rules nav item.**
   Expected: Rules content loads. Points section is open by default. Other sections collapsed.

6. **Scroll through Rules: tap "Ways to Win", "Tiebreakers", "FAQs" headings.**
   Expected: Each section expands/collapses independently. FAQs section contains sub-groups (Basics, Scoring & Classifications, Rules & Tiebreakers, Technical). Basics group is open by default within FAQs.

7. **Within FAQs, tap a different group heading (e.g. "Scoring & Classifications").**
   Expected: The tapped group opens. Other groups may close (single-open) or stay open (multi-open). Either is acceptable but behavior should be consistent.

8. **Navigate back to the landing / join overlay.**
   Expected: No broken back-stack. Overlay is still present.

**Regression from Round 2:** Mobile viewport zoom on invite input — confirm fixed.

---

## Journey 2: Join Flow & Onboarding

**Goal:** Walk through join-to-onboarding for a new user.

**Preconditions:** Test Account A, logged out, on /wc. Valid invite code ready.

### Join

1. **Enter the invite code and submit.**
   Expected: Redirected to Google sign-in (no session exists). Invite code or return URL preserved.

2. **Complete Google sign-in with Test Account A.**
   Expected: Redirected back. Join processed. Lands on /wc/home?onboarding=true.
   Watch for: Landing on a generic dashboard instead of the onboarding flow.

### Onboarding Sequence

3. **Theme picker step.**
   Expected: Light/dark toggle. Tap each — preview updates. Confirm selection, proceed.
   Watch for: Theme not persisting past this step.

4. **Display name step (DisplayNameModal).**
   Expected: Single input modal. Pre-filled with Google name or blank. 50-char max with feedback.
   Watch for: Duplicate display name step (previously fixed — was appearing twice).

5. **Progressive dashboard reveal.**
   Expected: Dashboard sections reveal sequentially — picks section first, then group card, then invite banner. Tooltips accompany each. Feels guided.
   Watch for: All sections appearing at once, tooltips missing, wrong order.

6. **Home spotlight.**
   Expected: A spotlight highlights the Home icon (gold house) in the navigation. Auto-scrolls to ensure the element is visible. Spotlight is prominent enough to notice.
   Watch for: Spotlight appearing then disappearing too quickly, wrong element highlighted, no auto-scroll.

7. **Dismiss onboarding and verify clean state.**
   Expected: Lands on /wc or /wc/home in normal state. Refreshing does NOT re-trigger onboarding.

**Regression from Round 2:** Duplicate display name step — confirm fixed. Spotlight timing — confirm fixed.

---

## Journey 3: Dashboard Inline Expansion (NEW)

**Goal:** Validate the new expand/collapse pick cards on the dashboard.

**Preconditions:** Test Account A, joined, on /wc/home. At least 2 upcoming unpicked matches.

### Steps

1. **View the dashboard.**
   Expected: "At a Glance" stats section visible. Match cards in condensed format. Unpicked matches show "Pick →" CTA. Previously picked matches show "Edit" CTA or confirmed state.

2. **Tap "Pick →" on an unpicked match card.**
   Expected: Card expands inline revealing the full prediction UI (WindowPickList). No page navigation. The expansion is smooth.

3. **Make a prediction on the expanded card.**
   Expected: Tap team button — highlights immediately (optimistic). Score inputs work. Confirmation text: "You predicted [Team] to win [X]-[Y]".

4. **Without closing, tap "Pick →" on a second unpicked match.**
   Expected: First card collapses. Second card expands. Only one card is expanded at a time.
   Watch for: Both cards staying expanded, animation glitch, first card's prediction lost.

5. **Close the expanded card** (tap close button or the card header).
   Expected: Card collapses back to condensed view. Prediction is preserved — shows confirmed state.

6. **Tap "Edit" on a previously picked match.**
   Expected: Card expands with current pick pre-filled. Changes can be made. Updated confirmation appears after saving.

7. **Scroll the page with a card expanded.**
   Expected: Expanded card stays in place and doesn't jump or collapse on scroll. Other cards remain in their compact state.

8. **Refresh the page.**
   Expected: All cards reset to collapsed. Predictions made are persisted (server-side).

9. **Tap "Continue to full round →"** (if present).
   Expected: Navigates to the Upcoming tab on /wc for the current matchday.

---

## Journey 4: Fixtures Tab Card-Swap (NEW)

**Goal:** Validate the new card-swap pattern on the Fixtures tab.

**Preconditions:** Test Account A, on /wc?tab=fixtures (or tap the Fixtures/Matches tab). At least one upcoming unlocked fixture unpicked.

### Steps

1. **View the Fixtures tab.**
   Expected: Fixtures in date order. Each card shows: teams, date, time, venue/city. Upcoming unlocked fixtures show "Pick →".

2. **Verify locked/finished fixtures.**
   Expected: Past matches or matches past lock time do NOT show "Pick →". Show result or locked indicator.

3. **Tap "Pick →" on an unlocked fixture.**
   Expected: The fixture info card swaps to show the prediction UI. The transition should be clear — user understands they're now picking, not navigating away.
   Watch for: Confusion about whether this is a new page or an in-place swap.

4. **Make a prediction.**
   Expected: Winner and score input work. Confirmation text appears.

5. **Tap "Close prediction" or "Back to fixture info".**
   Expected: Card swaps back to fixture info (venue, time). An indicator shows this match has been picked.

6. **Tap "Pick →" on a different fixture while one is already in pick mode.**
   Expected: Previous card returns to fixture info. New card enters pick mode. Only one card in pick mode at a time.

7. **Re-open a previously picked fixture.**
   Expected: Pick UI opens with existing prediction pre-filled. Can edit.

8. **City/stadium name display on narrow screen.**
   Expected: Long city or stadium names truncate gracefully (no overflow, no broken layout). Short names (e.g. "In Miami") display normally.

---

## Journey 5: Navigation (Revised)

**Goal:** Confirm the consolidated navigation works on mobile and desktop.

**Preconditions:** Test Account A (member). Admin account for step 7.

### Pill Bar (Picks · Table · Rules · More)

1. **Tap "Picks" pill.**
   Expected: Navigates to /wc. Shows Upcoming/Results tabs. Active pill highlighted.

2. **Tap "Table" pill.**
   Expected: Navigates to leaderboard or group table view. Data reflects actual competition state.

3. **Tap "Rules" pill.**
   Expected: Rules content loads. Points section open by default.

4. **Tap "More" pill.**
   Expected: Opens additional menu (hamburger or dropdown). Items include: Admin (admin only), Bracket prediction, Group standings.

### Hamburger Menu (redesigned)

5. **Open the hamburger menu (from More or hamburger icon).**
   Expected: Menu opens. Shows profile/display name, theme toggle, log out. Layout is clean — not the old generic hamburger.

6. **Tap Theme toggle.**
   Expected: Switches light/dark. Persists after closing menu.

7. **Log in as admin. Check for Admin link.**
   Expected: "Admin — Manage competition" visible. Non-admin accounts do NOT see it.

8. **Log out from hamburger menu.**
   Expected: Session cleared. Redirected to /wc landing with join overlay.

### Home Icon

9. **On the tab bar, tap the Home icon (gold house).**
   Expected: Navigates to /wc/home dashboard.

### Desktop (1280px+)

10. **Verify desktop nav.**
    Expected: Pill bar visible. Layout uses wider containers for nav/footer. App content stays in narrow column. Not a phone screen on a laptop.

---

## Journey 6: Returning User

**Goal:** Verify the experience for a user who already has predictions.

**Preconditions:** Test Account B (existing member with predictions). Log in.

### Steps

1. **Land on /wc/home.**
   Expected: Dashboard loads with real data. NO onboarding overlay or prompt.

2. **Verify "At a Glance" stats.**
   Expected: Shows real data — picks made count, current rank/standing. Not 0/0 or stale.

3. **Check leaderboard display names.**
   Expected: Navigate to leaderboard. All entries show real display names (not user IDs). Names render without overflow. Long names (up to 50 chars) fit.

4. **Verify pick state on dashboard cards.**
   Expected: Previously picked matches show "Edit" CTA. Unpicked show "Pick →". Locked show locked state.

5. **Edit an existing prediction (before lock time).**
   Expected: Expand card. Current pick pre-filled. Change winner or score. Save. Confirmation updates.

6. **Navigate to /wc Upcoming tab.**
   Expected: All prior predictions visible with confirmation text on their cards.

7. **Verify locked match behavior.**
   Expected: Past-lock matches show no "Pick →" CTA. Clearly communicated (lock icon, "Locked" label, or disabled state).

8. **Navigate to /wc with join overlay logic.**
   Expected: Recognizes user is a member. No join overlay. Directly shows picks/content.

---

## Journey 7: Edge Cases

**Goal:** Probe boundary conditions and failure modes.

**Preconditions:** Test Account A.

### Accordion State Management

1. **On /wc/home, expand a pick card. Navigate to another tab (Rules). Come back to Home.**
   Expected: Card is collapsed on return (no persisted expansion state). Prediction is preserved.

2. **On Rules page, open FAQs section. Open "Scoring & Classifications" group. Navigate away. Return.**
   Expected: Accordion resets to default (Points open, FAQs closed). No stale expanded state.

### Display Name Edge Cases

3. **Enter a display name of exactly 50 characters.**
   Expected: Accepted. Renders correctly on leaderboard, dashboard, and pick cards.

4. **Enter 51 characters.**
   Expected: Blocked by input (maxlength) or rejected with validation message. No silent truncation.

### Double-Tap

5. **Quickly double-tap a team winner button on a pick card.**
   Expected: Pick made once. No double-submit. No visual glitch.

6. **Quickly double-tap "Pick →" CTA on a dashboard card.**
   Expected: Card expands once. No stacked expansions or animation glitch.

### Mobile Viewport

7. **On iOS Safari, tap the score input on an expanded pick card.**
   Expected: Keyboard opens. No zoom. Input is usable.

8. **Tap outside to dismiss keyboard.**
   Expected: Viewport returns to normal. No persistent zoom. Card remains expanded.

### Landscape

9. **Rotate to landscape while a dashboard card is expanded.**
   Expected: Layout adapts. Card remains expanded and usable. No horizontal overflow.

10. **Rotate while hamburger menu is open.**
    Expected: Menu adapts or closes gracefully.

### Slow Network

11. **Throttle to Slow 3G. Make a prediction on an expanded dashboard card.**
    Expected: Optimistic update appears immediately. Server confirms or the UI handles failure gracefully.

12. **Slow 3G — tap "Pick →" to expand a card.**
    Expected: Card expands locally (no server call needed for UI expansion). Only the prediction submission is network-dependent.

### Page Refresh

13. **Expand a card, enter a partial score, refresh.**
    Expected: Card collapses. Partial score lost (expected — no auto-save for in-progress input). Previous completed predictions intact.

### Back Button

14. **Complete onboarding. On /wc, tap browser back button.**
    Expected: Navigates to a sensible page or stays on /wc. Does NOT re-trigger onboarding or enter a redirect loop.

---

## Journey 8: Groups, Bracket & Leaderboard (Smoke Test)

**Goal:** Basic validation of secondary surfaces. These are bonus-scope for launch.

**Preconditions:** Test Account A or B (member).

### Groups

1. **Navigate to Groups tab/view.**
   Expected: FIFA group cards visible. If groups drawn: real group data with host-city colors. If pre-draw: appropriate placeholder message.

2. **Tap a group card.**
   Expected: Expands to single-group view or navigates to detail. Shows standings/points if available.

3. **Return from group detail.**
   Expected: Return CTA navigates back to Groups overview. No dead end.

### Bracket

4. **Navigate to Bracket (from More menu or dedicated tab).**
   Expected: Bracket UI loads. Progress bar visible. If pre-knockouts: shows structure but limited data.

### Leaderboard

5. **Navigate to leaderboard.**
   Expected: Rankings display with real display names, points, and rank numbers.

6. **Verify with 50-char display name (if set in Journey 7).**
   Expected: Name renders fully. No overflow or column breakage.

---

## Findings Template

Use this section to record findings during the test session.

| ID | Journey | Step | Description | Priority | Status |
|----|---------|------|-------------|----------|--------|
| T3-001 | | | | | Open |

### Finding Detail Template

For each P0 or P1 issue, add a detail block:

```
**T3-XXX** — [Short title]
Journey: X | Step: X
Priority: P0 / P1
Device: iPhone 14 / Desktop Chrome / etc.
Account: Test A / Test B / Admin

Steps to reproduce:
1.
2.
3.

Expected:
Actual:
Screenshot/recording: [link or file path]
Notes:
```

---

## Regression Check — Issues from Round 2

Confirm these previously resolved issues have not regressed.

| Round 2 Issue | Expected Fix | Result |
|---------------|--------------|--------|
| Join code not working (case sensitivity) | toLowerCase lookup in /api/join | |
| "My Competitions" in WC shell | Removed from WC shell | |
| No reset control on picks | Reset control added to pick cards | |
| No confirmation after picking | "You predicted X to win Y-Z" text | |
| Mobile viewport zoom on invite input | blur handler + font-size fix | |
| Display name change cooldown | Cooldown removed | |
| Duplicate display name onboarding step | Unified to DisplayNameModal only | |
| Onboarding spotlight too brief / wrong element | Stronger spotlight + auto-scroll | |
| Score input ghost overwrite | Fixed outcome derivation | |
| Middleware blocking /predictions, /competitions | Route lockdown relaxed | |

---

## What's New Since Round 2 (Test Focus Areas)

These are the primary changes this round is validating:

| Feature | Commits | Key Risk |
|---------|---------|----------|
| Dashboard expand/collapse cards | `e65eb33`, `586fdcd` | State management — only one expanded at a time |
| Fixtures tab card-swap | `6b3f207`, `50d87fd` | UX clarity — swap vs. navigate confusion |
| Rules/FAQ accordion refactor | `74e9ffc`, `2ab521b`, `586fdcd`, `33ad00a` | Nested accordion state, default-open behavior |
| Leaderboard real names | `00d8d59` | Long name overflow, rendering correctness |
| Nav consolidation (Picks · Table · Rules · More) | `488b54f`, `15d44d2` | Dead ends, missing links, hamburger redesign |
| Onboarding spotlight fix | `543c7ae`, `d66d897` | Timing, correct element targeting |
| iOS viewport zoom prevention | `0130008`, `4e471ac` | Regression on input focus/blur cycle |
| Gold CTA design system | `8216b82` | Visual hierarchy, contrast, readability |
| City/stadium truncation | `c33c937`, `0e0c93e` | Narrow screen overflow |
| Groups single-group view | `e6cd74f` | Return CTA, data display |

---

## Out of Scope for This Test

- Full bracket prediction flow (bonus feature, tested separately if time allows)
- Results scoring and point calculation (no results yet or limited results)
- Admin competition management (admin flows tested separately)
- Multiple concurrent competitions (WC shell is single-competition)
- Push notifications (not yet implemented)
- i18n / Spanish translation (translation sheet delivered separately)
- Vercel deploy queue delays (infrastructure, not app)
