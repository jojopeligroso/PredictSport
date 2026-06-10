# User Test Plan — World Cup 2026 Predict (Round 2)

**App:** https://predictsport-rust.vercel.app/wc
**Date of this plan:** June 2026
**Supersedes:** Previous user test report (pre-UX-overhaul)

---

## Executive Summary

This document covers round 2 user testing for the World Cup 2026 Predict app. The app lets friend groups (~12 users) predict World Cup match winners and exact scores for points. Since the previous test round, the onboarding flow, all three prediction surfaces, and several critical bugs have been overhauled. This test validates those changes are working end-to-end before the competition goes live with real users.

The test is structured as 8 user journeys in order of how a real user would encounter them, from first anonymous visit through to a returning user editing picks. Most can be run by the developer alone; Journey 2 (join flow) requires a test invite code and ideally two test Google accounts to cover both the logged-in and logged-out paths.

The core questions this test is answering:

1. Can a new user join the competition without hitting any dead ends?
2. Do all three prediction surfaces (Upcoming tab, Dashboard, Fixtures tab) behave consistently?
3. Is the mobile experience usable at 390px without zoom or layout breakage?
4. Does the onboarding sequence feel coherent from landing to first pick?

---

## Test Prerequisites

### Accounts

- **Test account A** — a Google account that is NOT already a competition member. Use this for Journey 2 (join flow) and Journey 3-6 (first-time user experience).
- **Test account B** — a Google account that IS already a member with some predictions made. Use this for Journey 7 (returning user).
- **Admin account** — eoinmaleoin@gmail.com or any account with `is_super_admin = true`. Use this to verify the Admin link appears in the hamburger menu (Journey 6).

### Invite Code

Have a valid invite code ready before starting. Either an `invite_tokens` row or the `competitions.invite_code` value for the World Cup competition. Confirm it works once before handing to a tester.

### Devices

- **Primary:** Physical iOS or Android device at 390px viewport (iPhone 14 or equivalent). Mobile is the primary test target.
- **Secondary:** Desktop browser at 1280px+ to verify desktop nav and layout.
- **Orientation:** Test portrait first. Check landscape during Journey 8 edge cases.

### Network

Use the device's normal mobile connection for most testing. For Journey 8 edge cases, use browser DevTools throttled to "Slow 3G" to verify optimistic update behavior.

### Before You Start

1. Clear browser cookies/session for Test Account A so you start as a genuinely anonymous user.
2. Note that Vercel free tier may queue deploys. If you see a stale build, wait 2-3 minutes and hard-refresh before reporting issues.
3. Groups are not yet drawn (pre-tournament). The Groups tab content will be limited — this is expected.

---

## Priority Definitions

**P0 — Blocker.** The app cannot launch with this unfixed. Prevents joining, making picks, or seeing core content.

**P1 — Critical.** Significant user confusion or broken behavior on a main flow. Should be fixed before inviting real users.

**P2 — Significant.** Noticeable but users can work around it. Fix before tournament starts.

**P3 — Polish.** Minor visual or copy issues. Fix when convenient.

---

## Journey 1: First-Time Anonymous Visitor

**Goal:** Verify the landing experience for someone who has not joined yet.

**Preconditions:** No session / logged out. Navigate to https://predictsport-rust.vercel.app/wc

### Steps

1. **Land on /wc.**
   Expected: Page loads. A blurred picks preview is visible beneath a join overlay. The overlay should present the competition name, a brief description, and an invite code input.
   Watch for: Layout flash, unblurred picks leaking through before the overlay renders, any console errors.

2. **Without entering a code, try to click or interact with the blurred picks area.**
   Expected: The overlay blocks interaction. The blurred state persists.

3. **Tap the Fixtures tab** (from the overlay or the tab bar if visible).
   Expected: Fixture info cards are visible — venue, date/time, teams. No prediction UI is shown (user is not a member).
   Watch for: "Pick →" CTAs appearing for non-members, which would be misleading.

