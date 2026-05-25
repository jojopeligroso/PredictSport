# Design: WC Dashboard State Machine

> Section A of a three-part design doc. This section defines the state machine,
> card stacks, derivation rules, and data contract for the `/wc` dashboard.
>
> - **Section B** (future session): Format Classification hero surface — what
>   the user sees when Format is primary, onboarding flow, rules presentation.
> - **Section C** (future session): Surface-wide polish — copy tone rules,
>   fixture card anatomy, naming conventions, brand mark usage.

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

- **R32 classification naming:** Current name ("R32 Classification" / "Last 32")
  is weak. This is more of a fun stat (X/32 correct) than a competitive
  classification. Needs a better name. Session C territory.

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
