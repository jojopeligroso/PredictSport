# Handoff — Apply engagement report migration

**Date:** 2026-06-14
**Surface:** Supabase database (PredictSport project `wujgqjjddonxoddkgbxy`)
**Risk:** None on the running app (read-only view, no table changes)
**Estimated effort:** 20-30 minutes (most of it is decisions, not typing)

---

## Context (what to know before touching anything)

The user requested an engagement report on the 48 active PredictSport users
(per `[[predictsport-active-user-count]]` — note CLAUDE.md still says ~12;
the real number is 48). The full plan was written this session at
`docs/PLAN-engagement-report.md` and committed to master in `4552352`.

The user asked to apply the migration; the previous session paused before
applying because **two pre-apply decisions need their explicit answer**.
They opted to handle it next session instead. Do NOT apply until those two
decisions are made.

The plan defines:
- A SQL view `public.v_user_engagement` — one row per user, with engagement
  status `'active' | 'drifting' | 'no_fixtures_yet'`.
- A KPI strip query and a per-user table query the user runs in Supabase
  Studio.
- "Active" = **<2 missed picks of last 10 locked fixtures** across all the
  competitions a user is a member of.
- "Missed pick" = no `predictions` row for that event at `lock_time`.

Read the full plan at `docs/PLAN-engagement-report.md` before doing
anything. It has the full SQL. This handoff covers only the apply step.

---

## The two open decisions

### Decision 1 — GRANT target

The plan as written ends with:
```sql
GRANT SELECT ON public.v_user_engagement TO authenticated;
```

That is the **permissive** path. It exposes per-user counts and emails to
any authenticated user (not just admins). The plan recommends the
**conservative** path instead:

```sql
REVOKE ALL ON public.v_user_engagement FROM authenticated, anon;
GRANT SELECT ON public.v_user_engagement TO service_role;
```

The user reads the report in Supabase Studio, which runs as `service_role`
— so the conservative path costs nothing in the immediate use case but
prevents future leakage if a regular `/wc` page accidentally queries the
view via the anon-key client.

**Action:** ask the user "conservative GRANT (service_role only) or
permissive (authenticated)?" before writing the migration. Default to
conservative if no answer in the salvo.

### Decision 2 — Strip the placeholder line

The draft SQL in the plan has this line as a deliberate smell flagged for
the reviewer:
```sql
LEFT JOIN per_user_pick_stats m_alias_breakage_workaround
       ON false  -- placeholder so the next two LEFT JOINs read cleanly
```

It's inert (joins zero rows) but ugly. **Delete it before writing the
migration file.** The three real `LEFT JOIN`s below it work correctly on
their own. This is not a decision the user has to make — just remove it.

---

## Exact steps

### 1. Confirm Decision 1 with the user
One quick question. Salvo style:

> Engagement view GRANT target — service_role only (recommended, you'll
> query via Supabase Studio which already runs as service_role) or
> authenticated (permissive, exposes per-user data to every signed-in
> user)?

Default: service_role.

### 2. Create the migration file

Path: `supabase/migrations/{timestamp}_user_engagement_view.sql`

Timestamp format: `YYYYMMDDHHMMSS`. For 2026-06-14 use something like
`20260614120000`. Pick a value strictly greater than the latest existing
migration timestamp in `supabase/migrations/`.

Copy the SQL from `docs/PLAN-engagement-report.md` (the
`CREATE OR REPLACE VIEW` block) into this file, with these edits:
- **Remove** the `m_alias_breakage_workaround` placeholder JOIN block.
- **Replace** the final GRANT block with whatever the user answered in
  Decision 1.
- Add a top-of-file comment with the date and plan reference:
  ```sql
  -- 2026-06-14 — User engagement snapshot view.
  -- Spec: docs/PLAN-engagement-report.md
  -- Read-only. Refresh on demand.
  ```

### 3. Apply via Supabase MCP

Use the `mcp__claude_ai_Supabase__apply_migration` tool, passing the
file contents. The project is `wujgqjjddonxoddkgbxy`.