4. **Tap the Results tab** (if present and has any data).
   Expected: Either shows completed fixtures or an appropriate empty state ("No results yet"). Should not error.

5. **Tap the Rules link** (in nav or on the page).
   Expected: Rules content is readable. No broken layout.

6. **Scroll down on the landing page** to find the "How it works" section.
   Expected: Section is present and readable. Copy makes sense to someone who has never used the app.

7. **Tap the invite code input on mobile.**
   Expected: Keyboard opens. The viewport should NOT zoom in (iOS auto-zoom on inputs smaller than 16px). The overlay should remain usable after the keyboard opens.

8. **Tap anywhere outside the input (dismiss keyboard).**
   Expected: Page returns to normal scroll position. No persistent zoom.

**Known issue to verify is fixed:** Previous test found mobile viewport zoom on invite code input. Confirm this is resolved.

---

## Journey 2: Join Flow

**Goal:** Walk through the complete join-to-onboarding sequence for a new user.

**Preconditions:** Test Account A, logged out, on /wc with join overlay visible. Valid invite code ready.

### Path A — Logged Out User

1. **Enter the invite code in the overlay input and submit.**
   Expected: Because no session exists, the user is redirected to the Google sign-in page. The invite code or return URL should be preserved so the join completes after auth.

2. **Complete Google sign-in with Test Account A.**
   Expected: After sign-in, the user is redirected back and the join is processed. Should NOT land on a generic dashboard — should continue the join flow.

3. **Confirm redirect to /wc/home?onboarding=true.**
   Expected: URL contains `onboarding=true`. The onboarding sequence begins immediately.

### Path B — Already Logged In User (run separately with a fresh test account)

1. **Log in first, then navigate to /wc with the join overlay.**

2. **Enter the invite code and submit.**
   Expected: POST /api/join fires. Redirected to /wc/home?onboarding=true immediately, no extra auth step.

### Onboarding Sequence (both paths land here)

3. **Theme picker step.**
   Expected: A light/dark theme toggle is presented. Tap each option — the preview or UI should respond. Confirm selection and proceed.
   Watch for: Theme selection not persisting past this step.

4. **Display name step.**
   Expected: Input for display name. Pre-filled with Google display name or blank. Character limit feedback should be present (50 char max). Enter a valid name and continue.

5. **Progressive dashboard reveal.**
   Expected: Dashboard sections reveal one at a time — picks section first, then group card, then invite banner. Tooltips accompany each reveal. The progression should feel guided, not overwhelming.
   Watch for: All sections appearing at once, tooltips not appearing, sections appearing in wrong order.

6. **Final step — spotlight on Home nav.**
   Expected: A spotlight or visual call-out draws attention to the Home icon (gold house) in the navigation. The user is redirected to /wc (or the spotlight appears on /wc). The Home nav item should be clearly indicated.
   Watch for: Spotlight appearing briefly then disappearing before the user can see it, incorrect element highlighted.

7. **Dismiss onboarding.**
   Expected: User lands on /wc or /wc/home in a normal state, onboarding markers cleared. Refreshing the page should not re-trigger onboarding.

---

## Journey 3: Making Predictions on /wc (Upcoming Tab)

**Goal:** Verify the primary picks surface works end-to-end.

**Preconditions:** Test Account A, joined and onboarding complete, on /wc. At least one upcoming match should be visible.

### Steps

1. **View the Upcoming tab.**
   Expected: Match cards visible. Each shows team names, date/time, and pick UI with team buttons (or a draw option where applicable) plus score inputs.

2. **Tap a team button to pick a winner.**
   Expected: The button highlights immediately (optimistic update). The pick registers without a page reload. The confirmation text appears: "You predicted [Team] to win" or similar.
   Watch for: Double-tap firing two requests, button state not updating until server responds.

