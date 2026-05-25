# Design: WC Dashboard State Machine

> Three-part design doc. Section A defines the state machine, card stacks,
> derivation rules, and data contract. Section B defines the Format
> Classification hero card — content, modes, qualification shading, and the
> enriched leaderboard detail page. Section C defines copy tone, fixture card
> anatomy, naming conventions, brand mark placement, and the visitor page
> narrative.

## 1. Overview

The `/wc` dashboard adapts its layout based on the user's progression through
the World Cup competition. This is called the **Dashboard State** — a UI-level
concept, never stored in the database, computed from existing data. See
`CONTEXT.md` for the glossary entry and `docs/adr/0012-centralised-dashboard-state.md`
for the architectural decision.

The goal: surface the most relevant classification and action at every stage of
the tournament, so the user always knows where they stand and what to do next.

---

## 2. Dashboard States

Five states, evaluated in priority order:

| # | State | Trigger | Primary experience |
|---|---|---|---|
| 1 | `visitor` | No auth session | Landing page — sign up / join |
| 2 | `bracket` | Authenticated + no bracket submitted + no matchday predictions | Bracket wizard is hero — onboarding |
| 3 | `format` | Bracket `submitted`/`locked` OR at least one matchday prediction; Format membership `active` | Format Classification is hero — the USP |
| 4 | `overall` | Format membership `eliminated` or `dead` | Overall Classification is hero — still playing |
| 5 | `archive` | Competition `completed` | Final standings — read-only (deferred) |

### Derivation logic (pseudocode)

```
function deriveWcDashboardState(user, bracket, formatMembership, competition, hasAnyMatchdayPrediction):
  if !user                                              → "visitor"
  if competition.status === "completed"                 → "archive"
  if formatMembership.status in ("eliminated", "dead")  → "overall"
  if bracket.stage in ("submitted", "locked")           → "format"
  if hasAnyMatchdayPrediction                           → "format"
  → "bracket"
```

Evaluation order matters:
- `archive` trumps everything — tournament is over.
- `overall` trumps `format` — elimination is irreversible.
- `format` triggers on EITHER bracket submission OR first matchday prediction.
- `bracket` is the fallthrough — the default for a new, inactive user.

### Key rules

- **No provisional eliminations.** Dashboard State reads from
  `classification_memberships.status`. If it's `active`, the user is in
  `format`. The flip to `eliminated` happens only at Stage finalisation.
  The finalisation moment IS the dramatic reveal.

- **Bracket → Format via skip.** A user who skips the bracket and makes their
  first matchday prediction transitions to `format` state. The bracket card
  appears as a secondary nudge ("You haven't filled this in yet") but does not
  block the Format experience.

---

## 3. Card Stacks

Each Dashboard State defines a strict top-to-bottom card ordering on the `/wc`
page. Cards are conditionally visible based on the rules in Section 4.

### `visitor`

1. Hero image / branding
2. Tagline (Session C)
3. "Join the game" CTA
4. Format Classification pitch (biased toward elimination drama, but not
   exclusive — solo users via Overall must also feel welcome)
5. Scoring summary (compact)

### `bracket`

1. Bracket wizard CTA (hero, gold gradient)
2. Skip-to-format CTA (~66% size of bracket hero — visible, not hidden)
3. Countdown to kickoff

### `format` (pre-knockout)

1. Format Classification hero card (Session B)
2. Next matchday picks CTA
3. Full Bracket card (if applicable — see Section 4)
4. Overall standing summary (compact; taps through to Overall leaderboard tab)

### `format` (knockout stage begun)

1. Format Classification hero card
2. Next matchday picks CTA
3. Active bracket card(s) — KO Bracket above Full Bracket when both active
4. Overall standing summary (compact → taps to detailed Overall tab)

### `overall`

1. Overall Classification hero card (detailed — primary engagement surface for
   eliminated users, especially by QF/SF stage)
2. Next matchday picks CTA
3. Active KO Bracket card (if still alive — standalone, prominent)
4. Format card (demoted, greyed, "Eliminated at [stage]")
5. Dead bracket card(s) — consolidated and greyed at bottom

### `archive`

Deferred. One-line intent: final standings across all classifications,
read-only, no action CTAs.

---

## 4. Bracket Card Visibility Rules

The bracket card's presence, appearance, and position depend on the user's
bracket engagement and lifecycle state.

