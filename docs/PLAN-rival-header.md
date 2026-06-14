# PLAN — Promote actual result on `RivalPredictionsTab` header

**Date:** 2026-06-14
**Status:** Planned. **Awaiting product decision** before implementation.
**Owner:** next session, conditional on user signoff
**Risk:** Low (single component) but visible layout change.

---

## The problem

`src/components/wc/RivalPredictionsTab.tsx:300-310` renders the actual fixture result inside a small status pill — `font-mono text-[11px] font-semibold text-ps-green`. At 11px on a phone, surrounded by pill chrome, the result is one of the smallest elements on the page. Users open the rivals tab to compare picks; the actual result is the reference point for that comparison and currently it's buried.

## Two paths

### Path A — Keep pill, just enlarge digits (low risk, low impact)

Bump the pill content from `text-[11px]` to `text-sm`, weight from `semibold` to `extrabold`, add `tabular-nums`. Pill chrome stays.

**Pros:** 5-line change, identical layout, zero blast radius.
**Cons:** result still subordinate to surrounding UI; not really "promoted."

### Path B — Promote result out of the pill into a scoreboard block (medium risk, real impact)

Remove the pill chrome around the result. Render the result as a dedicated scoreboard block above the rival picks list — same treatment as `FixturesTabs.tsx:790-792` (the inset scoreboard on finished cards). The "FINAL" semantics move to a small label adjacent to the scoreboard rather than wrapping it.

**Pros:** result becomes the visual anchor of the rivals tab, matching its role as the comparison reference. Standardises with FixturesTabs treatment.
**Cons:** layout change. Need to verify it doesn't push the rival list below the fold on small viewports.

### Recommendation: Path B

Path A is a polish pass; Path B addresses the user's underlying intent (result deserves dominance). If `<ScoreDisplay>` from `[[PLAN-score-display-primitive]]` has shipped, Path B becomes trivial.

---

## Path B implementation (conditional)

**Prerequisite:** `<ScoreDisplay>` primitive (PR 2 of score-display consolidation) should ideally be in place. If not, this plan can ship with ad-hoc digit markup matching the FixturesTabs treatment, and convert later.

### Sketch

Current header structure (`RivalPredictionsTab.tsx` around lines 280-330):
```tsx
<div className="...header pill...">
  <span>FINAL · {homeScore} – {awayScore}</span>
</div>
{/* rival picks list */}
```

Proposed:
```tsx
{hasResult && (
  <div className="mb-4 rounded-2xl bg-[host-city-color] p-4 text-center">
    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
      FINAL
    </p>
    <div className="mt-1">
      <ScoreDisplay
        home={homeScore}
        away={awayScore}
        size="lg"
        tone="on-color"
      />
    </div>
    <p className="mt-1 text-[11px] text-white/85">
      {fixture.home} vs {fixture.away}
    </p>
  </div>
)}
{/* rival picks list — unchanged */}
```

(Exact host-city-color binding follows the same pattern as FixturesTabs — see `useGroupCityColor` or similar helper. Read the code before deciding which token applies.)

### What about fixtures with no result yet?

`hasResult = resultConfirmed && homeScore !== null` (already computed at `:214`). When false, skip the scoreboard block entirely. Today the pill shows a generic "Open" or "Pending" state — replace with a lighter chip above the rivals list:

```tsx
{!hasResult && (
  <div className="mb-4 rounded-full bg-ps-surface border border-ps-border px-3 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ps-text-sec">
    Locked · Awaiting result
  </div>
)}
```

---

## Blast radius

- Single component: `src/components/wc/RivalPredictionsTab.tsx`.
- Visual: rivals tab header rearranges. The picks list below moves down by ~50-80px (the scoreboard block height). On a 390px viewport this is a real shift but not a regression — the list was already not pinned to the top.
- Behavioural: zero. No new data, no new interactions, no new state.

## Verification

- [ ] Open `/wc/leaderboard?tab=rivals` on a phone (390px).
- [ ] Pick a fixture with a confirmed result. Confirm scoreboard renders above rivals list, legible at arms' length.
- [ ] Pick a fixture that's locked but not resolved. Confirm "Locked · Awaiting result" chip renders instead.
- [ ] Pick a fixture that's still upcoming (not locked). Confirm whatever the current upcoming-state header shows still renders — this plan does not touch that branch.
- [ ] Switch host cities. Confirm the scoreboard background colour matches the fixture's host city (same logic as FixturesTabs).
- [ ] Scroll: confirm the rivals list is reachable without sticky-header collisions.

## Rollback

Single PR revert. No data.

## Risks

1. **Scrolling cost.** Moving the result to a dominant block pushes the rivals list down. If users routinely look at rivals first (not the result), this hurts them. Counter-argument: if they wanted rivals first, they'd already know the score from elsewhere — but they came to this tab because the result is the context. Net positive.
2. **Visual weight competition.** A large scoreboard above a list of rival-pick rows may dominate. Verify on real device; if it feels disproportionate, shrink `size="lg"` to `size="md"`.
3. **Layout grid.** If RivalPredictionsTab is rendered inside a constrained container (likely `max-w-[480px]`), the scoreboard block's padding must respect the container — `p-4` not `p-6`.
4. **No interaction with the per-row card flip.** The header is above the list; the rotation animation is per row. Independent.

## Out of scope

- The per-row rival card (back-of-card predicted score) — handled by `[[PLAN-score-display-primitive]]` PR 5.
- Any rivals-tab-only filtering, sorting, or grouping changes.

---

**Awaiting from user:**
1. Path A or Path B? (recommended: Path B)
2. If Path B: should the scoreboard show the host-city colour (matches FixturesTabs identity), or use a neutral surface (`bg-ps-surface`)?
3. Any explicit "don't touch" elements on the current rivals header that this plan should preserve?

---

**Related plans:** `[[PLAN-score-display-primitive]]` (recommended dependency).
