# 0015 — Cron architecture: Vercel for daily, Supabase pg_cron for the rest

## Status

Accepted — 2026-05-27. Amended 2026-06-12 (results cron moved to pg_cron).

## Context

PredictSport runs seven CRON_SECRET-guarded HTTP routes, but until this ADR
only one was actually scheduled:

| Route | Comment claimed | Actually scheduled |
|---|---|---|
| `/api/results/cron` | hourly | Vercel daily 09:00 UTC |
| `/api/notifications/cron` | hourly | nowhere |
| `/api/notifications/missing-results` | daily 10am | nowhere |
| `/api/cricket-seed/cron` | daily | nowhere |
| `/api/tournament/cron/lock-windows` | every 5 min | nowhere |
| `/api/tournament/cron/auto-finalise` | every 5 min | nowhere |
| `/api/wc/hide-card` | Sep 2026 one-shot | nowhere |

The reason is Vercel's Hobby plan: max 2 daily crons, no sub-daily.
Pro ($20/mo) lifts the cap but the spend isn't justified for an app
with ~12 users.

## Decision

1. **Supabase pg_cron + pg_net** schedules all five recurring routes:
   - `wc-lock-windows` every 5 min
   - `wc-auto-finalise` every 5 min
   - `wc-results` every 15 min (`*/15 * * * *`)
   - `wc-notifications-hourly` at :00
   - `wc-missing-results-daily` at 10:00 UTC

   Pattern: `cron.schedule()` calls a helper `private.invoke_cron_route(path)`
   which reads `CRON_SECRET` from Supabase Vault and does an async
   `net.http_get` to the Vercel route. The route code stays unchanged —
   only the scheduler moves.

   The results cron runs every 15 minutes 24/7. When no matches are in
   progress, the candidate query returns 0 rows and the route exits
   immediately with zero provider API calls. No match-hour gating needed.

2. **Vercel Cron** keeps `/api/results/cron` as a daily safety-net fallback
   at `0 7 * * *` (07:00 UTC / 08:00 Irish). Catches anything the 15-min
   job missed (Supabase outage, Vault misconfiguration, pg_net failure).
   1/2 daily slots used, one in reserve.

3. **Two routes stay manual-trigger:** `/api/cricket-seed/cron` (dormant
   until a cricket competition exists) and `/api/wc/hide-card` (one-shot
   Aug/Sep 2026). Their JSDoc now says "manual trigger only" instead
   of pretending to be scheduled.

4. **`CRON_SECRET` lives in two places, kept in sync:** Vercel project
   env (used by the one Vercel cron) AND Supabase Vault row `cron_secret`
   (used by pg_cron jobs). Rotation procedure: generate new secret,
   `vault.update_secret(...)`, then paste into Vercel.

## Consequences

**Wins**
- Five recurring jobs run at appropriate frequencies, all via pg_cron.
- Results confirmed within 15 minutes of match end (down from up to 24h).
- Comment lies eliminated — every route's JSDoc tells the truth about
  where its schedule lives.
- Free. No Vercel Pro upgrade.
- The 15-min results job self-throttles: zero provider calls when no
  candidates exist (outside match hours).

**Trade-offs**
- pg_net is fire-and-forget. `cron.job_run_details` only confirms the
  HTTP request was queued, not whether the route returned 2xx. To audit
  failures, query `net._http_response`.
- Two places to manage the secret (Vault + Vercel). Rotation requires
  both. Mitigated by route JSDoc + the placeholder check in the helper.
- Supabase Free pauses after 7 days of inactivity. If the project pauses,
  pg_cron stops firing. Production gets daily traffic, so this is
  theoretical, but if PredictSport ever goes dormant pre-WC, the 5-min
  jobs go quiet. The Vercel daily fallback partially mitigates this.
- pg_net response retention defaults to 6 hours; with ~700 invocations
  per day across the five jobs we're well within limits but it's worth
  a quick weekly vacuum job if growth changes.
- Provider rate limits (API-Football: 100 req/day free) are not at risk —
  the results cron only calls providers for events with candidates
  (unresulted, past lock time). Worst case during a 3-match day: ~12
  provider calls per cron run = ~48/day well under the cap.

## Supersedes

None. This is net-new infrastructure. Migration `20260528000000_enable_pg_cron_pg_net`
+ `20260528000100_schedule_cron_jobs` codify the implementation.

## Related

- [Vercel Hobby cron limit](https://vercel.com/docs/cron-jobs#limitations)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [pg_net async HTTP](https://github.com/supabase/pg_net)
- Migration `20260527000000_wc_entry_closes_at_soft_72h.sql` — the soft cutoff
  that's flipped inside `/api/results/cron`.
