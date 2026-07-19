# Blueprint Creation Process

Step-by-step process for creating a competition blueprint. Every step must be completed in order. Do not write migration SQL until step 6.

## Glossary

| Term | Definition |
|------|-----------|
| **Blueprint** | `sporting_tournaments` + `sporting_stages` + `bracket_templates`. The complete fixture catalogue and structure for one competitive arc. |
| **Instance** | A `competitions` row with `tournament_id` FK to a blueprint. What participants join. Predictions and leaderboards are per-instance. |
| **Stage** | A `sporting_stages` row. One structural phase that produces positions and feeds progressions (e.g., "Regular Season", "Quarterfinals"). NOT a single matchday. |
| **Round** | A prediction window within a stage. Temporal grouping of fixtures sharing a lock time. Multiple rounds per stage. Instance-level, not blueprint-level. |
| **Fixture** | An `events` row. A single predictable sporting event within a stage. |
| **Progression** | A `stage_progressions` row. Directed link declaring how positions from one stage populate slots in the next. |
| **Competitive arc** | The full predictor journey from first fixture to final resolution. A blueprint may span multiple real-world governing-body tournaments if the arc is continuous. |

## Step 1: Identify Data Sources

Query the provider system to confirm what APIs cover this league.

**For baseball (winter leagues):**
```
MLB Stats API: statsapi.mlb.com/api/v1/league?sportId=17
ESPN: site.api.espn.com/apis/site/v2/sports/baseball/{slug}/scoreboard
```

Record:
- [ ] Primary provider name + league ID
- [ ] Cross-check provider (if any)
- [ ] `provider_league` key (e.g., `"winter/lmp"`)

## Step 2: Fetch and Read API Metadata

```
GET statsapi.mlb.com/api/v1/league?sportId={id}
```

Record every structural flag:
- [ ] `numTeams`
- [ ] `numGames`
- [ ] `hasSplitSeason` — if true, investigate the points/bonus system
- [ ] `hasPlayoffPoints` — if true, standings are NOT pure W-L; find the points formula
- [ ] `hasWildCard`
- [ ] `seasonDateInfo` — all date boundaries (RS start/end, postseason start/end, half-season split dates)

**Do not skip any flag. Each one is structural.**

## Step 3: Fetch Roster from Schedule

```
GET statsapi.mlb.com/api/v1/schedule?sportId=17&leagueId={id}&date={mid-season-date}
```

Extract all team names that appear. Compare against any existing blueprint. Flag discrepancies (franchise moves, name changes, new teams).

Record:
- [ ] Full team list with exact API spelling
- [ ] Any team name changes from prior season

## Step 4: Fetch Standings — Understand Seeding

```
GET statsapi.mlb.com/api/v1/standings?leagueId={id}&season={year}&standingsType=regularSeason
```

- [ ] Record the rank order and W-L for all teams
- [ ] If multiple teams share the same W-L record but have different ranks, **stop and investigate the tiebreaker/points system**
- [ ] If `hasPlayoffPoints: true`, search for the official points formula (league website, Wikipedia)
- [ ] Document: what determines playoff seeding? (W-L, points, head-to-head, run differential?)

## Step 5: Trace the Bracket from Actual Game Data

This is the critical verification step. Fetch actual playoff games and determine the bracket structure empirically.

### 5a: Fetch QF matchups
```
GET statsapi.mlb.com/api/v1/schedule?sportId=17&leagueId={id}&startDate={qf-start}&endDate={qf-end}
```

- [ ] List all series (group games by home/away pair)
- [ ] Identify higher seed (home in games 1-2 under 2-3-2 format)
- [ ] Confirm QF seeding matches expected pattern (1v8, 2v7, 3v6, 4v5)
- [ ] Determine QF winners (count wins per team per series)

### 5b: Fetch SF matchups
```
GET statsapi.mlb.com/api/v1/schedule?sportId=17&leagueId={id}&startDate={sf-start}&endDate={sf-end}
```

- [ ] List SF series with home/away
- [ ] **Key question: does W(1v8) play W(4v5) (fixed bracket) or does highest surviving seed play lowest (reseeded)?**
- [ ] Trace: which QF winner plays which? Compare against both models.
- [ ] Record verdict: `fixed` or `reseed` with evidence

### 5c: Fetch Final matchups
```
GET statsapi.mlb.com/api/v1/schedule?sportId=17&leagueId={id}&startDate={final-start}&endDate={final-end}
```

- [ ] Confirm final participants match SF winners
- [ ] Note home advantage rule (better RS record? higher original seed?)

### 5d: Check for wild card or play-in
- [ ] Does the league have a wild card stage between RS and QF?
- [ ] If yes, fetch those games and document the format

## Step 6: Document Findings — Present to User

Before writing any SQL, present:

1. **League metadata** (teams, games, dates, split season, points system)
2. **Standings system** (how seeding is determined, with evidence)
3. **Bracket structure** (fixed/reseeded, with the actual matchup data that proves it)
4. **Progression chain** (RS → QF → SF → Final → SdC, with slot mappings)
5. **Anything unverified** (flagged explicitly)

**Wait for user confirmation before proceeding.**

## Step 7: Write the Migration

Only after user confirmation, write the seed migration containing:

1. `sporting_tournaments` row — with verified config including standings system
2. `sporting_stages` rows — all stages in the competitive arc, domestic + international
3. `bracket_templates` row — with verified bracket structure
4. Header comment citing sources (API endpoints, official site URLs)

## Step 8: Verify

- [ ] Team names in `leagueTeams` match API spelling exactly
- [ ] Bracket type matches Step 5 evidence
- [ ] Points/standings system is documented in config
- [ ] SdC stages are included (if applicable)
- [ ] `provider_league` is set
- [ ] `ends_at` covers the full arc (including SdC dates if applicable)
- [ ] No claims are made without a cited source

## Anti-Patterns

- **Never cite AI-written code on the same branch as evidence.** Verify independently.
- **Never assume bracket type.** Trace it from actual game data.
- **Never ignore API metadata flags.** Each one is structural information.
- **Never accept web search summaries over primary API data.** The API has the actual games.
- **Never present unverified claims without hedging.** Use `"verify_before_launch": true` for anything unconfirmed.
- **Never skip the standings analysis.** If tied records exist with different seedings, there is a hidden system. Find it.
