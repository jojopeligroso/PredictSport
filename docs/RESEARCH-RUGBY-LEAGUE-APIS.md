# Rugby League Data Sources Research

Date: 2026-05-20

## Current Setup

ESPN provides NRL coverage via `rugby-league/3` series ID (hardcoded in `src/lib/sports/providers/espn.ts`). TheSportsDB is NOT currently in the `rugby_league` provider chain despite supporting it.

## Sources Evaluated

| Source | NRL | Super League | Other Leagues | API | Auth | Cost |
|--------|-----|-------------|---------------|-----|------|------|
| **ESPN** | Yes (`rugby-league/3`) | No | No | Unofficial | None | Free |
| **TheSportsDB** | Yes (ID 4416) | Yes (ID 4415) | Challenge Cup, State of Origin | REST | None | Free |
| API-Football | No | No | No | REST | Key | N/A |
| RapidAPI rugby | Minimal | Minimal | No | REST | Key | Paid |

## Key Findings

**ESPN covers NRL only.** Works well for scoreboard and results via the existing rugby-league provider, but has zero Super League coverage. No other rugby league competitions either.

**TheSportsDB covers NRL + Super League.** Both leagues have dedicated IDs (4416, 4415) and return fixtures via the standard `/eventsround.php` and `/eventspastleague.php` endpoints. Already integrated as a provider in the codebase but NOT listed in the `rugby_league` provider chain in `registry.ts`.

**No dedicated rugby league API exists.** Unlike cricket or soccer, there's no specialist rugby league data provider on any API marketplace.

## Provider Chain Gap

Current `rugby_league` chain in `registry.ts:43`:
```
rugby_league: [providers.espn]
```

TheSportsDB supports rugby league but is missing from the chain. Compare with `rugby` which has:
```
rugby: [providers.espn, providers.theSportsDB]
```

## Recommended Actions

1. **Add TheSportsDB to `rugby_league` provider chain** in `registry.ts` — gives Super League coverage and NRL backup.
2. **Add `"rugby_league"` to TheSportsDB `supportedSports`** array if not already present.
3. **No new providers needed** — ESPN + TheSportsDB covers NRL and Super League adequately.
4. **No API keys required** — both providers are free and keyless.
