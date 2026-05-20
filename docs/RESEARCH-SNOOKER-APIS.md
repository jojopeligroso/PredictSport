# Snooker Data Sources Research

Date: 2026-05-20

## Current Setup

ESPN returns 400 for snooker. Chain in `registry.ts:51` is `[fixturePool, espn, manual]` — effectively manual-only since ESPN fails. TheSportsDB has league 4555 but sparse/empty fixture data.

## Sources Evaluated

| Source | Fixtures | Results | Frame Scores | API | Access | Coverage | Verdict |
|--------|----------|---------|--------------|-----|--------|----------|---------|
| **api.snooker.org** | Yes (`?t=14`) | Yes (`?t=15`) | Yes | REST/JSON | Free (non-commercial) | All WST events | **Primary — best option** |
| TheSportsDB | Empty/sparse | Finals only | In `strResult` text | REST | Free | League 4555, sparse | Poor for snooker |
| ESPN | No (400 error) | No | No | N/A | N/A | None | Broken for snooker |
| CueTracker | No | Historical only | No | None (scraping) | N/A | Since 1908 | Not usable |
| Sportradar v2 | Yes | Yes | Pot-by-pot | REST | $10k+/mo | All WST, live | Too expensive |
| Data Sports Group | Yes | Yes | Yes | REST | Paid (unknown) | 22 competitions | Too expensive |
| SportDevs (RapidAPI) | Claimed | Claimed | Unknown | REST | Trial | Unknown | Site down — avoid |
| wst.tv | No | No | No | None | N/A | N/A | No public API |

## Key Findings

**api.snooker.org is the clear winner.** Free REST API with 21 endpoints, snooker-native data model (not team-sport shoehorned), covers all World Snooker Tour ranking events. Match model has 34 fields including `Score1`/`Score2` (frame count), `WinnerID`, `FrameScores`, `ScheduledDate`, `Round`, `EventID`.

**Access requires an approved header.** Email `webmaster@snooker.org` to get an `X-Requested-By` header value. No API key — just a single header for attribution. Free for non-commercial use.

**Active ecosystem confirms stability.** Python wrapper (`mgorsk1/snooker`), R client (`echasnovski/snookerorg`), WordPress plugin all use this API in production.

**ESPN and TheSportsDB are not viable for snooker.** ESPN returns 400. TheSportsDB has a snooker league (4555) but fixture data is empty and results only cover some tournament finals, not individual matches.

## Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `?t=14` | Upcoming matches (filterable by tour) |
| `?t=15&ds=7` | Recent results (last 7 days) |
| `?t=5&s=2025` | All events in 2025/2026 season |
| `?t=6&e={id}` | All matches for a specific event |
| `?t=7` | Currently live matches |
| `?e={id}` | Single event details |

## Recommended Actions

1. **Create `snookerorg.ts` provider** extending `BaseProvider`. Auth via `X-Requested-By` header stored in `SNOOKER_ORG_HEADER` env var.
2. **Email `webmaster@snooker.org`** to request header approval. Frame as non-commercial prediction app.
3. **Register in `registry.ts`** replacing ESPN in snooker chain: `[fixturePool, snookerOrg, manual]`.
4. **Map results** — `Score1`/`Score2` directly to frame score format (e.g., "10-7").
5. Until header is approved, snooker continues as manual-entry (same as current effective state since ESPN fails).