| Condition | Card | Position |
|---|---|---|
| Pre-kickoff, user never started bracket | Bracket CTA (start it) | Hero in `bracket` state; secondary in `format` state |
| Pre-kickoff, bracket in progress | Bracket CTA (continue) | Hero in `bracket` state; secondary in `format` state |
| Pre-kickoff, bracket submitted | Bracket review card (editable) | Secondary, below Format hero + matchday picks |
| Post-kickoff, user never filled out bracket | **Hidden permanently** | — |
| Post-kickoff, Full Bracket locked | Full Bracket view card (read-only) | Secondary |
| KO Bracket open, user active in BOTH | Two separate cards; KO above Full | #3–#4 range |
| KO Bracket open, active in KO only (Full dead) | KO Bracket prominent; Full compacted at bottom | KO at #3–#4; Full at bottom |
| KO Bracket open, active in Full only (KO dead) | Full Bracket prominent; KO greyed at bottom | Full at #3–#4; KO at bottom |
| User dead in BOTH brackets | Consolidated "Brackets" card, greyed | Bottom of stack |
| User never engaged with Full Bracket, post-lock | Full Bracket never appears | Only KO if engaged |

### Key principles

- An **active** classification always gets its own card — never bundled.
- A **dead** classification drops to the bottom, greyed.
- Consolidation into a plural "Brackets" card happens only when ALL bracket
  classifications the user engaged with are dead.
- A bracket the user never engaged with is **invisible permanently** post-lock.
- KO Bracket card does NOT appear until the knockout prediction window opens
  (post-Matchday 3 finalisation). Before that, it is invisible on the dashboard
  and mentioned only in rules/explanations.

---

## 5. Full Bracket Eligibility

Full Bracket classification closes permanently at PW1 lock (first fixture
kickoff). Any user who has not submitted their bracket by PW1 lock is
permanently ineligible for Full Bracket. Their bracket card disappears.

Admin may close Full Bracket earlier than PW1 lock at their discretion.

Other classifications remain open after PW1 lock:
- **Format:** Participable. Missed windows = zero points, but can play onward.
- **Overall:** Cumulative. Missed windows = fewer points.
- **Knockout Bracket:** Opens after group stage. Independent of Full Bracket.

---

## 6. Leaderboard State Awareness

The leaderboard page (`/wc/leaderboard`) defaults to the classification tab
that matches the user's Dashboard State:

| Dashboard State | Default tab |
|---|---|
| `visitor` | N/A (redirected to login) |
| `bracket` | Format (priming) |
| `format` | Format |
| `overall` | Overall |
| `archive` | Overall |

All tabs remain accessible — this controls the default, not visibility.

---

## 7. Data Contract

`deriveWcDashboardState(supabase, userId)` returns a single object containing
everything the card stack needs to render without secondary queries.

```typescript
interface WcDashboardState {
  /** The resolved dashboard state. */
  state: "visitor" | "bracket" | "format" | "overall" | "archive";

  /** Existing bracket snapshot — reuses BracketSnapshot type. */
  bracket: BracketSnapshot | null;

  /** Format classification membership. */
  formatMembership: {
    status: "active" | "eliminated" | "dead" | "winner" | "withdrawn";
    eliminatedAt?: string;
    eliminatedStage?: string;
  } | null;

  /** Whether the knockout prediction window is open. */
  knockoutOpen: boolean;

  /** Knockout bracket membership, if user engaged with it. */
  knockoutMembership: {
    status: "active" | "eliminated" | "dead" | "winner" | "withdrawn";
  } | null;

  /** Full bracket membership, if user engaged with it. */
  fullBracketMembership: {
    status: "active" | "eliminated" | "dead" | "winner" | "withdrawn";
  } | null;

  /** Compact overall standing for the summary card. */
  overallRank: {
    rank: number;
    points: number;
  } | null;

  /** Next actionable prediction window. */
  nextWindow: {
    id: string;
    name: string;
    lockTime: string;
    eventCount: number;
    userPredictionCount: number;
  } | null;
}
```

Pages call this function once and pass the result down. No page independently
re-derives Dashboard State from raw queries. See ADR 0012.

---

## 8. Knockout Bracket Timing

The Knockout Bracket card and classification surface appear on the dashboard
only after the knockout prediction window opens (post-Matchday 3 finalisation).

Before that point:
- KO Bracket is invisible on the dashboard.
- KO Bracket is mentioned in rules/FAQ as a future classification.
- During the bracket wizard, users are told: the pre-tournament bracket is
  borderline impossible — a knockout bracket opens after the group stage for a
  second shot at bracket glory.

