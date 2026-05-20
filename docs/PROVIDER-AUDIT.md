npm warn exec The following package was not found and will be installed: tsx@4.22.3
[sports] API_FOOTBALL_KEY not set -- API-Football provider disabled
[sports] BALLDONTLIE_KEY not set -- BALLDONTLIE provider disabled
[sports] THERACING_API_KEY not set -- TheRacingAPI provider disabled
[sports] foireann: FOIREANN_API_KEY not set, provider disabled
Testing fixture_pool for soccer...
Testing api-football for soccer...
Testing espn for soccer...
Testing thesportsdb for soccer...
Testing balldontlie for soccer...
Testing fixture_pool for formula_1...
Testing openf1 for formula_1...
Testing fixture_pool for rugby...
Testing espn for rugby...
Testing thesportsdb for rugby...
Testing fixture_pool for tennis...
Testing espn for tennis...
Testing thesportsdb for tennis...
Testing fixture_pool for golf...
Testing espn for golf...
Testing thesportsdb for golf...
Testing fixture_pool for gaa...
Testing foireann for gaa...
Testing manual for gaa...
Testing fixture_pool for cricket...
Testing espn for cricket...
Testing thesportsdb for cricket...
Testing fixture_pool for nba...
Testing balldontlie for nba...
Testing espn for nba...
Testing fixture_pool for nfl...
Testing espn for nfl...
Testing balldontlie for nfl...
Testing fixture_pool for mlb...
Testing espn for mlb...
Testing balldontlie for mlb...
Testing fixture_pool for nhl...
Testing espn for nhl...
Testing balldontlie for nhl...
Testing fixture_pool for horse_racing...
Testing theracing-api for horse_racing...
Testing fixture_pool for snooker...
Testing espn for snooker...
[sports] espn: 400 Bad Request for general/snooker/scoreboard
Testing manual for snooker...
# Provider Audit Report

Generated: 2026-05-20T21:47:22.141Z

## Summary

| Provider | Sport | Search | Results | Latency | Events |
|----------|-------|--------|---------|---------|--------|
| fixture_pool | soccer | OK | N/A | 0ms | 0 |
| api-football | soccer | OK | N/A | 0ms | 0 |
| espn | soccer | OK | OK | 754ms / 503ms | 5 |
| thesportsdb | soccer | OK | OK | 257ms / 66ms | 1 |
| balldontlie | soccer | OK | N/A | 0ms | 0 |
| fixture_pool | formula_1 | OK | N/A | 0ms | 0 |
| openf1 | formula_1 | OK | N/A | 479ms | 0 |
| fixture_pool | rugby | OK | N/A | 0ms | 0 |
| espn | rugby | OK | OK | 528ms / 186ms | 4 |
| thesportsdb | rugby | OK | N/A | 179ms | 0 |
| fixture_pool | tennis | OK | N/A | 0ms | 0 |
| espn | tennis | FAIL | N/A | 292ms | 0 |
| thesportsdb | tennis | OK | OK | 196ms / 66ms | 1 |
| fixture_pool | golf | OK | N/A | 0ms | 0 |
| espn | golf | FAIL | N/A | 172ms | 0 |
| thesportsdb | golf | OK | OK | 85ms / 58ms | 1 |
| fixture_pool | gaa | OK | N/A | 0ms | 0 |
| foireann | gaa | OK | N/A | 1ms | 0 |
| manual | gaa | OK | N/A | 0ms | 0 |
| fixture_pool | cricket | OK | N/A | 0ms | 0 |
| espn | cricket | OK | OK | 239ms / 284ms | 2 |
| thesportsdb | cricket | OK | OK | 65ms / 66ms | 1 |
| fixture_pool | nba | OK | N/A | 0ms | 0 |
| balldontlie | nba | OK | N/A | 0ms | 0 |
| espn | nba | OK | OK | 215ms / 108ms | 5 |
| fixture_pool | nfl | OK | N/A | 1ms | 0 |
| espn | nfl | OK | N/A | 174ms | 0 |
| balldontlie | nfl | OK | N/A | 0ms | 0 |
| fixture_pool | mlb | OK | N/A | 0ms | 0 |
| espn | mlb | OK | OK | 539ms / 303ms | 5 |
| balldontlie | mlb | OK | N/A | 0ms | 0 |
| fixture_pool | nhl | OK | N/A | 0ms | 0 |
| espn | nhl | OK | OK | 216ms / 122ms | 5 |
| balldontlie | nhl | OK | N/A | 0ms | 0 |
| fixture_pool | horse_racing | OK | N/A | 0ms | 0 |
| theracing-api | horse_racing | OK | N/A | 1ms | 0 |
| fixture_pool | snooker | OK | N/A | 0ms | 0 |
| espn | snooker | OK | N/A | 457ms | 0 |
| manual | snooker | OK | N/A | 0ms | 0 |

## Provider Stats

### fixture_pool
- Sports tested: 13
- Search success: 13/13
- Result fetch: 0/0
- Avg search latency: 0ms

### api-football
- Sports tested: 1
- Search success: 1/1
- Result fetch: 0/0
- Avg search latency: 0ms

### espn
- Sports tested: 10
- Search success: 8/10
- Result fetch: 6/6
- Avg search latency: 359ms
- Failures:
  - tennis search: Cannot read properties of undefined (reading '0')
  - golf search: Cannot read properties of undefined (reading 'map')

### thesportsdb
- Sports tested: 5
- Search success: 5/5
- Result fetch: 4/4
- Avg search latency: 156ms

### balldontlie
- Sports tested: 5
- Search success: 5/5
- Result fetch: 0/0
- Avg search latency: 0ms

### openf1
- Sports tested: 1
- Search success: 1/1
- Result fetch: 0/0
- Avg search latency: 479ms

### foireann
- Sports tested: 1
- Search success: 1/1
- Result fetch: 0/0
- Avg search latency: 1ms

### manual
- Sports tested: 2
- Search success: 2/2
- Result fetch: 0/0
- Avg search latency: 0ms

### theracing-api
- Sports tested: 1
- Search success: 1/1
- Result fetch: 0/0
- Avg search latency: 1ms

## Coverage Matrix

| Sport | fixture_pool | api-football | espn | thesportsdb | balldontlie | openf1 | foireann | manual | theracing-api |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| soccer | OK | OK | OK | OK | OK | - | - | - | - |
| formula_1 | OK | - | - | - | - | OK | - | - | - |
| rugby | OK | - | OK | OK | - | - | - | - | - |
| tennis | OK | - | FAIL | OK | - | - | - | - | - |
| golf | OK | - | FAIL | OK | - | - | - | - | - |
| gaa | OK | - | - | - | - | - | OK | OK | - |
| cricket | OK | - | OK | OK | - | - | - | - | - |
| nba | OK | - | OK | - | OK | - | - | - | - |
| nfl | OK | - | OK | - | OK | - | - | - | - |
| mlb | OK | - | OK | - | OK | - | - | - | - |
| nhl | OK | - | OK | - | OK | - | - | - | - |
| horse_racing | OK | - | - | - | - | - | - | - | OK |
| snooker | OK | - | OK | - | - | - | - | OK | - |

2 critical failure(s) detected.
