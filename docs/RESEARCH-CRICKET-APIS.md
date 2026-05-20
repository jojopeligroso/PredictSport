# Cricket API Research

Date: 2026-05-20

## Current Setup

ESPN (unofficial, free, no key) + TheSportsDB (free). ESPN provides scoreboard search + results via manually curated series IDs in `src/lib/sports/cricket-leagues.ts`. TheSportsDB provides fixture browsing.

## Comparison

| API | Free Tier | Rate Limit | Fixtures | Results | Coverage | Auth |
|-----|-----------|-----------|----------|---------|----------|------|
| CricketData.org | Yes, permanent | 100 req/day | `/v1/matches` (filter) | `/v1/match_info` | Int'l + IPL, BBL, PSL, all major | API key |
| Cricbuzz (RapidAPI) | Yes (freemium) | ~100 req/day | Dedicated upcoming/schedule | Recent + scorecard | Int'l + all major domestic | RapidAPI key |
| Cricbuzz-Live (unofficial) | Yes, no key | Undocumented | `/v1/matches/upcoming` | `/v1/matches/recent` | Int'l + leagues | None |
| Sportmonks Cricket | 14-day trial only | 3K/hr (trial) | `/fixtures` | Full scoreboards | 26-169 leagues | API token |
| EntitySport | Dev token (sample only) | N/A | Schedule API | Scorecard API | Int'l + domestic | API key |
| ESPN (current) | Yes, no key | ~180 req/min | Scoreboard (3-5/league) | Summary endpoint | All Cricinfo series | None |
| TheSportsDB (current) | Yes, no key | 30 req/min | By league | Past events | Int'l + major | None |

Paid tiers: CricketData $5.99/mo (2K/day), Sportmonks EUR 29/mo, EntitySport $150/mo.

## Recommendation

**Keep ESPN + TheSportsDB as primary.** Current setup works and is free.

**If adding a dedicated provider:** CricketData.org is best value — permanent free tier (100 req/day), structured winner/score data, all major leagues. $5.99/mo gets 2K/day if free tier proves insufficient.

**Main pain point to solve:** Auto-discovery of cricket series IDs. Currently manual curation in `cricket-leagues.ts`. A dedicated API could eliminate this.

**Not worth it yet:** Only 8 cricket events in production. Revisit when cricket usage grows or ESPN reliability degrades.
