# F1 Design: All-Competitions Dashboard

**Status:** Approved (2026-05-22)
**Phase:** F — All-Competitions Dashboard
**Produced by:** F1 design spike (`/grill-with-docs` session)
**Unblocks:** F2 (dashboard card), F3 (global stats). Adds F4 (cross-competition results page).
**Related:** `CONTEXT.md` (All-Competitions Dashboard, Standing, Standings Cache, Global Hit Rate), `docs/adr/0010-cached-non-authoritative-standings.md`

---

## 1. Purpose

A cross-competition summary surface on `/competitions` that answers **"how am I
doing"** across every competition a participant belongs to.

The `/competitions` page already renders a rich card per competition (status,
round X of Y, next lock time, member count, sports). What no surface answers
today is the participant's **own** standing and form *across* their
competitions. That is the gap this fills.

**Primary job:** performance/standing snapshot.
**Secondary:** a conditional action prompt — shown *only* when a prediction is
genuinely due (a prediction window open / a lock imminent). Not a co-equal
element; a conditional accent on a performance-first card.

### Non-goals

- Not a per-competition leaderboard (that is `/leaderboard`).
- Not the personal-predictions stats page (that is scoped to the personal
  competition).
- Not a recent-activity feed. Backward-looking activity is deliberately
  minimal — see §4.3.
- Not a re-display of competition metadata already on the existing cards
  (next lock, round progress) — that would be the "noisy" outcome.

---

## 2. Scope boundary

| Task | Deliverable | Status after F1 |
|---|---|---|
| **F1** | This design doc + `CONTEXT.md` + ADR-0010 | ✅ done (this spike) |
| **F2** | Top "Your form" card + per-card rank line on `/competitions` | unblocked |
| **F3** | Global Hit Rate aggregation (personal + group) | unblocked — consumed by F2's card |
| **F4** *(new — file in todos.md)* | Cross-competition results page (`/competitions/results`) | new follow-up |

F3 is not a separate page. "Global stats" resolves to a single number — the
**Global Hit Rate** — which is the headline of F2's top card. F3 is the
aggregation logic behind it.

---

## 3. Data model

### 3.1 The problem

The user's **rank** in a competition is not stored. `/leaderboard` computes it
live: load every prediction in the competition, sum `points_awarded` per user,
sort, assign ranks in memory. Rendering "you're 3rd of 12" for N competitions
on one page would mean running that full computation N times per server render.

### 3.2 Decision — cached, non-authoritative standings

See **ADR-0010**. Summary:

- New table `competition_standings` is a **best-effort cache**, not a source of
  truth.
- `/leaderboard` is unchanged — it stays the live, authoritative recompute.
- The dashboard reads the cache for speed; if a competition's cache row is
  missing or stale, it falls back to a live recompute for that competition and
  writes the result back (read-through).
- Staleness is therefore **visible and self-healing**, never silently wrong.

### 3.3 Table

```sql
-- migration: supabase/migrations/<ts>_competition_standings_cache.sql
create table competition_standings (
  competition_id  uuid not null references competitions(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  rank            integer not null,
  total_points    integer not null,
  correct_count   integer not null,
  resolved_count  integer not null,
  member_count    integer not null,   -- denormalised: "X of {member_count}"
  computed_at     timestamptz not null default now(),
  primary key (competition_id, user_id)
);

create index on competition_standings (user_id);
```

`computed_at` is the freshness marker. **RLS:** a user may read rows where
`user_id = auth.uid()` OR where they are a member of `competition_id` (same
visibility as the live leaderboard). Writes are server-side only (service path
during recompute) — no client write policy.

### 3.4 Freshness check

A cached row for a competition is **stale** if `computed_at` is older than the
most recent result confirmation in that competition. Determine "most recent
result confirmation" by the max `events.updated_at` among that competition's
events where `result_confirmed = true` (no new column required — derivable).
If stale or missing → recompute that competition, upsert, use fresh values.

### 3.5 Write paths

| Path | Behaviour |
|---|---|
| **Lazy read-through** *(live mechanism)* | `getDashboardData()` checks each competition's cache freshness; recomputes + upserts any that are missing/stale. The first dashboard viewer after a result lands pays the cost; everyone after gets the cache. |
| **Scheduled job** *(built, dormant)* | An API route `/api/cron/recompute-standings` loops `recomputeStandings(competitionId)` over all active competitions. **Not listed in `vercel.json`** — so it consumes no cron slot and cannot fail a deploy (see `predictsport-vercel-cron-limit`). It exists so that activation is a one-line `vercel.json` change if the project goes commercial. |
| **`confirm-result`** | **Unchanged.** Does not write the cache. Staleness is detected by §3.4, so no invalidation hook is needed. Keeps the admin action fast. |

**No dead code.** The dormant job and the lazy path call the *same*
`recomputeStandings()` function. The job is that function looped + an HTTP
wrapper. There is nothing to bit-rot — the live dashboard exercises the core
logic continuously.

