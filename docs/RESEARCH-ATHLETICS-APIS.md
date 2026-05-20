# Athletics / Track & Field Data Sources Research

Date: 2026-05-20

## Current Setup

No automated provider. `athletics: [fixturePool, manual]` in `registry.ts`. All athletics events are manual-entry only.

## Sources Evaluated

| Source | Fixtures | Results | API | Access | Major Comps | Verdict |
|--------|----------|---------|-----|--------|-------------|---------|
| **TheSportsDB** | Yes | No (all null) | REST | Free, no key | DL, Worlds, Olympics, European, Commonwealth | **Best for fixtures** |
| **World Athletics** | Yes | Yes | GraphQL (unofficial) | Free but key rotates | All WA-sanctioned | Fragile — key rotation needs Selenium |
| **nimarion wrapper** | Yes | Yes | REST (3rd party hosted) | Free | All WA-sanctioned | Risky — depends on 3rd party uptime |
| **ESPN** | No | No | N/A | N/A | None | Athletics not supported |
| **OpenTrack** | Partial | Partial | REST (token auth) | Free account | Club/federation only | Wrong scope — not major championships |
| **Tilastopaja** | No API | Historical only | Export (JSON/Excel) | Federation clients | Broad historical | No developer API |
| **RapidAPI** | No | No | N/A | N/A | None | Nothing exists |
| **Sportradar** | Yes | Yes | REST | $10k+/mo | Full | Cost-prohibitive |
| **Data Sports Group** | Yes | Yes | REST | Paid (unknown) | Full | Possibly viable if affordable |

## Key Findings

**No free API provides both fixtures AND results for athletics.** The landscape is fundamentally different from team sports.

**TheSportsDB has good fixture data but zero results.** Diamond League (5282), World Championships (5007), Olympics (4994), European Championships (5285), Commonwealth Games (5008) all have events at individual-discipline granularity (e.g. "Men's 100m Final at Shanghai Diamond League"). However, `intHomeScore`, `intAwayScore`, and `strResult` fields are all null — TheSportsDB's data model is team-score-oriented.

**World Athletics has a GraphQL API but it's unofficial and fragile.** The API key rotates periodically and requires Selenium to scrape from the website. Community wrappers exist (nimarion/worldathletics on GitHub) but depend on third-party hosting with no SLA.

**ESPN has zero athletics coverage.** Confirmed via API testing — 404 for athletics endpoints.

## TheSportsDB League IDs

| League | ID |
|--------|-----|
| Diamond League | 5282 |
| World Athletics Championships | 5007 |
| Olympics Athletics | 4994 |
| Commonwealth Games Athletics | 5008 |
| European Athletics Championships | 5285 |
| World Athletics Indoor Championships | 5283 |
| Grand Slam Track | 5644 |
| Continental Tour Gold | 5302 |
| Continental Tour Silver | 5303 |
| Continental Tour Bronze | 5304 |

## Recommended Actions

1. **Add TheSportsDB as athletics fixture source** — add `"athletics"` to `supportedSports`, map league IDs, add to `registry.ts` chain. Gives fixture browsing for all major competitions at zero cost.
2. **Results stay manual** — no free, reliable result API exists. Admin enters results after events (low burden — few events per meet for prediction purposes).
3. **Future option: nimarion wrapper** — if athletics usage grows, test `worldathletics.nimarion.de` as a best-effort result fetcher. No SLA, but clean REST API with normalised data.
4. **No new API keys or costs required** for the fixture-only approach.
