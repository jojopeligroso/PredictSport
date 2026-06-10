---
Status: accepted
---

# Standings cache is non-authoritative; the live leaderboard remains source of truth

## Context

A participant's rank within a competition instance is not stored — `/leaderboard`
computes it live from `predictions` rows on every render. The All-Competitions
Dashboard (Phase F) needs each user's rank across *all* their competition
instances on one page, which would mean running that full leaderboard
computation once per instance per render.

## Decision

Introduce a `competition_standings` table as a **best-effort cache**, not a
source of truth. `/leaderboard` is left unchanged — it stays the authoritative
live recompute. The dashboard reads the cache; a missing or stale cache row
(detected by comparing `computed_at` against the competition's most recent
result confirmation) triggers a live recompute for that competition,
read-through style. A scheduled recompute job is built but left dormant — not
registered in `vercel.json`, so it consumes no Hobby-plan cron slot.

## Considered Options

- **Fully authoritative table** — rejected: would require standings-recompute
  hooks on every prediction-mutating path (confirm, re-confirm, cancel, edit,
  member leave), each a potential silent-staleness bug.
- **Pure inline recompute, no table** — rejected: N heavy queries per dashboard
  render, doesn't scale.
- **Cached, non-authoritative** — chosen.

## Consequences

- Staleness is **visible and self-healing**: the cache can lag, but never lies,
  because the live leaderboard remains the source of truth and the dashboard
  falls back to it.
- There are deliberately **two paths to a rank**: the live leaderboard and the
  cache. They are kept consistent by both calling one extracted
  `computeStandings()` helper — not by syncing two implementations.
- A future engineer seeing `competition_standings` must not "fix" the
  leaderboard to read it, nor add write hooks to `confirm-result`, without
  first promoting the cache to authoritative (a documented Phase 2 step).