3. **Enter an exact score using the score circles.**
   Expected: Score input is tappable. Values increment/decrement correctly. The full prediction confirmation reads "You predicted [Team] to win [X]-[Y]".
   Watch for: Score input not being usable without picking a winner first, or score input resetting after winner pick.

4. **Check the progress bar.**
   Expected: After making a pick, the MD1 PICKS progress bar (or equivalent) increments. The percentage or count should update.

5. **Check the day pills.**
   Expected: The day calendar strip shows the current matchday. The pill for the day you just predicted should show a completion indicator (checkmark, filled dot, or similar).

6. **Switch between "By date" and "By group" views.**
   Expected: Matches reorganize correctly. Picks you already made persist in both views — the same match should show the same confirmed pick state regardless of view mode.

7. **Tap "Show more matches"** (if visible).
   Expected: Additional match cards expand or load below. No full page reload.

8. **Reset a prediction.**
   Expected: Find the reset control on a pick card (button, link, or icon). Tap it. Expected: Confirmation of reset, prediction cleared, confirmation text gone, pick buttons return to unpicked state.
   Watch for: Reset control not visible, reset not persisting after page refresh.

9. **Navigate away and return to /wc.**
   Expected: All picks made in this journey are still present. State is server-persisted, not just local.

---

## Journey 4: Making Predictions on /wc/home (Dashboard)

**Goal:** Verify the dashboard prediction flow works correctly, including the expand/collapse behavior.

**Preconditions:** Test Account A, on /wc/home. Some picks already made (from Journey 3) and some upcoming matches still unpicked.

### Steps

1. **View the dashboard.**
   Expected: "At a Glance" stats section shows. Match cards are visible in a condensed format. Unpicked matches show a "Pick →" CTA. Matches already picked show an "Edit" CTA.

2. **Tap a "Pick →" CTA on an unpicked match card.**
   Expected: The card expands inline to reveal the full prediction UI (DashboardPickRow / WindowPickList). No page navigation occurs.

3. **Make a prediction on the expanded card.**
   Expected: Winner button and score input work. Confirmation text appears within the card.

4. **Tap the CTA on a different match card while the first is still expanded.**
   Expected: The previously expanded card collapses. The new card expands. Only one card is expanded at a time.

5. **Tap "Edit" on a previously picked match.**
   Expected: Card expands showing the current pick pre-filled. Changes can be made. Updated confirmation text appears after saving.

6. **Tap the "Continue to full round →" link** (if present).
   Expected: Navigates to the Upcoming tab on /wc or the appropriate picks surface for the current matchday.

7. **Mock group card.**
   Expected: A group card section is visible. Since groups are not yet drawn, this should show an appropriate pre-draw state (placeholder, "Groups announced X date", etc.). It should NOT show broken data or an empty card with no explanation.

8. **Invite code banner.**
   Expected: A banner shows the competition invite code with a copy button (and share button on mobile). Tapping copy should write the invite code to clipboard. On iOS/Android, the share button should open the native share sheet.

9. **Verify "At a Glance" stats.**
   Expected: Stats reflect actual pick data — e.g., how many picks made, current standing. Should not show 0/0 or stale data.

---

## Journey 5: Making Predictions on /wc?tab=fixtures

**Goal:** Verify the Fixtures tab pick flow works, especially the card-swap behavior.

**Preconditions:** Test Account A, navigate to /wc?tab=fixtures (or tap the Fixtures tab). Ensure at least one upcoming fixture is unpicked.

### Steps

1. **View the Fixtures tab.**
   Expected: All fixtures shown in date order. Each card shows: teams, date, time, venue. Upcoming fixtures with no pick yet show a "Pick →" CTA on the right side of the card.

2. **Verify locked or finished fixtures.**
   Expected: Past matches (or matches past lock time) do NOT show a "Pick →" CTA. They may show a result or a locked state indicator.

3. **Tap "Pick →" on an upcoming, unlocked fixture.**
   Expected: The fixture info card swaps out and is replaced by the prediction UI for that match. The transition should be clear — the user should understand they are now in prediction mode.

