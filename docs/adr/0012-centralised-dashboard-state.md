---
Status: accepted
---

# Centralised Dashboard State derivation

## Context

The `/wc` surface adapts its layout based on a user's bracket submission status, classification membership statuses, and competition lifecycle. This "Dashboard State" concept (`visitor`, `bracket`, `format`, `overall`, `archive`) determines the card stack ordering, leaderboard default tab, and potentially navigation emphasis.

Currently, `/wc/page.tsx`, `/wc/picks/page.tsx`, and `/wc/bracket/page.tsx` each independently query bracket state and competition membership to make display decisions. This has already led to duplicated derivation logic (e.g., `bracketDone` computed inline on the landing page, `getWcBracketSnapshot` called separately on the picks page).

As Dashboard State drives more surfaces — nav awareness, leaderboard tab defaults, card hierarchy — independent derivation will drift.

## Decision

Dashboard State is computed by a single server-side function (`deriveWcDashboardState`) that returns the resolved state plus the data each surface needs. Pages call this function once and pass the result down. No page independently re-derives Dashboard State from raw queries.

The derivation priority order:

1. No auth session → `visitor`
2. Competition `completed` → `archive`
3. Format membership `eliminated` or `dead` → `overall`
4. Bracket `submitted` or `locked` → `format`
5. Any matchday prediction exists → `format`
6. Fallthrough → `bracket`

## Rationale

- Single derivation prevents drift between surfaces that all depend on the same state.
- The priority order encodes product intent (elimination trumps bracket status; bracket submission and first prediction are equivalent triggers).
- Returning associated data alongside the state avoids redundant Supabase queries per page.

## Consequences

- All `/wc` surfaces that depend on Dashboard State must use this function, not local queries.
- Changes to transition rules happen in one place.
- The function becomes a dependency for every `/wc` page — changes require testing across all surfaces.
