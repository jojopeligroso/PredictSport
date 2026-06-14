# PLAN — Surface fixture results on the groups-table accordion

**Date:** 2026-06-14
**Status:** Planned. Independent of score-display consolidation.
**Owner:** next session
**Risk:** Low. Data plumbing only. No new SQL, no schema change.
**User complaint addressed:** "on the groups table, you can see the user's predictions, but the user cannot see the actual result."

---

## Goal

In the FIFA-groups view, when a user expands a group to see its fixtures, each *locked + resulted* fixture must show **both** the user's prediction AND the actual result. Today only the prediction shows; the result is fetched elsewhere but never plumbed into this surface.

## Root cause (verified)

`src/components/wc/FifaGroupsGrid.tsx:96-103` instantiates `AccordionPanel` with `events`, `predictions`, `competitionId`, `windowLocked` — but **no result data**. The accordion then passes those four props into `<WindowPickList surface="compact">` at `:194-200`. The locked branch of `WindowPickList` (`WindowPickList.tsx:644-700`) only renders the user's pick via `getPredictionSummary`, with no slot for the actual result because no result prop exists.

Meanwhile `src/app/wc/_landing/fetchFixturesResultsData.ts:65-92` already produces `resultsByExternalId: Record<string, { homeScore, awayScore, winner, isFinalised, status }>` for the Results tab. The same data is in scope for the dashboard but never threaded down to `FifaGroupsGrid`.

This is **pure plumbing**: data exists, consumer exists, no wire connects them.

---

## The change

### 1. Type definition

Add to wherever `WindowEvent` / `Prediction` shared types live (likely `src/types/wc.ts` or inline in `WindowPickList.tsx` — check current location before duplicating).

```ts
export type FixtureResultMap = Record<string, {
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  isFinalised: boolean;
  status: string;
}>;
```

(This already exists in `fetchFixturesResultsData.ts` as `resultsByExternalId` — export its type rather than re-declaring.)

### 2. `FifaGroupsGrid` accepts and forwards `results`

`src/components/wc/FifaGroupsGrid.tsx:13-30` (props interface):
```ts
interface FixaGroupsGridProps {
  // ... existing
  results?: FixtureResultMap;   // NEW. Keyed by events.external_event_id.
}
```

`:96-103` forwards to `AccordionPanel`:
```tsx
<AccordionPanel
  groupId={expandedGroup}
  events={groupEvents.get(expandedGroup) ?? []}
  predictions={predictions ?? []}
  competitionId={competitionId}
  windowLocked={windowLocked ?? false}
  results={results}              // NEW
/>
```

### 3. `AccordionPanel` accepts and forwards `results`

`src/components/wc/FifaGroupsGrid.tsx:165-203`:
```ts
function AccordionPanel({
  groupId,
  events,
  predictions,
  competitionId,
  windowLocked,
  results,                       // NEW
}: {
  groupId: string;
  events: WindowEvent[];
  predictions: Prediction[];
  competitionId: string;
  windowLocked: boolean;
  results?: FixtureResultMap;    // NEW
}) {
  // ... existing
  <WindowPickList
    competitionId={competitionId}
    events={events}
    predictions={predictions}
    windowLocked={windowLocked}
    surface="compact"
    results={results}            // NEW
  />
```

### 4. `WindowPickList` accepts `results` and renders in the locked branch

`src/app/wc/picks/[windowId]/WindowPickList.tsx` — interface and locked branch (current `:644-700`).

```ts
type Props = {
  // ... existing
  results?: FixtureResultMap;    // NEW. Optional. Maps event.external_event_id → result.
};
```

In the locked-branch render path, alongside the existing `"Picked: X (h–a)"` line, render the official result when present:

```tsx
{(() => {
  const result = event.externalEventId ? results?.[event.externalEventId] : undefined;
  if (!result || !result.isFinalised) return null;
  if (result.homeScore === null && result.awayScore === null) return null;
  return (
    <p className="mt-0.5 font-mono text-[11px] font-bold tabular-nums text-ps-green">
      Result: {result.homeScore} – {result.awayScore}
    </p>
  );
})()}
```