---

## 9. Future Considerations (Out of Scope)

These items are noted but not designed in this document:

- **Custom classification card:** A future custom classification will sit as a
  prominent secondary card. The card stack ordering must accommodate a slot for
  this. Exact position TBD — between Format hero and matchday picks, or between
  matchday picks and bracket cards.

- **Nav adaptation:** Navigation may adapt to Dashboard State beyond leaderboard
  tab defaults. Deferred to mockup review.

- **Format onboarding animation:** Short animated demo showing familiar names
  progressing through group→tiebreak→knockouts elimination. Onboard-only.
  Not implemented until refined.

- **Public Format groups:** Groups of 32–48 strangers forming Format
  classifications, confirmed by email. Dormant cron or manual push notification.

- **~~R32 classification naming~~:** **Resolved in Section B.** Renamed to
  "The Cut" (tab label) / "Who Made the Cut" (full title).

- **~~Surface-wide polish~~:** **Resolved in Section C.** Copy tone rules,
  naming conventions, fixture card anatomy, brand mark placement, and
  visitor page narrative flow.

---

## 10. Visual Direction (Session B/C Reference)

The `/wc` surface should feel official. FIFA WC26 brand marks are available in
`design/` in multiple variants:

| File | Variant |
|---|---|
| `wc26-mark-stacked-fifa.png` | "26" stacked with FIFA wordmark |
| `wc26-mark-horizontal.png` | "26" horizontal, no text |
| `wc26-mark-stacked.png` | "26" stacked, no text |
| `wc26-mark-stacked-fifa-tm.png` | "26" stacked with FIFA + TM |
| `wc26-wordmark-full.png` | "FIFA WORLD CUP 26" full wordmark |
| `2026_FIFA_World_Cup_Logo_2023.png/svg` | Full colour logo |

Usage guidance:
- Mono black variants as subtle brand accents (card corners, section dividers,
  watermarks) on light backgrounds.
- Host city colorways from `design/WC26 host cities/colors.md` are the primary
  colour language for fixture cards, group headers, and bracket sections.
- The existing fixture/results card design (city colour background + white text)
  is the reference for what "looks good" — extend that pattern.

---

# Section B: Format Classification Hero Card

> Designed in Session B (2026-05-25). Defines the Format hero card content,
> modes, qualification shading, knockout adaptation, onboarding approach, and
> the enriched Format leaderboard tab.

---

## 11. Hero Card — Two Modes

The Format hero card is a single component with two rendering modes, determined
by whether PW1 has been finalised (i.e., Format standings exist with non-zero
points).

| Mode | Active when | Emotional register |
|---|---|---|
| **Weigh-in** (PW1) | PW1 not yet finalised | Curiosity — sizing up your rivals |
| **Survival** (post-PW1) | PW1 finalised onward | Tension — am I safe or in danger? |

The PW1 weigh-in mode IS the Format onboarding. There is no separate modal,
interstitial, or multi-step onboarding flow. The card itself orients the user.

---

## 12. Weigh-in Mode (PW1)

Card anatomy, top to bottom:

1. **Display name nudge** (conditional) — appears only if `display_name` is
   null or empty. A prominent inline nudge: "You'll appear as 'Player' — set
   your name" linking to `/profile`. Not an inline editor — the profile page
   handles name changes. Dismisses permanently once a name is set.

2. **One-liner headline** — sets the weigh-in tone. E.g., "Your group. Your
   rivals." Copy finalised in Session C.

3. **Group roster** — all group members listed by display name. No points
   column (everyone is at zero). No ranking. Just names. Tapping any row
   navigates to the Format detail page (see Section 16).

4. **Elimination curve** — compact horizontal sequence showing the full
   survival path. E.g., "12 → 8 → 5 → 4 → 3 → 2 → 1". Persists in both
   modes — always useful context.

5. **Minimal guide** — one or two sentences on Format rules. E.g., "Bottom of
   your group drops after the group stage. Points reset each stage." No scoring
   breakdown — the existing scoring section on `/wc` covers that. No KO Bracket
   messaging — that belongs in the bracket wizard (see Section 8).

6. **Explicit link** — "View all groups" linking to the enriched Format
   leaderboard tab (see Section 16).

---

## 13. Survival Mode (Post-PW1)

### Ternary headline

The card leads with a survival status headline. Three states:

