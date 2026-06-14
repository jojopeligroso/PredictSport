# PLAN — Unify score-entry inputs (`ScoreInput` ↔ FixturesTabs inline inputs)

**Date:** 2026-06-14
**Status:** Planned. **Larger refactor — explicitly NOT bundled with the display-consolidation work.**
**Owner:** next session, when appetite for a multi-PR form-state refactor exists
**Risk:** Medium-high. Form state, focus management, debounce timing, submit path.

---

## Why this is a separate plan

`ScoreInput.tsx` (the picks-flow widget) and the inline `<input>` plumbing at `FixturesTabs.tsx:677-735` (the Results-tab inline-edit widget) do nearly the same job: take two numeric inputs, validate, debounce, submit. They have diverged. Today's 2026-06-14 contrast fix patched BOTH because they're literally the same CSS bug copy-pasted. Future bugs will keep needing to be fixed twice unless they're unified.

But unifying them is NOT a CSS task. It's a form-state task. The two widgets have different:

| Concern | `ScoreInput.tsx` | `FixturesTabs.tsx:677-735` |
|---|---|---|
| Focus management | `homeRef`/`awayRef`, auto-advance on home complete | `awayInputRef`, auto-advance on home non-empty |
| Debounce | `lastCommitted` dedup + 1.75s blur timer (`:38-177`) | `onBlur` immediate submit (`:692`) |
| Ghost value | `homeGhost`/`awayGhost` (`:108`) — previously-entered shown on refocus | None — placeholder is literal "–" |
| Submit handler | Parent-provided `onSubmit({home, away})` | Inline `handleScoreBlur(homeScore, awayScore)` |
| Validation | maxLength 2, numeric strip | maxLength 2, numeric strip |
| Variants | `compact`, `card`, `standard` | None — single inline layout |
| Disabled handling | `disabled` prop | Tied to `prediction?.hasExactScore` gate |

The two widgets have evolved in parallel. Reconciling means choosing whose semantics win — and that's a design + product call, not just a refactor.

## What this plan does NOT propose

- Unify in a single PR. That's the wrong scope.
- Unify before `<ScoreDisplay>` lands. Display first, entry second. Entry without display still works; display without entry standardisation still works.
- Change behaviour. The goal is one widget that supports both today's behaviours via opt-in props.

## Proposed approach

### Phase A — Audit and decide canonical semantics (no code)

Sit down with the two widgets side-by-side. For each divergence in the table above, decide the canonical answer. Document in this plan as an addendum:

- Should auto-advance trigger on first keystroke (FixturesTabs) or on home-complete (ScoreInput)?
- Should ghost values exist universally, or only in picks flow?
- Should blur trigger immediate submit (FixturesTabs) or debounced submit (ScoreInput)?
- Should the widget own its submit handler or delegate?

Until these are answered, no code change can land cleanly.

### Phase B — Extend `ScoreInput` with the missing capabilities

Add new optional props for behaviours FixturesTabs needs but ScoreInput lacks:

```ts
type ScoreInputProps = {
  // ... existing
  /** Submit timing. "blur" matches FixturesTabs; "debounced-blur" matches today's ScoreInput. */
  submitMode?: "blur" | "debounced-blur";
  /** When true, advance focus to away on first keystroke (FixturesTabs behaviour). */
  autoAdvanceOnKeystroke?: boolean;
  /** Hide the ghost-value treatment (set when host doesn't use ghost). */
  hideGhost?: boolean;
};
```