4. **Make a prediction.**
   Expected: Winner and score input work as expected. Confirmation text appears.

5. **Tap "Back to fixture info"** (or equivalent back control).
   Expected: The card swaps back to the fixture info view, showing the venue/time details again. The pick should still be confirmed — the card may show a small indicator that this match has been picked.

6. **Tap "Pick →" on a different fixture card.**
   Expected: The previously swapped card (if still in pick mode) returns to fixture info mode. Only one card is in pick mode at a time.

7. **Tap "Pick →" on a match you already picked.**
   Expected: Prediction UI opens showing the existing pick pre-filled (effectively the same as "Edit" on the dashboard).

---

## Journey 6: Navigation

**Goal:** Confirm all navigation elements work on both mobile and desktop.

**Preconditions:** Test Account A (member). Test admin account for the Admin link check.

### Mobile Navigation (hamburger menu)

1. **Open the hamburger menu.**
   Expected: Menu slides or fades in. Items present: Profile, Leaderboard, Bracket prediction, Theme toggle, Log out. If logged in as admin: Admin link also appears.

2. **Tap Profile.**
   Expected: Navigate to profile page or open profile panel. Display name is correct.

3. **Tap Leaderboard.**
   Expected: Navigate to /wc/leaderboard or equivalent. Standings are visible.

4. **Tap Bracket prediction.**
   Expected: Navigate to /wc/bracket. Bracket UI loads.

5. **Tap Theme toggle.**
   Expected: App switches between light and dark mode. The toggle state reflects the current mode. Preference persists after closing and reopening the menu.

6. **Log out.**
   Expected: Session cleared, redirected to /wc landing or login page. The join overlay is visible again (not logged-in state).

7. **Log back in and verify with admin account: Admin link in hamburger menu.**
   Expected: Admin link is present. Non-admin accounts do not see it.

### WC Pill Bar (Home · Matches · Rules)

8. **Tap each pill in the Home · Matches · Rules bar.**
   Expected: Home navigates to /wc/home. Matches navigates to /wc (Upcoming or Fixtures tab). Rules navigates to /wc/rules or shows rules content. Active pill is visually highlighted.

### Home Icon

9. **On the /wc tab bar, tap the Home icon (gold house).**
   Expected: Navigates to /wc/home dashboard.

### Back Buttons

10. **On /wc/home dashboard, tap "Back to Home" or "Back to Matches"** (if present).
    Expected: Navigate back correctly. No broken or stale back-stack.

### Desktop Navigation

11. **On desktop (1280px+), verify the nav bar.**
    Expected: Nav shows Home, Matches, Rules as inline links. A user dropdown is present (avatar or display name). The WC pill bar is present below the main nav. Layout should not look like a mobile screen centered on a wide viewport — full-width areas (nav, footer) should use the wider container.

---

## Journey 7: Returning User

**Goal:** Verify the experience for a user who has already joined and made predictions.

**Preconditions:** Test Account B (existing member with predictions made). Log in.

### Steps

1. **Land on /wc/home.**
   Expected: Dashboard loads with real data. No onboarding prompt or overlay.

2. **Check pick status indicators.**
   Expected: Match cards show correct state — picks already made show "Edit" CTA (or confirmed state), upcoming unpicked matches show "Pick →", locked matches show locked state. No matches should appear as unpicked if picks were previously submitted.

3. **Check the progress bar.**
   Expected: Progress reflects actual picks submitted, not 0%.

4. **Navigate to /wc Upcoming tab.**
   Expected: Picks made in a previous session are shown as confirmed on their respective cards. Confirmation text ("You predicted X to win Y-Z") is visible.

5. **Edit an existing prediction (before lock time).**
   Expected: Tap Edit on a previously picked match. The current pick is pre-filled. Change the winner or score. Save. Confirmation text updates to reflect the new pick. Refreshing the page shows the updated pick.