| Status | Condition | Tone | Colour |
|---|---|---|---|
| **Safe** | Above the qualification line | Neutral | Default text |
| **Contested** | 3rd in a 4-player group (best-third lottery) | Amber | `ps-amber` |
| **Danger** | Below the qualification line | Red | `ps-red` |

Example headlines:
- Safe: "2nd of 4. You're through."
- Contested: "3rd of 4. Best third — your fate's in other groups' hands."
- Danger: "4th of 4. Below the line."

Copy is indicative — final wording in Session C.

### Qualification shading

The mini-leaderboard uses background shading to visually separate qualification
tiers. The shading mirrors the FIFA World Cup group stage qualification rules,
which is the entire point of the Format.

| Position | Group of 3 | Group of 4 | Group of 5 |
|---|---|---|---|
| 1st–2nd | Neutral (safe) | Neutral (safe) | Neutral (safe) |
| 3rd | Red (never qualifies) | Amber (best-third) | Neutral (auto-qualifies) |
| 4th | — | Red (eliminated) | Red (eliminated) |
| 5th | — | — | Red (eliminated) |

Colours: red shading uses `bg-ps-red/10`, amber shading uses `bg-ps-amber/10`.
Safe rows have no tint — the absence of colour means safety.

### Mini-leaderboard columns

Kept tight. Four elements per row:

- **Rank** (1st, 2nd, etc.)
- **Display name**
- **Stage-local points** (Format resets per stage)
- **YOU badge** on the current user's row

Excluded: movement arrows, tie-break detail, overall points, global rank across
groups. These belong on the full leaderboard, not the hero card.

### Persistent elements

- **Elimination curve** — same compact sequence as weigh-in mode.
- **Explicit link** — "View all groups" / "View full standings" at the card
  bottom, linking to `/wc/leaderboard?tab=format`.
- **Tappable roster rows** — tapping any row also navigates to the Format
  detail page. Same destination as the explicit link.

---

## 14. Knockout Stage Adaptation (PW4+)

After PW3 finalisation, the group stage cut happens and Format becomes a single
elimination pool. Groups dissolve. The hero card adapts:

### Neighbourhood view

Instead of a full group roster, the card shows a 3-row window into the survivor
pool:

- The row **above** the current user
- The current user's row (**YOU**)
- The row **below** the current user

If the user is 1st, show the top 3. If last, show the bottom 3.

The same qualification shading applies — rows below the stage's survival
threshold are red-tinted. The ternary headline adapts to pool context:
"5th of 8. Top 5 survive."

### Tap-through

The explicit link updates to "View full standings". Tapping any row or the link
navigates to `/wc/leaderboard?tab=format`, which shows the full survivor pool
leaderboard during knockouts.

---

## 15. R32 Classification Rename

**Resolved.** The R32 Classification is renamed:

| Context | Label |
|---|---|
| Tab bar (short) | The Cut |
| Full title (card headers, detail views) | Who Made the Cut |

No question mark on the full title. "The Cut" echoes the elimination theme and
describes what the user predicted — which teams survived the group stage.

---

## 16. Format Detail Page

The Format detail page is NOT a new route. It is an enhancement of the existing
Format tab on `/wc/leaderboard` (`ClassificationTabs.tsx`).

### Group stage content (PW1–PW3)

Top to bottom:

1. **Curve header** — elimination curve as a compact bar/sequence.
2. **Your group** — hero treatment. Full mini-leaderboard with qualification
   shading (neutral/amber/red). Same visual treatment as the hero card but at
   full width.
3. **All other groups** — listed below, each with their ranked members and
   stage-local points. Same shading rules.
4. **Best-third comparison table** — appears only if 4-player groups exist.
   Ranks all third-place finishers from 4-player groups to show which are in
   the strongest position for best-third qualification. This is the high-drama
   table for amber-zone users.

### Knockout stage content (PW4+)

The groups view is replaced by:

1. **Curve header** — updated to show current stage position in the curve.
2. **Full survivor pool leaderboard** — all remaining entrants ranked by
   stage-local points. Cut line visible via red shading on rows below the
   survival threshold.

---

## 17. Future Considerations (Section B)

These items are noted but not designed:

- **H2H knockout format:** A potential future classification type where knockout
  stage survivors are paired into head-to-head matchups each stage, rather than
  ranked in a single pool. Genuinely different from the current stage-leaderboard
  approach — would require its own classification type. Phase 2.

- **Format onboarding animation:** Still deferred (see Section 9). The PW1
  weigh-in card handles onboarding without animation.

- **Public Format groups:** Still deferred (see Section 9).