Alternative if MCP path is fiddly: `supabase db push` from the project
root (requires the user's local Supabase CLI auth — confirm before
running).

### 4. Smoke-test the view

Run via `mcp__claude_ai_Supabase__execute_sql`:

```sql
SELECT engagement_status, COUNT(*)
FROM public.v_user_engagement
GROUP BY engagement_status
ORDER BY engagement_status;
```

Expect roughly:
- `active` — most of the 48 users
- `drifting` — some non-zero count
- `no_fixtures_yet` — small number (recent signups, late joiners)

If `no_fixtures_yet = 48` (everyone), something's wrong with the
`competition_members.joined_at <= e.lock_time` filter. If `drifting = 0`
unexpectedly, double-check the `picks_missed < 2` threshold.

### 5. Run the two convenience queries

Run the KPI query and the per-user query from
`docs/PLAN-engagement-report.md` (the two ```sql blocks after the view
definition). Save the output as a `docs/REPORT-2026-06-14-engagement-snapshot.md`
file so the user has a baseline.

### 6. Report back to user

Tell the user:
- The view is live at `public.v_user_engagement`.
- Where to find the saved queries: paste them into Supabase Studio SQL
  Editor and save as snippets `engagement-kpis` and `engagement-detail`.
- The snapshot is at `docs/REPORT-2026-06-14-engagement-snapshot.md`.
- Any surprises in the data (high drifting count, unexpected
  no_fixtures_yet, etc.).

---

## Pre-flight already done in the previous session

- Schema columns verified against `src/types/database.ts` — `users`,
  `competition_members`, `events`, `predictions` all have the columns
  the view assumes.
- `predictions.submitted_at` exists and is the canonical
  "when did they pick" timestamp.
- `events.lock_time` is the canonical "by this moment the pick had to be
  in" timestamp.
- `events.status` has a `'cancelled'` value — the view skips these.
- No materialised view needed at 48 users; query cost is negligible.
- No RLS policy needed on the view (it's a view, not a table; SELECT
  permission is governed by the GRANT).

---

## What NOT to do

- **Don't** apply the migration before getting the user's Decision 1
  answer.
- **Don't** include the `m_alias_breakage_workaround` placeholder line.
- **Don't** index or materialise the view in this iteration. Premature
  optimisation at 48 users.
- **Don't** add a `last_seen_at` column to `users` to track lurkers in
  the same PR. That's a separate, larger plan item (mentioned at the
  bottom of `docs/PLAN-engagement-report.md`).
- **Don't** build the `/wc/admin/engagement` frontend page. Out of
  scope this iteration — the user explicitly chose "Supabase SQL view +
  dashboard query" as the surface.
- **Don't** add filters for `competitions.status = 'active'`. The plan
  intentionally counts fixtures across all comps the user is in,
  including completed ones (recency_rank handles ordering).

---

## Verification checklist (after applying)

- [ ] Migration file committed to `supabase/migrations/`.
- [ ] `SELECT * FROM public.v_user_engagement LIMIT 5;` returns rows.
- [ ] `engagement_status` values are distributed as expected (not all
      one bucket).
- [ ] A known active picker shows `picks_missed_last_10 = 0`.
- [ ] A user who joined a competition but never picked shows
      `engagement_status = 'drifting'` or `'no_fixtures_yet'`.
- [ ] KPI query and per-user query both run without errors.
- [ ] Snapshot file `docs/REPORT-2026-06-14-engagement-snapshot.md`
      created.

## Rollback

Single statement:
```sql
DROP VIEW IF EXISTS public.v_user_engagement;
```

Followed by deleting the migration file and any new commit.

---

## Commit message suggestion

```
Add v_user_engagement view for per-user activity snapshot

One row per user across all competitions they're a member of. Engagement
status (active/drifting/no_fixtures_yet) is derived from picks made vs
missed in the last 10 locked fixtures. Read-only view, queried via
Supabase Studio. Spec: docs/PLAN-engagement-report.md.
```

---

**Related:** `docs/PLAN-engagement-report.md` (the spec), commit
`4552352` (where the spec landed), `[[predictsport-active-user-count]]`
(48 users — not 12).
