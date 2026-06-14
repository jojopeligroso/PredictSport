# PLAN — `<ScoreDisplay>` primitive + migration (PRs 2-5 of 5)

**Date:** 2026-06-14
**Status:** Planned. Blocked by `[[PLAN-extract-result-shape]]` (PR 1).
**Owner:** next session(s) — split across 4 PRs.
**Risk:** Low per-PR, cumulative blast surface managed by sequencing.
**Active users at risk:** 48 (per `[[predictsport-active-user-count]]`).

---

## Why this exists

Today there are SIX independent implementations of "render two score digits":

| # | Site | Current shape |
|---|---|---|
| 1 | `FixturesTabs.tsx:790-792` (finished card scoreboard) | `font-mono text-xl/text-lg font-extrabold tabular-nums text-white drop-shadow` |
| 2 | `FixturesTabs.tsx:821` (your pick inline, finished card footer) | `text-[11px]` parent-inherited |
| 3 | `RivalPredictionsTab.tsx:307-309` (rival header actual result pill) | `font-mono text-[11px] font-semibold text-ps-green` |
| 4 | `RivalPredictionsTab.tsx:591-593` (rival back-of-card predicted score) | `font-mono text-[15px] font-bold text-ps-text` |
| 5 | `CommunityPicksCard.tsx:160-175` (popular score chips) | `font-mono tabular-nums` various weights |
| 6 | `WindowPickList.tsx:644-700` locked branch (your prediction summary) | delegates to `getPredictionSummary` string formatter — no styling primitive at all |

Plus admin/bracket: `ResultPanel`, `GroupMatchCard`, `MatchCard`, `GroupResultsStep`, `GroupStagePredictor`, `ThirdPlaceRankingStep`, `CorrectionFlow` — each open-codes its own digit treatment.

The fragmentation IS the bug. Standardising the visual treatment (the 2026-06-14 user request) without first consolidating means N call sites get edited per future change. Building the primitive first means future visual tweaks land in one file.

## What this is NOT

- **Not** a replacement for `ScoreInput`. `ScoreInput` stays separate — it's an interactive form widget, not a display primitive. Conflating them is a bigger refactor; see `[[PLAN-score-entry-refactor]]`.
- **Not** a new design system. One primitive, one file. No `/design-system/` folder. No atomic-design rebuild.
- **Not** opinionated about correctness rings, FINAL pills, or lock badges. Those live on parent surfaces and stay there.

---

## The primitive

File: `src/components/wc/ScoreDisplay.tsx`. **Server-safe** (no `"use client"`, no hooks, no Date, no event handlers).

```tsx
import { type ReactNode } from "react";

export type ScoreDisplayProps = {
  /** Home team score. null = no score yet / placeholder. */
  home: number | null;
  /** Away team score. null = no score yet / placeholder. */
  away: number | null;
  /** Visual size. Defaults to `md`. */
  size?: "sm" | "md" | "lg";
  /** Surface the digits sit on. Drives colour token + drop-shadow. */
  tone?: "ink" | "on-color" | "muted";
  /** Separator glyph between scores. Defaults to en-dash. */
  separator?: "dash" | "vs";
  /** Placeholder character when home/away is null. Defaults to "–". */
  placeholder?: string;
  /** Optional aria-label override. Default: "Score: {home} to {away}". */
  ariaLabel?: string;
};

const SIZE_CLASSES: Record<NonNullable<ScoreDisplayProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};

const TONE_CLASSES: Record<NonNullable<ScoreDisplayProps["tone"]>, string> = {
  ink: "text-ps-ink",
  "on-color": "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
  muted: "text-ps-text-sec",
};

export function ScoreDisplay({
  home,
  away,
  size = "md",
  tone = "ink",
  separator = "dash",
  placeholder = "–",
  ariaLabel,
}: ScoreDisplayProps): ReactNode {
  const homeText = home === null ? placeholder : String(home);
  const awayText = away === null ? placeholder : String(away);
  const sep = separator === "dash" ? "–" : "vs";

  const label =
    ariaLabel ??
    (home !== null && away !== null
      ? `Score: ${home} to ${away}`
      : "Score not yet available");

  return (
    <span
      aria-label={label}
      className={`inline-flex items-baseline gap-1.5 font-mono font-extrabold tabular-nums ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]}`}
    >
      <span>{homeText}</span>
      <span className="opacity-70">{sep}</span>
      <span>{awayText}</span>
    </span>
  );
}
```

### Deliberate design decisions (and what was rejected)