---

# Section C: Surface-Wide Polish

> Designed in Session C (2026-05-25). Defines the copy voice, naming
> conventions, fixture card anatomy, brand mark placement, and the visitor
> page narrative flow for the `/wc` surface.

---

## 18. Copy Tone — Two Tiers

All user-facing copy on the `/wc` surface falls into one of two tiers.

### Personality tier

Headlines, taglines, hero card status lines, celebration moments. The pub
chalkboard voice: confident, punchy, second-person.

Rules:

- **No exclamation marks.** One exception: the champion moment. Literally one
  `!` in the entire app. Everything else is periods and dashes.
- **Second person, present tense.** Always "you" / "your".
- **Fragment-first.** Good news and neutral status use bare fragments:
  "2nd of 4. You're through." Bad news and uncertainty use a fragment plus a
  clarifying clause after a dash: "4th of 4. Below the line — one more
  matchday to turn it around." The dash is the workhorse punctuation for
  adding context without going full-sentence.
- **No articles, no filler.** "Your call." not "It's your call."

### Functional tier

Navigation labels, status chips, form labels, instructional copy, progress
indicators. Clean and clear — no personality injection. "Open", "Locked",
"Matchday 2", "Select a matchday."

### The line between them

If the user is *reading it to understand what to do*, keep it functional. If
the user is *feeling something about their position*, give it personality.

### Ternary headline register

The Format hero card's survival headlines use two registers, not three.
Drama is good — it's a game, not a compliance notice.

| Status | Register | Example |
|---|---|---|
| Safe | Punchy fragment | "2nd of 4. You're through." |
| Contested | Fragment + clause | "3rd of 4. Best third — other groups decide your fate." |
| Danger | Fragment + clause | "4th of 4. Below the line — one more matchday to turn it around." |

---

## 19. Naming Conventions

### Prediction windows — user-facing labels

The `/wc` surface uses **two** user-facing terms depending on tournament
phase. The spec term "Prediction Window" and the DB term "Round" are never
shown to users.

| Phase | User sees | Examples |
|---|---|---|
| Group stage | **Matchday** | Matchday 1, Matchday 2, Matchday 3 |
| Knockout stage | **Stage name** | Round of 32, Round of 16, Quarter-finals, Semi-finals, Final |

The DB `rounds.name` values ("Group Matchday 1", "Round of 32", etc.) are
the source. Strip the "Group " prefix at display time for matchday labels.
Knockout names pass through verbatim.

Outside the `/wc` surface, "Round" remains the default user-facing label for
other competitions.

### Round-aware CTAs

Every picks CTA on the `/wc` surface names the current active window:

- Group stage: "**Matchday 2 picks →**"
- Knockout: "**Round of 16 picks →**"
- Secondary (bracket hero): "Or skip ahead to **Matchday 2** picks →"

If no active window exists or derivation fails for any reason, fall back to
**"Make your picks"**.

### Stages

"Stage" is the only term — no "Sporting Stage" qualifier. Lowercase in
running copy ("the group stage", "each stage"). See `CONTEXT.md` for the
full definition.

The group stage spans all three matchdays but counts as one Format
elimination stage. During knockouts, each round is its own stage. The Final
stage includes the third-place match — one prediction window, two fixtures.

### Knockout stage labels (canonical)

| DB code | User sees |
|---|---|
| `R32` | Round of 32 |
| `R16` | Round of 16 |
| `QF` | Quarter-finals |
| `SF` | Semi-finals |
| `3RD` | (not shown separately — bundled into Final window) |
| `FINAL` | Final |

No abbreviations in user-facing UI. Code-level abbreviations (`R32`, `QF`)
stay in code.

---

## 20. Fixture Card Anatomy

### Team display

- **Full country names** always. FIFA three-letter codes only as a last
  resort for genuinely tight layouts (e.g. compact bracket tree cells).
- **Pill-shaped flag icon** (`CountryFlag` with `shape="pill"`) on the `/wc`
  surface, per DESIGN-RULES.md. Always accompanies the team name.

### Time and date

- **User's local time only.** No dual-time display. No host-city timezone.
- **Time format:** device locale (12h or 24h). App-wide setting to override
  is a future feature — not designed here.
- **Date format:** abbreviated day, date number, abbreviated month.
  Example: "Wed 11 Jun".
- The host city still appears on the card as venue context and provides the
  background colour — but its timezone is not shown.

### Prediction status

