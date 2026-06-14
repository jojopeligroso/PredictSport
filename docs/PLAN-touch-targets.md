# PLAN — Enlarge `ScoreInput` touch targets to 44×44

**Date:** 2026-06-14
**Status:** Planned. Standalone — no dependencies.
**Owner:** next session
**Risk:** Very low. Visual chip size unchanged. Hitbox grows invisibly via negative margin.

---

## Goal

`ScoreInput` chips render at `w-[34px] h-[32px]` (`src/components/ScoreInput.tsx:240, 259`) — below the iOS HIG minimum of 44×44 and below WCAG 2.5.5 AAA. The Mobile App Builder audit flagged that this compounds the visibility problem: small targets + low contrast = mis-taps + "I can't see what I picked." The 2026-06-14 contrast fix addressed half. This plan addresses the other half.

## The technique: invisible halo

Wrap the `<input>` in a span with `p-2 -m-2` (or `p-[6px] -m-[6px]` for finer control). The padding makes the tap target 44×44; the negative margin pulls surrounding layout back to where it was, so no visible change. Standard accessibility pattern, works in every browser, no CSS hacks.

```tsx
<span className="inline-flex p-[6px] -m-[6px]">
  <input ... className="w-[34px] h-[32px] ..." />
</span>
```

Effective tap surface: `34 + 12 = 46px wide`, `32 + 12 = 44px tall`. Above the 44 minimum on both axes.

**Why span not div:** the parent `div.flex.items-center.gap-2` arranges inputs in a horizontal flex row. A `<div>` wrapper would break baseline alignment with surrounding elements (Draw button, team buttons). `<span>` with `inline-flex` keeps the input on the same flex baseline.

---

## Touch list

### 1. `src/components/ScoreInput.tsx` — card variant (lines 225-263)

Wrap the home input (line 225) and away input (line 246) each in a span halo. ~6 lines of JSX added per input.

### 2. `src/components/ScoreInput.tsx` — compact variant (lines 195-218)

Same wrap. Compact variant is used elsewhere; halo doesn't break it (negative margin is symmetric).

### 3. `src/components/ScoreInput.tsx` — standard variant (lines 268+)

Same wrap if the chip is also small. Read the file before deciding — if standard is already large enough, skip.

### 4. `src/components/wc/FixturesTabs.tsx` — inline inputs (lines 677, 720)

Same halo wrap on the home/away inputs inside the FixturesTabs Results-tab card.

### 5. Optional audit — other small targets

While you're in there, grep for other small interactive elements:

```bash
grep -rn 'w-\[\(2\|3\)[0-9]\|h-\[\(2\|3\)[0-9]' src/components/wc/ src/components/ src/app/wc/ | grep -E 'button|input|a href'
```

Common candidates likely under 44px: TabBar icons (already validated, leave alone), CountdownChip dismiss buttons, ToggleSwitch knobs (recently sized — leave). Be surgical. This PR's title is "touch targets on ScoreInput"; scope-creep into other components belongs in a follow-up.

---

## Blast radius

- **Visual:** zero. Negative margin pulls layout back.
- **Behavioural:** taps that previously landed on the gap between inputs now resolve to the nearest input. Net positive — fewer mis-taps.
- **Accessibility:** improvement, no regression. WCAG 2.5.5 AAA now passes for these inputs.
- **iOS Safari:** confirmed pattern. No -webkit prefixes needed.

## Verification

- [ ] On phone, open `/wc/picks/[windowId]` and enter a score. Tap each digit input. Confirm taps land reliably even when thumb partially covers the gap between inputs.
- [ ] On `/wc/results`, expand an upcoming card, enter a score in the inline inputs. Same test.
- [ ] Inspect element in browser devtools. Confirm the visible chip is still 34×32. Confirm the tap target (the wrapping span's box model) is 46×44.
- [ ] No layout shift before/after — capture a screenshot of the inputs row pre- and post-PR; pixel diff should be empty.

## Rollback

Single PR revert. Halo wrapper deletion returns inputs to current behaviour. No state, no data.

## Risks

1. **Flex baseline.** If the wrapping span shifts the input's baseline within the parent flex row (Draw button, team buttons), the score chip may sit a pixel high or low. `inline-flex items-center` on the span keeps it baseline-aligned. Verify on device.
2. **Focus ring.** The focus ring is on the `<input>`, not the wrapper. Negative margin doesn't clip it. Already verified — current focus treatment (`focus:border-ps-amber`) is applied to the input itself.
3. **Overlapping halos.** Adjacent halos with `gap-2` (8px) between inputs and `-m-[6px]` on each side = halos overlap by 4px. The browser resolves overlap by hit-test order (later DOM wins). In practice this means a tap exactly between the home and away inputs lands on whichever comes later in DOM. For score inputs that's the away — fine, since users tab home→away anyway.
4. **Don't apply to chips that ARE buttons inside other chips.** Just the actual `<input>` elements. Don't wrap the Draw button (already `py-2.5` = 44+); don't wrap team buttons.

## Out of scope

- Other small interactive elements outside `ScoreInput` and FixturesTabs inline inputs. Separate audit + PR if user wants them.
- Visual size change. This plan deliberately keeps the chip at 34×32. Growing the visible chip is a design decision, not an accessibility fix.

---

**Related plans:** `[[PLAN-score-entry-refactor]]` (would absorb this once entry inputs are unified).