| Decision | Rationale |
|---|---|
| `home` and `away` as separate `number \| null` props | Half-resolved cases (rival has predicted, result not in) work without defensive `score?.home`. |
| **No** `variant: "prediction" \| "result" \| "rival"` prop | Conflates *who's looking* with *how it renders*. Visual difference is `size + tone` only. Adding "yet another role" doesn't force a new variant value. |
| **No** `correctness` or `locked` prop | Those drive surrounding container chrome (ring, pill), not the digits. Pushing them in creates a leaky abstraction with `PredictionRow`'s rowClass. |
| **No** `eventId` or `resultData` prop | The primitive must never see raw blobs. Caller normalises via `extractResultScore()` from PR 1. |
| Server-safe, no hooks | Allows future RSC results page without converting children. ESLint or a top-of-file comment enforces. |
| `tabular-nums` always on | "10–0" must align cleanly with "2–0". Non-negotiable. |
| `font-extrabold` always on | Matches the canonical finished-result scoreboard treatment (`FixturesTabs.tsx:790`). Standardises across all surfaces. |

### What the primitive intentionally cannot do

- Render a winner-only result (e.g. "Australia won"). That's a different concept; call sites that need it should keep their existing string output and use `<ScoreDisplay>` only when both `home` and `away` exist.
- Animate. The primitive returns static markup. Any flip/fade lives on the parent.
- Tap. No `onClick`. Tap-to-edit affordances stay on the parent.

---

## Migration sequence (PRs 2 → 5)

Each PR is independently revertable. Each migrates ONE surface, validates the API, and only then proceeds. The user has 48 active users mid-competition; a 30-min regression on FixturesTabs during a fixture window is the worst case to avoid.

### PR 2 — Build the primitive, zero callers

**Title:** `Add ScoreDisplay primitive (no migrations yet)`

- Create `src/components/wc/ScoreDisplay.tsx`.
- Add a smoke-test usage at `src/app/wc/_debug/score-display/page.tsx` (or just a Storybook-style harness) showing all 9 combinations of size × tone.
- Zero behaviour change for end users.

**Verification:** open the debug page, eyeball every variant against:
- A cream background (`bg-ps-cream`) — `tone="ink"` must read at >= 7:1 contrast.
- A saturated host-city background (use Mexico City teal) — `tone="on-color"` digit must be legible.
- Compare side-by-side against current `FixturesTabs.tsx:790` rendering — pixel-near-identical.

**Rollback:** delete the file. Zero impact.

### PR 3 — Migrate the lowest-risk site: rival header

**Title:** `Use ScoreDisplay in RivalPredictionsTab header`

Replaces `RivalPredictionsTab.tsx:307-309`. Current treatment:
```tsx
<span className="font-mono text-[11px] font-semibold text-ps-green">
  {homeScore} – {awayScore}
</span>
```
After:
```tsx
<ScoreDisplay home={homeScore} away={awayScore} size="sm" tone="muted" />
```

(`tone="muted"` produces `text-ps-text-sec`, NOT `text-ps-green` — this is a tiny visual shift to standardise. If the green is load-bearing for "result confirmed", that signalling moves to a sibling element such as a small "FINAL" pill, not the digits themselves. Decide before merge.)

**Why this site first:** isolated, low traffic relative to FixturesTabs scoreboard, single-line replacement. If the API or the visual treatment is wrong, only this surface regresses.

**Verification:** open `/wc/leaderboard?tab=rivals`. Switch through several past fixtures with confirmed results. Confirm score reads cleanly. Confirm the surrounding "FINAL" semantics still communicate (move the green to an adjacent pill if needed).

**Rollback:** one-line revert.

### PR 4 — Migrate the headline site: FixturesTabs scoreboard

**Title:** `Use ScoreDisplay in FixturesTabs result scoreboard`

Replaces `FixturesTabs.tsx:790-792` (the prominent inset scoreboard on finished cards). Highest-visibility site — every finished card on `/wc/results` and the dashboard shows this.

After:
```tsx
<ScoreDisplay
  home={result.homeScore}
  away={result.awayScore}
  size="lg"
  tone="on-color"
/>
```

**Verification — must be done on real device:**
- Open `/wc/results` on a phone.
- Cycle through cards across **all 12 host-city colours** (see `FifaGroupCard.tsx:10-23` for the list — Seattle olive, Miami pink, Mexico City teal, Madrid cream, etc.).
- Confirm digit is legible on every background. The drop-shadow in `tone="on-color"` is the anchor — if it fails on Madrid cream (light bg + white digit + light shadow = invisible), the tone needs a separate "on-light-color" variant. This is the single highest-risk pixel in the whole consolidation.

**Rollback:** revert the JSX block. No data, no migration.

### PR 5 — Sweep the rest

**Title:** `Use ScoreDisplay across remaining surfaces`