No per-card status badge. The filled/empty state of the input controls is
the indicator — a selected winner button is visually distinct from an
unpicked state. Progress chips at the window level ("Outcomes: 3/8",
"Scores: 1/8") provide the overview.

### Result badges

| Badge | Meaning | Colour |
|---|---|---|
| **Final** | Result confirmed by admin | Ink on neutral chip (`bg-ps-chip text-ps-ink`) |
| **Provisional** | Result entered, not yet confirmed | Amber (`ps-amber`) |

"Final" must not use green — green means "correct prediction" in the
palette. Using it for result confirmation creates a false signal.

---

## 21. Brand Mark Placement

The sportspredict brand marks (Oracle Dot, Umpire, Bubble Call) play a
minimal role on the `/wc` surface. The FIFA WC 2026 mark owns the content
identity.

### Where marks appear

| Location | Treatment |
|---|---|
| **Nav bar** | `BrandMark` component, daily-stable weighted random (60/30/10). Existing behaviour, unchanged. |
| **Page footer** | Small `BrandMark` at the bottom of every `/wc` page. Subtle, low opacity, links to `/` (sportspredict home). A quiet "this is a sportspredict game" anchor. |

### Where marks do NOT appear

- **Landing page hero** — the triple-mark display (OracleDot + Umpire +
  BubbleCall) is removed. The FIFA hero image and "World Cup 2026" wordmark
  carry the page.
- **Page headers** — FIFA mark only, via `WcBrandedTitle`. No brand marks.
- **Cards, dividers, content** — no brand marks. Host city colours and pill
  flags are the visual language.
- **Celebration moments** — no brand marks. The celebration overlay
  (`MatchdayCompleteCelebration`) stands on its own.

---

## 22. Visitor Page — Narrative Flow

The `/wc` landing page for unauthenticated or new users uses a narrative
flow rather than a feature grid. The arc mirrors the predictor's journey
through the tournament.

### Page structure (top to bottom)

1. **FIFA hero image** — full-bleed, existing `hero-fifa-2026.png`.

2. **Title block** — "World Cup 2026" with "2026" in amber. Subtitle:
   "48 teams. Your call." in serif italic.

3. **Hook** — the four-beat tagline:
   > "Predict every match. Survive the cut. Outlast everyone. Win."

4. **Narrative beats** — four visual blocks, each with a personality-tier
   headline and one or two lines of functional-tier supporting copy. The
   beats map 1:1 to the hook's four phrases. Survive and Outlast should
   bleed into each other — continuous escalation, not hard boxes.

   | Beat | Hook phrase | What it explains |
   |---|---|---|
   | **Pick** | "Predict every match." | Winner and exact score predictions across all 104 matches. |
   | **Survive** | "Survive the cut." | Format — groups of four, bottom drops each stage. The elimination drama. |
   | **Outlast** | "Outlast everyone." | Multiple classifications — Overall cumulative, Bracket all-or-nothing. |
   | **Claim** | "Win." | Leaderboard, bragging rights, the payoff. |

5. **Countdown** — "X days to kickoff" widget. Pre-tournament only.
   Disappears once the tournament starts — page gets shorter, CTA moves up.

6. **CTA** — round-aware primary button. Names the current active window
   ("Matchday 1 picks →"). Falls back to "Make your picks" if no active
   window. Gold gradient, same existing button style.

7. **Rules link** — "Simple scoring. Full rules →" as a text link to
   `/wc/rules`. Below the CTA, for the curious. Not prominent.

8. **Footer brand mark** — small `BrandMark` linking to `/`. Last element
   on the page.

### What was removed

- **Triple brand mark display** in the hero section.
- **"Viva Mexico"** country label.
- **Five-card classification grid** ("Five ways to play") — replaced by the
  narrative beats.
- **Scoring section** (three-row list + max-points footer) — moved to
  `/wc/rules` only, replaced by the text link.
- **Host cities ticker** ("Mexico City · Guadalajara · Monterrey").

---

## 23. Future Considerations (Section C)

- **Time format setting:** App-wide user preference for 12h/24h time
  display. Not designed here — device locale is the default until the
  settings page exists.

- **Narrative beat copy:** The beat headlines and supporting copy in
  Section 22 are structural — final wording is an implementation-time
  decision within the tone rules defined in Section 18.

- **Overall Classification detail view:** Noted in previous sessions as
  needing engagement work — most users land here by QF/SF stage. Not
  addressed in this section.

- **Animated demo concept:** Still deferred (see Section 9).
