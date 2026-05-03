# Sports Data & Result Ingestion Specification

**Minimising admin maintenance is critical for accessibility.** If every result requires manual entry, only dedicated admins will run competitions. Sports API integration is MVP, not future.

## API Coverage Per Sport

| Sport | Primary API | Fallback | Notes |
|-------|-----------|----------|-------|
| Formula 1 | OpenF1 (official) | — | Excellent. Race, qualifying, fastest lap. Free, no key. |
| Soccer (Premier League, Champions League, etc.) | API-Football (free tier) | TheSportsDB | 100 req/day free. Major leagues well covered. |
| Soccer (League of Ireland, FAI Cup) | TheSportsDB | Manual | Niche leagues may need manual entry. |
| Soccer (World Cup 2026) | BALLDONTLIE | API-Football | BALLDONTLIE has dedicated World Cup 2026 endpoint. |
| Golf | TheSportsDB | Manual | Majors only on free tier. Tour events need manual. |
| Rugby (Six Nations, Heineken Cup) | TheSportsDB | Manual | International + major club competitions. |
| Tennis (Grand Slams, ATP/WTA) | TheSportsDB | — | Good coverage of majors. |
| GAA (Football, Hurling, Camogie) | None | — | **No public API exists.** Manual admin entry only. |
| Horse Racing (Cheltenham, Grand National, Epsom) | TheRacingAPI | Manual | Free tier available for UK & Ireland. Evaluate coverage. |
| Snooker | None (reliable free) | Manual | No good free API. Manual entry. |
| MLB | MLB Stats API (official) | BALLDONTLIE | `statsapi.mlb.com` — free, no key, excellent. |
| NFL | ESPN unofficial | BALLDONTLIE | `site.api.espn.com` — no key, undocumented. |
| NBA | BALLDONTLIE (free tier) | ESPN unofficial | BALLDONTLIE has strong NBA coverage. |
| NHL | ESPN unofficial | BALLDONTLIE | Same ESPN caveat as NFL. |
| Ladies Football / Camogie | None | — | Manual admin entry only. |
| Ladies Golf (Solheim Cup) | TheSportsDB | Manual | Limited coverage. |

**Use the best official API per sport, not ESPN for everything.** ESPN's unofficial API (`site.api.espn.com`) is undocumented and may break — use it as fallback, not default.

**BALLDONTLIE** (`balldontlie.io`): Free tier covers basic data for NBA, NFL, MLB, NHL, EPL, World Cup. Paid tiers ($9.99-$39.99/mo) add real-time data and odds. Evaluate free tier coverage before committing.

**API discovery:** Use the **Firecrawl MCP** to scrape API docs when evaluating new sports data sources. The **Public APIs** catalogue (`github.com/public-apis/public-apis`) is a good starting point for finding free endpoints.

## Data Flow

1. Vercel cron job or admin-triggered fetch checks for results of active events
2. Results stored in DB as **provisional**
3. Admin gets notification: "Result ingested for [Event] — confirm or correct"
4. Admin confirms (one-click) or corrects, then result becomes **final**
5. Scores calculated automatically on confirmation
6. Users never hit external APIs directly

## Key Principles

- Prefer official APIs over unofficial scrapers
- Cache aggressively — fetch once, serve from DB
- Graceful fallback to manual entry when APIs fail or lack coverage
- Rate-limit awareness: most free tiers are 100-1000 req/day
