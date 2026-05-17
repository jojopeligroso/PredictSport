# Tournament Formats Research

Research into tournament structures that could layer on top of or replace the current cumulative-points leaderboard.

## Current State

PredictSport uses cumulative rounds with percentage-based scoring. No tournament code exists yet.

## Format Options

### 1. Single Elimination
- Bracket-style, losers eliminated each round
- High drama, simple to visualize, quick (4-5 weeks for 16 players)
- Cons: luck-heavy, one bad round kills you, no second chances
- Best for: Quick tournaments, "March Madness" vibe

### 2. Double Elimination
- Winners' + Losers' brackets; need to lose twice to exit
- Redemption arcs, more matches, reduced luck
- Cons: complex to track, long duration (12+ weeks), confusing pairings
- Best for: Longer commitment groups

### 3. Round-Robin
- Every player predicts against every other player H2H
- Most fair, data-rich, familiar league-table aesthetic
- Cons: combinatorially explosive (20 players = 190 matchups), can feel grindy
- Best for: Fair, inclusive, data-driven competition (6-12 players)

### 4. Swiss System
- Multiple rounds; pair players with similar records after each round
- Fair (no elimination), scales 5-30 people, rewards consistency
- Cons: less dramatic, admin-heavy pairing recalculation
- Best for: Casual friend groups (recommended primary format)

### 5. Group Stage + Knockout
- Round-robin groups then single-elimination bracket (World Cup style)
- Epic narrative arc, validates growth, familiar structure
- Cons: requires 12+ players, complex qualification rules, admin burden
- Best for: Larger groups wanting cinematic experience

### 6. Ladder / Elo Rating
- Continuous ranked ladder with rating adjustments per round
- Continuous engagement, dynamic rankings, forgiving
- Cons: no "winner" moment, active players dominate, Elo opaque to casuals
- Best for: Long-term engagement, evergreen competitions

### 7. League + Playoffs
- Cumulative season (10-15 rounds) then top N enter knockout bracket
- Sustained engagement, climactic finish, familiar sports model
- Cons: 4+ month commitment, early rounds feel low-stakes
- Best for: Groups wanting a full season arc

## Hybrid Ideas (Prediction-Specific)

### A. Accuracy Brackets
Seed players by Round 1 accuracy, then single-elimination bracket. Skill-based seeding prevents mismatches early.

### B. Head-to-Head Point Battles
Swiss-style weekly pairings; compare accuracy on that week's events only. Win=3pts, Draw=1pt, Loss=0pts. Fast-moving, fresh matchups.

### C. Division Play
Tier-based concurrent tournaments with promotion/relegation between seasons. Everyone plays at their level.

### D. Weekly Survival
Bottom 1-2 players lose a "life" each week (3 lives total). Constant jeopardy but anyone can recover.

## Recommendation Matrix

| Format | Group Size | Duration | Drama | Fairness | Admin Load |
|--------|-----------|----------|-------|----------|-----------|
| Single Elim | 5-8 | 4-5 wks | 5/5 | 2/5 | Low |
| Double Elim | 8-16 | 8-12 wks | 4/5 | 3/5 | Medium |
| Round-Robin | 6-12 | 4-8 wks | 3/5 | 5/5 | Low |
| Swiss | 8-20 | 5-7 wks | 4/5 | 5/5 | Medium |
| Group+KO | 12-20 | 6-8 wks | 5/5 | 4/5 | High |
| Ladder/Elo | 5-50 | Ongoing | 3/5 | 3/5 | Medium |
| League+Playoffs | 10-20 | 12-16 wks | 5/5 | 4/5 | Medium |

## Implementation Notes

Existing schema supports tournament overlays with minimal additions:
- `tournament_format` enum on `competitions`
- `tournament_bracket` JSONB on `competitions` (bracket tree, pairings, results)
- `round_group_id` nullable on `rounds` (phase grouping)
- `tournament_seed` int on `competition_members`
- H2H matchup views (compare accuracy between two players in a round)

No schema breakage needed — all formats can be derived from existing prediction data.
