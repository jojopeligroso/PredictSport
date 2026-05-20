# Cost-Benefit Analysis for Paid APIs

Date: 2026-05-20

## Context

PredictSport is a free app on Vercel/Supabase free tier with ~12 users and 42 events. This analysis evaluates whether any paid API subscriptions are justified given current usage, and identifies free actions that would have higher impact.

## Paid API Options Evaluated

| API | Cost | Sports Covered | What It Adds | Current Free Alternative |
|-----|------|----------------|-------------|------------------------|
| API-Football | Free (4 req/hr) | Soccer | Better League of Ireland results | ESPN + TheSportsDB |
| BallDontLie | Free NBA / $40 all | NBA, NFL, MLB, NHL | Redundant to ESPN | ESPN (works fine) |
| CricketData.org | Free (100/day) / $5.99/mo | Cricket | Structured results, auto-discovery | ESPN + TheSportsDB |
| Foireann | Free (key-gated) | GAA | Only GAA fixtures/results API | Manual entry |
| TheRacingAPI | Free tier (key-gated) | Horse Racing | Only horse racing API | Manual entry |
| Snooker.org | Free (header approval) | Snooker | Only working snooker API | Manual entry (ESPN broken) |
| Sportradar | $10k+/mo | All | Premium data, live feeds | Not viable |
| Data Sports Group | Paid (unknown) | Various | Multiple sports | Not viable without pricing |
| Sportmonks Cricket | EUR 29/mo | Cricket | 26-169 leagues | Overkill for 8 events |

## ROI Assessment

### Tier 1: Free — Just Need a Key/Header (High ROI)

These cost nothing but require a one-time action to enable.

| API | Action Required | Impact | Priority |
|-----|----------------|--------|----------|
| **API-Football** | Add free API key to Vercel env | Enables League of Ireland/Champions League result accuracy | **Do now** |
| **Foireann** | Email support for API key | Enables only GAA fixtures API in existence; 5 events and growing | **Do now** |
| **Snooker.org** | Email webmaster for header value | Replaces broken ESPN snooker (400 error) | **Do now** |
| **TheRacingAPI** | Sign up for free tier | Enables horse racing fixtures; zero usage currently | **Low — wait for usage** |

### Tier 2: Free Tier Adequate ($0/mo)

| API | Free Tier | Usage vs Capacity | Upgrade Trigger |
|-----|-----------|-------------------|-----------------|
| **CricketData.org** | 100 req/day | 8 events = ~16 req/day (search + result) | If cricket exceeds 50 events |
| **BallDontLie** | NBA only | 2 NBA events; ESPN already covers it | Never — ESPN is sufficient |

### Tier 3: Paid — Not Justified ($5-29+/mo)

| API | Cost | Justification | Verdict |
|-----|------|---------------|---------|
| CricketData.org Pro | $5.99/mo | 2K/day vs 100/day free tier | **Not needed** — 8 events don't stress free tier |
| Sportmonks Cricket | EUR 29/mo | 169 leagues, deep stats | **Overkill** — we need fixtures + winner, not ball-by-ball |
| BallDontLie Pro | $40/mo | NFL, MLB, NHL on top of NBA | **Not needed** — ESPN covers all four |
| Sportradar | $10k+/mo | Everything | **Absurd** for a 12-user app |

## Free Code Changes with Higher ROI than Any Paid API

These cost nothing and fix known provider failures:

| Change | Impact | Effort |
|--------|--------|--------|
| **Fix ESPN tennis/golf parsing** | Unblocks 2 sports before Wimbledon/US Open | Medium — debug scoreboard parser |
| **Add TheSportsDB to rugby_league chain** | Super League coverage (ESPN covers NRL only) | 2 lines in `registry.ts` |
| **Add TheSportsDB for athletics fixtures** | Fixture browsing for Diamond League, Worlds, Olympics | Small — add to supportedSports + registry |

## Recommendation

**Spend $0/month.** The app's scale doesn't justify any paid subscriptions.

**Priority actions (all free):**

1. **Get API-Football free key** — sign up at api-football.com, add to Vercel env vars
2. **Email Foireann support** for API key — GAA is the highest-value gap
3. **Email snooker.org** for header approval — fixes the only sport with a completely broken provider
4. **Fix ESPN tennis/golf parser** — code fix, no API key needed
5. **Add TheSportsDB to rugby_league and athletics chains** — code changes, no API key needed
6. **Sign up for CricketData.org free tier** — future hedge if ESPN cricket parsing degrades

**Revisit paid APIs when:**
- User base exceeds 100 active users
- Cricket events exceed 50 per season
- A sport requires live/real-time scoring (none do currently)