Migrate in order, smallest blast radius first:
1. `RivalPredictionsTab.tsx:591-593` (back-of-card rival predicted score) — `size="md" tone="ink"`.
2. `CommunityPicksCard.tsx:160-175` — `size="sm" tone="ink"`.
3. `FixturesTabs.tsx:821` (your pick inline, finished card footer) — `size="sm" tone="muted"`.
4. `WindowPickList.tsx:644-700` (locked-branch prediction summary) — requires splitting the `getPredictionSummary` string output; see "Risk" below.

**Stop at the WC surfaces.** Admin/bracket components (ResultPanel, MatchCard, GroupMatchCard, etc.) are out of scope for this consolidation — they serve admin users only, not the 48-user player base. Separate plan if user wants them done.

**Verification:** for each migrated site, screenshot before/after, compare in a diff viewer. No regressions expected; the size+tone choices above mirror current treatments closely.

**Rollback:** per-site revert. Each site is a separate commit within the same PR for clean granular rollback.

---

## Risks

1. **`getPredictionSummary` string coupling.** `WindowPickList.tsx:644-700` uses a localised string ("Picked: {team} ({h}–{a})") from `src/lib/prediction-summary.ts`. Naive `<ScoreDisplay>` insertion drops the team label + i18n. Fix: keep the team-label string formatter, render `<ScoreDisplay>` inline as a sibling. Two i18n keys: `picks.summary.label` (= "Picked: {team}") and the digits handled outside the i18n string entirely. Coordinate with `docs/translations/` keys before merge.
2. **Drop-shadow on light host-city backgrounds.** Madrid cream + white digit + light shadow may fail. If PR 4 verification catches this, add a fourth tone `"on-light-color"` with `text-ps-ink drop-shadow-[0_1px_2px_rgba(255,255,255,0.7)]` (inverted shadow) and route Madrid-class cards to it. Don't bundle this into PR 4 — fix in PR 4.1.
3. **`RivalPredictionsTab` flip animation.** Lines 454-460 use `rotateX` + `backface-visibility` on the row. `<ScoreDisplay>` renders flat markup with no intrinsic dimensions to fight the transform — should be safe. Verify in PR 5 when the back-of-card site migrates.
4. **Separator glyph drift.** Today: `RivalPredictionsTab.tsx:309` uses ` – ` (en-dash, space-padded). `FixturesTabs.tsx:792` uses ` – ` likewise. Back-of-card `:591-593` uses `–` no spaces. The primitive enforces `gap-1.5` between flex children — visually similar to space-padded en-dash but not identical. Test PR 3 and PR 4 carefully; if either looks tight, bump to `gap-2`.
5. **Aria-label drift.** Existing sites use `aria-label={\`${homeLabel} score\`}` (one per input) or none at all. Primitive uses `aria-label="Score: 2 to 0"` (one per pair). Cleaner for screen readers but if your accessibility audit relies on the existing pattern, document the change.
6. **`tone="on-color"` is opinionated about drop-shadow strength.** If user prefers a stronger or weaker shadow than `0 1px 2px rgba(0,0,0,0.5)`, change once in the primitive — that's the whole point.
7. **Bundle size.** Negligible (~500 bytes). Worth mentioning only because the primitive will be imported into ~6 client components; tree-shaking handles unused tone branches.

---

## Per-PR PR boundaries summary

| PR | Title | Touches | Blast |
|---|---|---|---|
| 2 | Add ScoreDisplay primitive | new file + debug page | none (no callers) |
| 3 | Use in RivalPredictionsTab header | 1 file, ~5 lines | rivals tab only |
| 4 | Use in FixturesTabs scoreboard | 1 file, ~5 lines | every finished card |
| 5 | Sweep remaining WC surfaces | 4 files, ~25 lines | dashboard + rivals back-face + community + window-pick-list |

**Never bundle.** Each PR independently revertable. Total elapsed time across the four PRs: pick whatever cadence feels safe; no calendar pressure.

## Out of scope (future work)

- Score *entry* unification — see `[[PLAN-score-entry-refactor]]`.
- Admin/bracket components — separate plan if needed.
- Promoting the rival header result to a dominant scoreboard — see `[[PLAN-rival-header]]`.
- Surfacing fixture results on `FifaGroupCard` (groups grid view) — see `[[PLAN-groups-table-results]]`. That's a layout + data change, not a digit-rendering change.

---

**Related plans:** `[[PLAN-extract-result-shape]]` (PR 1, must ship first), `[[PLAN-score-entry-refactor]]`, `[[PLAN-rival-header]]`, `[[PLAN-groups-table-results]]`. **Related memory:** `[[predictsport-result-data-shape]]`, `[[predictsport-active-user-count]]`.