Keep all current ScoreInput callers working unchanged (defaults preserve today's behaviour).

### Phase C — Migrate FixturesTabs inline inputs to `<ScoreInput>`

Replace the ~60-line inline JSX at `FixturesTabs.tsx:677-735` with:

```tsx
<ScoreInput
  variant="card"
  home={homeScore}
  away={awayScore}
  homeLabel={fixture.home}
  awayLabel={fixture.away}
  onSubmit={({ home, away }) => handleScoreBlur(home, away)}
  submitMode="blur"
  autoAdvanceOnKeystroke
  hideGhost
  disabled={!prediction?.hasExactScore}
/>
```

Verify behaviour parity: blur submits, first keystroke advances, no ghost.

### Phase D — Delete the now-dead inline plumbing in FixturesTabs

The `homeInputRef`, `awayInputRef`, the `useState` for `homeScore`/`awayScore`, and the manual `onChange` handlers all collapse into props on `<ScoreInput>`.

---

## Blast radius

- **Picks flow** (`/wc/picks/[windowId]`): zero behaviour change. ScoreInput backward-compatible.
- **Results tab inline edit** (`/wc/results`): behaviour MUST match today. This is the parity bar.
- **Auto-resolve / scoring**: unchanged. Submit handlers stay parent-owned.

## Verification — per phase

### Phase A (audit)
No verification — output is decisions in this doc.

### Phase B (extend)
- [ ] Type-check passes.
- [ ] Every existing ScoreInput call site renders identically (defaults preserve behaviour).
- [ ] Unit tests if any exist (none currently — flagged).

### Phase C (migrate)
- [ ] Open `/wc/results`, expand an upcoming card, enter a score in the inline inputs.
- [ ] Confirm: keystroke in home advances focus to away (today's behaviour).
- [ ] Confirm: blur on either input submits the score immediately.
- [ ] Confirm: NO ghost value shown when refocusing (matches today).
- [ ] Confirm: prediction visible on card after refresh.
- [ ] Confirm: prediction visible on `/wc/picks/[windowId]` as well.

### Phase D (cleanup)
- [ ] Type-check still passes.
- [ ] No dead imports in FixturesTabs.
- [ ] Bundle size at least as small as before (likely smaller).

## Rollback

Each phase ships as its own PR. Phase B is non-breaking (additive props). Phase C is the behaviour-parity bar — revert if any parity gap surfaces. Phase D is cleanup — independently revertable.

## Risks

1. **`lastCommitted` dedup is load-bearing.** `ScoreInput.tsx:53-71` comments flag known race conditions previously fixed. Any refactor must preserve `homeValueRef`/`awayValueRef` synchronous tracking. Don't replace `useRef` with `useState` here — the synchronous read is intentional.
2. **Submit-on-blur vs submit-on-debounce semantics.** If FixturesTabs's blur-submit happens to fire before a debounced ScoreInput equivalent, two submits could race. Phase A's decision on canonical semantics MUST resolve this before Phase B starts.
3. **`prediction_data` race** (cross-reference `[[predictsport-predictions-api-race]]`): `/api/predictions` is a single upsert. If the unified widget triggers two near-simultaneous submits (e.g. autofocus blur + user blur), the second wins. Match today's behaviour exactly — don't introduce additional submits.
4. **Disabled state.** ScoreInput's `disabled` prop applies uniformly. FixturesTabs's disabling is tied to `prediction?.hasExactScore` (a conditional render guard). Phase C must mirror the existing conditional, not pass `disabled={false}` blindly.
5. **No test framework.** PredictSport has no test suite (`CLAUDE.md` confirms). All verification is manual. This refactor MUST have a manual checklist ticked on a real phone before merging Phase C.

## Out of scope

- Visual changes (handled by today's 2026-06-14 contrast fix + future `<ScoreDisplay>`).
- Touch target enlargement (handled by `[[PLAN-touch-targets]]`).
- Adding new prediction types or input modalities.

## Why this might not be worth doing

Honest assessment: the two widgets diverge by ~80 lines of code, 48 active users, no recurring bug rooted in the duplication itself (the 2026-06-14 contrast bug was a CSS copy-paste, not a logic copy-paste). The refactor's payoff is "future visual or behaviour changes touch one file instead of two." That payoff is real but small. If the user prefers to live with two widgets and accept the dual-touch cost, that's a defensible call.

**Recommendation:** defer until either (a) a third score-entry surface needs to be built (rule-of-three triggers consolidation) or (b) a logic bug surfaces from the divergence. Until then, keep this plan on the shelf.

---

**Related plans:** `[[PLAN-score-display-primitive]]` (independent), `[[PLAN-touch-targets]]` (would migrate into the unified widget once done).
