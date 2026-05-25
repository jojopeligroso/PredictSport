# WC Bracket Poster — design mockup

Static HTML mockup that explores the visual language for `/wc/bracket` and the
wizard's review step. Modeled on the official FIFA 2026 bracket poster, with
PredictSport-specific adaptations.

Open at:

    http://127.0.0.1:8000/design/wc-poster/poster.html

(served from the repo root, e.g. `python3 -m http.server 8000`)

## Status

**Working well — ready to port:**

- Standalone unfolded view (`/wc/bracket` at ≥900px) reads correctly.
- 12 group cards with taxonomic neon borders + coloured `GROUP X` label tabs.
- Tapping a group expands a mini standings table (flag, country, GP/W/D/L/Pts)
  sorted by points, top-2 highlighted, last row dimmed.
- R32 split into two columns: team chips (16 per side, paired tight) feeding
  winner pills (8 per side). Each chip = one team; each chip-pair = one match.
- Pill silhouette identical to production `CountryFlag pill` — same clip-path,
  with a `mirrored` variant for the right half of the bracket so the two sides
  form a true reflection.
- Progressive slot sizes per round (R32 36×27 → R16 42×32 → QF 52×39 → SF 64×48
  → Final 78×58) create a visual crescendo toward the centre.
- Final pair stacked vertically (top = SFL winner, bottom = SFR winner) with
  the 3rd-place pair below at 35% scale.
- Connector lines computed at runtime from real slot DOM positions, redraw on
  resize. Pair-converge geometry with right-angle bends, terminating on the
  flat edges of each pill.
- Champion card below the bracket with large flag pill + country name.

## What needs work

### Side B folded view
- Final → SF connector line missing on the left edge after the row-reverse
  flip. The line algorithm doesn't yet account for the bracket being mirrored
  in the folded layout.
- "3rd place" caption still present — user asked for it to be removed (was
  kept in unfolded view, hasn't propagated to folded).

### Group card flag pills are still flat rectangles
The 4 small flag pills inside each group card render as plain rectangles, not
the pill silhouette. Suspected cause: a CSS specificity conflict between
`buildPill`'s inline `width/height/top/left` and the `.pill-frame > .inner`
rule that may be applied later. Not investigated yet — the in-card flags need
to use the same clip-path silhouette as everywhere else.

### Team chip expand-on-click
The chip CSS supports `.expanded` (220px wide, with `.team-detail` populated)
and a `.close` button, but the click handler hasn't been wired in. Tapping a
chip should:
1. Close any other expanded chip / fixture card / group card
2. Add `.expanded` class
3. Populate `.team-detail` with the chip's country name + the user's
   prediction for that team (GP/W/D/L from `GROUPS[<group>].teams`)

### Wizard panel
- Unfolded view in the 760px wizard panel scrolls horizontally — acceptable
  but ugly. Consider scaling the bracket down with `transform: scale()` for
  the wizard context, or constraining slot sizes more aggressively.
- Folded view shows only one finalist (this side's). The other finalist's
  slot stays empty placeholder; that's the desired UX but the empty slot
  reads as "unfilled" rather than "TBD from other side". Worth a `.placeholder`
  dimming treatment.

### Connector lines
- They're computed in JS from `getBoundingClientRect`. Cheap, but it does mean
  a flash of missing lines on first paint before `requestAnimationFrame` fires.
  When porting to React, draw the SVG paths in a `useLayoutEffect`.
- Lines are 1.25px solid — at retina they snap to ~2.5px which looks slightly
  heavy. Try 1px with `vector-effect="non-scaling-stroke"` once in production.

### Geometry tokens
The slot sizes, pair gaps, and column widths are CSS custom properties scoped
to `:root`. When porting:
- Move them into a `wc-bracket.module.css` co-located with the component.
- The R32 layout uses JS constants (`CHIP_H`, `R32_BLOCK_H`, `R32_LOOSE_GAP`)
  that should match the CSS values — extract into a shared `geometry.ts`.

### Group standings table
Per-team records are mocked (`t('Mexico','mx',2,1,0)` style). In production
they should come from the same `predictions`-derived `groupData` that the
existing `LiveGroupStandings` component uses. The table format itself is
ready — just swap the data source.

### Not yet built
- Mobile (390px) layout for the standalone view. Currently it falls back to
  folded mode by viewport detection. Not yet tested end-to-end at 390px.
- Filled state — every pill is empty. We haven't styled what a slot looks
  like once a country has been picked into it. The plan: drop a `CountryFlag
  pill` of the same dimensions into the slot, with a slight glow on the
  predicted winner.
- Score input flow from the fixture card actually persisting back into the
  user's bracket data. The fixture card UI is wired visually but `[data-pick]`
  buttons only toggle their pressed state — no data submission.

## Files

- `poster.html` — the entire mockup (CSS + JS in one file by design — easier
  to iterate). Will split into React components when porting.
- `../wc-poster/` is **mockup only**. Do not import from real app code.

## Production port plan (sketch)

```
src/components/wc/bracket/
  WcBracketPoster.tsx          ← top-level, accepts submission data
  WcGroupRail.tsx              ← rail of group cards, side='left'|'right'
  WcGroupCard.tsx              ← single group card with expand-to-standings
  WcGroupStandingsTable.tsx    ← table extracted from group expand
  WcR32TeamChip.tsx            ← clickable seed chip
  WcR32WinnerColumn.tsx        ← winner pills, derived positions
  WcRoundColumn.tsx            ← R16 / QF / SF / Final / 3rd, derived
  WcCentreStack.tsx            ← Final pair + 3rd-place pair
  WcConnectorLines.tsx         ← SVG overlay, computed in useLayoutEffect
  geometry.ts                  ← SIZES, gaps, pair maths, pill paths
```

Reuse `CountryFlag shape="pill"` directly — don't reimplement the pill
silhouette. The mockup's `buildPill` and `buildSlotPill` should both become
calls to that component (with a `placeholder` variant for empty slots).