(Once `<ScoreDisplay>` lands via `[[PLAN-score-display-primitive]]`, this becomes `<ScoreDisplay home={result.homeScore} away={result.awayScore} size="sm" tone="muted" />` plus a "Result:" label. Don't wait for that primitive — ship the data plumbing now, swap the markup later.)

### 5. Caller plumbing — wire the data through from the dashboard

`FifaGroupsGrid` is rendered inside the dashboard / WC landing flow. Find every call site:

```bash
grep -rn "FifaGroupsGrid" src/
```

Likely a single call site in `src/app/wc/_landing/` or `src/app/wc/home/`. At that call site, the page already fetches `resultsByExternalId` via `fetchFixturesResultsData` — pass it down:

```tsx
<FifaGroupsGrid
  // ... existing props
  results={resultsByExternalId}
/>
```

If the call site does NOT already have `resultsByExternalId` in scope (server vs client boundary issue), the data must be propagated from the nearest server component that already calls `fetchFixturesResultsData`. **Verify the boundary before writing the PR** — if there's no clean parent that has both `FifaGroupsGrid` and `resultsByExternalId`, this becomes a larger refactor and the plan needs revision.

---

## Blast radius

| Surface | Affected? | Why |
|---|---|---|
| Groups accordion in dashboard | Yes — gains a new line per resulted fixture | Primary intent |
| `/wc/picks/[windowId]` standalone | Possibly — depends on whether that page also renders `WindowPickList` | `results` is OPTIONAL, defaults to undefined. Pages that don't pass it see today's behaviour exactly. |
| `/wc/results` | No | Different render path (FixturesTabs) |
| Rivals tab | No | Different component |

**The optional prop is the safety device.** Adding `results?: FixtureResultMap` with no default means every existing caller continues to work unchanged. Only the dashboard's `FifaGroupsGrid` call site gets the new wiring.

## Verification

- [ ] Type-check passes (`npm run build`).
- [ ] Open the dashboard groups view on a phone. Expand a group with a fixture that has a confirmed result. Confirm the "Result: X – Y" line appears under the "Picked: …" line.
- [ ] Expand a group whose fixtures are all upcoming. Confirm NO result lines appear (the `if (!result || !result.isFinalised) return null;` guard).
- [ ] Open `/wc/picks/[windowId]`. Confirm unchanged behaviour (no `results` prop passed).
- [ ] Cross-check with `/wc/results` — the score shown in the accordion must match the score on the results tab for the same fixture.

## Rollback

Single PR revert. No data, no migration. Removing the optional prop returns the surface to its pre-PR state.

## Risks

1. **Server-client boundary.** If the parent that has `resultsByExternalId` is a server component and `FifaGroupsGrid` is a client component (likely — it uses `useState` for accordion expand), the prop crosses the boundary as a serialised JSON object. That's fine for a `Record<string, { ... }>`. No methods, no Dates, no Maps. Verify with the type-check.
2. **`event.externalEventId` may be `null`** for some events (manual-entry without provider linkage). The guard `if (!event.externalEventId) return null;` handles this. Confirmed against `events.external_event_id` schema (`Event.external_event_id: string | null`).
3. **`getPredictionSummary` already includes a parenthetical score** ("Picked: Brazil (2–1)"). The new "Result: 1–0" line sits below it. Two adjacent score-bearing lines may visually compete. Eyeball on real device; if cluttered, consider promoting the result and demoting the pick OR aligning them as a small two-row "Pick: 2–1 · Result: 1–0" inline pair. Decide post-merge based on real-device feel.
4. **i18n.** The literal "Result:" needs a translation key. Use `picks.summary.result_label` to match the existing `picks.summary.*` key family in `docs/translations/`. Add to `en.json` and `es.json` (the locale switch handles Spanish).

## Out of scope

- `FifaGroupCard` itself (the collapsed grid view) — that shows points only, no fixture digits. Surfacing latest-fixture-result on the collapsed card is a separate, larger layout decision.
- `GroupMiniTable` — standings table, not a fixture surface.

---

**Related plans:** `[[PLAN-score-display-primitive]]` (will swap the markup once the primitive ships), `[[PLAN-extract-result-shape]]` (already provides the data shape).