### 3.6 Shared helpers (extract, don't duplicate)

The rank computation currently lives inline in `src/app/leaderboard/page.tsx`.
F2 must extract it into a shared module so the cache recompute and the live
leaderboard use one implementation:

- `src/lib/leaderboard.ts` → `computeStandings(competitionId): Standing[]`
  — the load-predictions + sum + sort + rank logic, lifted verbatim from the
  leaderboard page.
- `src/lib/standings-cache.ts` → `recomputeStandings(competitionId)` (calls
  `computeStandings`, upserts the cache) and `getCachedStandings(userId)` (the
  read-through: per-competition freshness check + fallback).

`/leaderboard/page.tsx` is refactored to call `computeStandings` — same output,
no behaviour change, one source of truth for rank.

### 3.7 Global Hit Rate (F3)

`Global Hit Rate` = correct ÷ resolved across **all** the user's competitions,
group **and** personal combined. Computed from `predictions` joined to `events`
across every competition the user is a member of, counting only resolved
predictions (`is_correct !== null`). Distinct from the personal-stats hit rate,
which filters to the personal competition only. The personal stats endpoint
(`/api/personal-predictions/stats`) is a good template for the aggregation
shape — but F3's query is *not* competition-scoped.

---

## 4. UI

Two parts on `/competitions`, both above the existing competition list.

### 4.1 Top card — "Your form"

A single consolidated panel. **Renders only when the user is in ≥1 group
competition** (a personal-only user does not see it — there is nothing to
aggregate *across*; they keep today's "My Personal Predictions" link).

**Content (priority order):**
1. **Global Hit Rate** — the headline brag number.
2. **Standing summary** — best & worst position across competitions
   ("Top spot in Pub League · 7th of 11 in Office Cup").
3. **Conditional action prompt** — *only when present* — "⚠ Round 4 of Pub
   League locks in 2h".
4. **Last result line** — one backward-looking line — "Latest: you called
   Kerry over Dublin ✓ in Pub League".

No form streak. A streak spanning unrelated competitions is fuzzy and competes
with hit rate for the headline slot; streaks stay on the personal stats page.

**Three display modes:**

| Mode | Trigger | Behaviour |
|---|---|---|
| **Empty** | No resolved predictions (new user, or picks made but no results landed) | Hit rate is null. Show an onboarding nudge instead of a broken headline: "Make your picks — your form shows up here once results land." |
| **Single-competition** | User in exactly one group competition | "Best AND worst" is the same competition. Collapse to one line: "You're 3rd of 12 in Pub League." |
| **Full** | User in ≥2 group competitions, ≥1 resolved prediction | Best/worst standing summary as above. |

**No-active-competitions** (all the user's competitions are draft/completed) is
not a fourth mode — it is the Full or Single mode with the conditional action
prompt simply absent. Lifetime hit rate still shows.

### 4.2 Per-card rank line

Inside each existing competition card on `/competitions`, add one user-centric
line: `You: 3rd of 12 · 84 pts`. Cheap enrichment — the values come from the
same `getCachedStandings` read. Answers "and in *this* one?" without a tap.

### 4.3 Recent activity — progressive disclosure

The top card's "last result" line is the entry point to results depth:

1. **Collapsed** — one last-result line.
2. **Expand once** — last 5 results across all the user's competitions, inline.
   Each result row deep-links to its own competition.
3. **Expand again** — *deferred to F4.* For F2, expansion **stops at 5
   results**. There is no cross-competition results page today (the only
   `ResultsTab` is inside `PersonalFixtureBrowser` and is personal-only).
   F4 will build `/competitions/results` as the real second-expansion target.

---

## 5. Open items / follow-ups

- **F4 — Cross-competition results page** (`/competitions/results`): every
  resolved prediction across all the user's competitions, with sport/competition
  filtering. The real target of the card's second expansion. File in todos.md.
- **Standings cache → authoritative** (Phase 2, if commercially viable):
  promote the cache to source of truth, migrate `/leaderboard` to read it, add
  recompute hooks to every prediction-mutating path, and activate the scheduled
  job in `vercel.json`. Until then the cache stays best-effort.

---

## 6. Summary of decisions (grill session 2026-05-22)

| # | Decision |
|---|---|
| Q1 | Primary job = "how am I doing"; conditional action CTA secondary. |
| Q2–Q4 | Cached non-authoritative `competition_standings`; lazy read-through is the live write path; scheduled job built but dormant (not in `vercel.json`). |
| Q5 | Two parts: top "Your form" card + a per-card rank line on existing cards. |
| Q6 | Top card = hit rate + standing + conditional action; no streak; three display modes (empty / single-competition / full). |
| Q7 | Dashboard gated to ≥1 group competition; personal-only users excluded. One "last result" line, progressive expansion. |
| Q8 | Card expansion stops at 5 results; cross-competition results page filed as F4. |
