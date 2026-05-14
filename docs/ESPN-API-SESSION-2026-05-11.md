# ESPN API Integration — Session Debug Log (2026-05-11)

## Status: UNRESOLVED — Needs Verification

The user confirmed "At this time it does not work" after the Vercel deployment showed READY.
The session produced a commit (`cbf832e`) but the actual effect on the live app is unconfirmed.

---

## What We Are Trying To Do

Replace TheSportsDB as the primary fixture source with ESPN's unofficial scoreboard API for all supported sports (soccer, rugby union, US sports, tennis, golf). TheSportsDB should remain as a fallback only.

**ESPN API base:** `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`

**Key discovery:** Without a `dates` query parameter, ESPN returns today's events only. The fix is a 30-day window: `?dates=YYYYMMDD-YYYYMMDD`.

---

## Two Separate Fixture Paths (Critical Distinction)

The app has two completely separate codepaths for fixtures — previous sessions confused them:

### Path A — League Browse (THE BROKEN ONE)
- **Trigger:** User selects a league from the fixture browser dropdown
- **Route:** `GET /api/sports/fixtures?league=<id>`
- **File:** `src/app/api/sports/fixtures/route.ts`
- **Routing logic:** `ESPN_LEAGUE_MAP` determines which leagues go to ESPN vs TheSportsDB
- **Fetch function:** `fetchESPNFixtures(espnPath, sport)`

### Path B — Text Search
- **Trigger:** User types in the event search box
- **Route:** `GET /api/sports/search?sport=X&q=Y`
- **File:** `src/lib/sports/providers/espn.ts` → `ESPNProvider`
- **Status:** Fixed in a prior session (date range added)

**All focus must be on Path A.**

---

## Root Causes Identified

### Problem 1 — `fetchESPNFixtures` had no date range
Without `?dates=YYYYMMDD-YYYYMMDD`, ESPN returns today's events only. Off-season sports return zero results, triggering a TheSportsDB fallback.

**Broken:**
```typescript
const res = await fetch(`${ESPN_BASE}/${espnPath}/scoreboard`, ESPN_FETCH_OPTS);
```

**Fix (should now be in route.ts):**
```typescript
const today = new Date();
const end = new Date(today.getTime() + 30 * 86_400_000);
const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const dates = `${fmt(today)}-${fmt(end)}`;
const res = await fetch(`${ESPN_BASE}/${espnPath}/scoreboard?dates=${dates}`, ESPN_FETCH_OPTS);
```

### Problem 2 — `ESPN_LEAGUE_MAP` was missing most leagues
Before the session, ESPN_LEAGUE_MAP only contained:
- 4 cricket T20 paths (all return HTTP 404 — ESPN dropped cricket)
- 4 US sports (NBA, MLB, NHL, NFL)

Everything else — all soccer, rugby union, tennis, golf — fell through to TheSportsDB.

**Fix (should now be in route.ts):** Full ESPN_LEAGUE_MAP covering:
- Soccer: Premier League, Championship, League Cup, Champions League, Europa League, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Belgian Pro League, Greek Super League, League of Ireland Premier, Scottish Premiership, FIFA World Cup, Copa Libertadores
- Rugby union: URC (numeric ID `270557`)
- Tennis: ATP, WTA
- Golf: DP World Tour
- US Sports: NBA, MLB, NHL, NFL
- Cricket: **REMOVED** — all ESPN cricket paths return 404

---

## ESPN Coverage Map (Confirmed via Live API Tests)

| Sport | ESPN Coverage | Notes |
|-------|--------------|-------|
| Soccer | ✅ All major leagues | Use named slugs e.g. `soccer/eng.1` |
| Rugby Union | ✅ URC confirmed | Numeric IDs e.g. `rugby/270557` |
| Rugby League | ❌ Not available | NRL (4416), Super League (4415) → TheSportsDB |
| Cricket | ❌ Not available | ESPN dropped cricket — all paths return 404 |
| Snooker | ❌ Not available | Returns 400 |
| Tennis | ✅ ATP, WTA | `tennis/atp`, `tennis/wta` |
| Golf | ✅ DP World Tour | `golf/eur` |
| NBA | ✅ | `basketball/nba` |
| MLB | ✅ | `baseball/mlb` |
| NHL | ✅ | `hockey/nhl` |
| NFL | ✅ | `football/nfl` |
| Formula 1 | N/A | Handled by OpenF1 provider |
| GAA | N/A | Handled by Foireann API |
| ERCC (4550) | ❌ Not found | Scanned 60+ numeric IDs, not on ESPN |

---

## Commit Made (But Unverified in Production)

**Commit:** `cbf832e` — "Route soccer, rugby union, tennis, golf leagues through ESPN; fix dateless fixture fetch"
**Branch:** master
**Vercel deployment:** `dpl_AjMcTvsrh8uCAJ7WhRSys1tBT2ss` — showed `state: READY`

User confirmed "it does not work" after this deployment. Possible explanations:
1. The commit changes didn't actually solve the problem (race condition, wrong file edited)
2. 5-minute Next.js cache (`next: { revalidate: 300 }`) serving stale TheSportsDB results
3. ESPN API returning unexpected shape that the normalizer doesn't handle
4. Some other codepath issue not yet diagnosed

---

## Next Steps Required

1. **Verify the file on disk** — Read `src/app/api/sports/fixtures/route.ts` and confirm both fixes are present: the 30-day `dates` param and the full `ESPN_LEAGUE_MAP`.
2. **Test ESPN directly** — Playwright or curl against `site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=YYYYMMDD-YYYYMMDD` to confirm it returns data.
3. **Test the API route** — Hit `/api/sports/fixtures?league=4328` on the deployed app (authenticated) and inspect the raw JSON response.
4. **Check the cache** — If returning stale data, the `revalidate: 300` Next.js cache may need a forced bust.
5. **Add error logging** — The current `try/catch` swallows all errors silently (`catch { return []; }`). Add `console.error` to make failures visible in Vercel function logs.
6. **Rugby — find more ESPN IDs** — Only URC (`270557`) confirmed. Premiership, Top 14, Super Rugby IDs unknown.
7. **ERCC (4550)** — Remains on TheSportsDB; ESPN ID not found after exhaustive search.

---

## File Reference

| File | Role |
|------|------|
| `src/app/api/sports/fixtures/route.ts` | League browse — ESPN_LEAGUE_MAP + fetchESPNFixtures |
| `src/lib/sports/providers/espn.ts` | Text search — ESPNProvider class |
| `src/lib/sports/search-events.ts` | Provider orchestration for text search |
| `src/lib/sports/registry.ts` | Provider chain per sport |

---

## ESPN API Reference (Confirmed Format)

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard?dates={range}
```

- `sport/league` examples: `soccer/eng.1`, `basketball/nba`, `rugby/270557`, `tennis/atp`
- `dates` range format: `YYYYMMDD-YYYYMMDD` (confirmed working — returns multi-day results)
- `dates` single day: `YYYYMMDD` (today only — avoid)
- No API key required
- Response shape: `{ events: [...], leagues: [{ name, season }] }`
- Each event: `{ id, name, date, status: { type: { completed } }, competitions: [{ competitors }] }`
- Each competitor: `{ homeAway: "home"|"away", team?: { displayName }, athlete?: { displayName } }`