6. **Find a match that is past lock time.**
   Expected: The prediction UI is not accessible. The lock state is clearly communicated — no "Pick →" CTA, possibly a lock icon or "Locked" label.

7. **Attempt to navigate to the join flow.**
   Expected: Going to /wc with the join overlay should recognize the user is already a member and not show the overlay (or show an appropriate "already joined" state).

---

## Journey 8: Edge Cases

**Goal:** Probe boundary conditions and failure modes.

**Preconditions:** Test Account A.

### Display Name — Max Length

1. **During onboarding or profile edit, enter a display name of exactly 50 characters.**
   Expected: Accepted. Renders correctly in the nav, leaderboard, and pick cards without overflow or truncation.

2. **Enter a display name of 51 characters.**
   Expected: Either blocked by the input (maxlength attribute) or rejected with a clear validation message. Should not silently truncate.

### Double-Tap on Mobile

3. **Quickly double-tap a team winner button.**
   Expected: The pick is made once. No double-submit error. The optimistic UI handles the second tap gracefully (either ignores it or shows no visible glitch).

### Landscape Orientation

4. **Rotate the device to landscape while on /wc (Upcoming tab).**
   Expected: The layout adapts. Match cards are readable. Score inputs are usable. No horizontal overflow or clipped elements.

5. **Rotate while the hamburger menu is open.**
   Expected: Menu either adapts or closes gracefully. No broken layout.

### Slow Network — Optimistic Updates

6. **Using browser DevTools, throttle to Slow 3G. Make a pick.**
   Expected: The pick appears immediately in the UI (optimistic update). A subtle loading indicator may be present. After the server responds, the state remains consistent (no flicker back to unpicked then re-picked).

7. **Slow 3G — make a pick, then immediately navigate away before the request completes.**
   Expected: On returning, the pick should be saved (server eventually got the request) or clearly not saved (if navigation cancelled the in-flight request). There should be no silent data loss without any indication.

### Page Refresh Mid-Prediction

8. **Start entering a score (type in the score inputs) then refresh the page.**
   Expected: In-progress score input is not persisted (expected — no auto-save for partial input). The user is returned to the pick state as of the last completed submission. This should not cause an error.

### Back Button After Onboarding

9. **Complete onboarding and land on /wc. Immediately tap the browser back button.**
   Expected: Either navigates back to a sensible previous page (e.g., landing) or stays on /wc. Should NOT re-trigger the onboarding flow or get stuck in a redirect loop.

---

## Findings Template

Use this section to record findings during the test session. Add a row per issue found.

| ID | Journey | Step | Description | Priority | Status |
|----|---------|------|-------------|----------|--------|
| T2-001 | | | | | Open |

### Finding Detail Template

For each P0 or P1 issue, add a detail block:

```
**T2-XXX** — [Short title]
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

## Regression Check — Issues from Previous Test

Confirm these previously found issues are resolved. Mark each as Fixed, Partially Fixed, or Regressed.

| Previous Issue | Expected Fix | Result |
|---------------|--------------|--------|
| Join code not working — /api/join only checked invite_tokens, not competitions.invite_code | /api/join now checks both | |
| "My Competitions" appearing in WC shell (wrong context) | Removed from WC shell | |
| No way to reset a prediction | Reset control added to pick cards | |
| No confirmation after picking (timer replaced confirmation text) | "You predicted X to win Y-Z" text shown after pick | |
| Mobile viewport zoom on invite code input | blur handler added, zoom suppressed | |
| Display name change cooldown blocking test users | Cooldown removed | |

---

## Out of Scope for This Test

The following are known pre-tournament limitations and are NOT test failures:

- Groups tab showing limited data — groups not yet drawn.
- Results tab empty or minimal — no results yet.
- Bracket prediction feature is bonus/optional; basic smoke test only (Journey 6, step 4).
- Leaderboard showing limited standings — expected with few test picks.
- Vercel deploy queue delays — not an app bug.
