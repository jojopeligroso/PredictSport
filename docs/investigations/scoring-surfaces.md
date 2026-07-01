# Scoring System — All Surfaces (/wc instance)

## Scoring Pipeline

```
Event result confirmed (auto or admin)
  → scoreEventPredictions() → batch_score_predictions RPC
    → predictions.{is_correct, is_partial, points_awarded} updated
      → Leaderboard/dashboard/profile queries read from predictions
```

## Point Values (WC 2026)

| Prediction | Points | Knockout Only |
|-----------|--------|---------------|
| Winner (1X2) | 2 | No |
| Exact Score | 3 | No |
| Head-to-Head | 1 | Yes |
| Max group match | 5 | — |
| Max knockout match | 6 | — |

## Core Scoring Logic

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/scoring.ts` | 16-59 | `scorePrediction()` — main dispatcher for 10 types |
| `src/lib/scoring.ts` | 149-254 | `scoreWinner()` — positional derivation, AET override, draw handling |
| `src/lib/scoring.ts` | 417-525 | `scoreHeadToHead()` — who advances (2 options) |
| `src/lib/scoring.ts` | 705-790 | `scoreExactScore()` — FT score match, AET voiding |
| `src/lib/scoring.ts` | 116-143 | `buildScoreDerivedWinnerOverrides()` — score overrides explicit winner |
| `src/lib/tournament/scoring-config.ts` | 9-61 | `createWorldCupEventEPTs()` — EPT row creation |

## Result Ingestion

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/sports/providers/thesportsdb.ts` | 98-170 | `normalizeEvent()` — AET/AP/PEN detection, periods storage |
| `src/lib/sports/auto-result.ts` | 135-419 | `autoResolveEvent()` — provider search, knockout guard, confirmation |
| `src/lib/sports/auto-result.ts` | 290-326 | Knockout guard — holds draw results until ET/pens resolve |
| `src/lib/sports/auto-result.ts` | 624-722 | `scoreEventPredictions()` — batch scoring via RPC |
| `src/lib/sports/auto-result.ts` | 733-797 | `propagateResultToSiblings()` — shared fixture scoring |
| `src/lib/tournament/finalisation.ts` | 14-68 | `confirmTournamentResult()` — manual admin confirmation |

## Database (scoring-related)

| Table/RPC | Purpose |
|-----------|---------|
| `predictions` | `is_correct`, `is_partial`, `points_awarded`, `confidence_level` |
| `event_prediction_types` | Per-event points, partial_points, config (options, allow_draw) |
| `events.result_data` | Score, winner, periods (extra_time / penalties), provider |
| `batch_score_predictions(jsonb)` | Atomic UPDATE of all predictions for an event |
| `sum_prediction_points(uuid[], uuid, uuid)` | SUM(points_awarded) grouped by user |
| `sum_stage_points(uuid[], uuid, uuid, uuid)` | Stage-scoped points for Format classification |

## Cron / Background

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/results/cron` | pg_cron 15min + Vercel daily 07:00 | Auto-fetch results, score, notify |
| `/api/tournament/cron/auto-finalise` | pg_cron 5min | Round/stage finalisation |
| `/api/tournament/cron/lock-windows` | pg_cron 5min | Lock prediction windows |

## API Routes (scoring data)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/tournament/standings` | GET | Leaderboard standings via `sum_prediction_points` |
| `/api/tournament/accuracy` | GET | Accuracy stats (winner %, exact score %) |
| `/api/tournament/rival-predictions` | GET | Rival predictions with totalPoints per row |
| `/api/tournament/community-picks` | GET | Community prediction aggregation |
| `/api/admin/confirm-result` | POST | Admin confirms + scores + notifies |
| `/api/tournament/confirm-result` | POST | Tournament admin confirmation |
| `/api/tournament/correct-result` | POST | Emergency score correction |
| `/api/predictions` | POST | Prediction submission (lock time enforced) |

## UI Surfaces (read scoring data)

### Pages
| File | Surface |
|------|---------|
| `src/app/wc/leaderboard/page.tsx` | Leaderboard — overall + format standings |
| `src/app/wc/home/DashboardSections/ResultsSection.tsx` | Dashboard — latest results with +pts earned |
| `src/app/wc/entrant/[userId]/page.tsx` | Entrant profile — rank, total points, accuracy |

### Components
| File | What it shows |
|------|--------------|
| `src/components/tournament/ClassificationTabs.tsx` | Leaderboard tabs — rank, points, accuracy per user |
| `src/components/wc/DashboardResultCard.tsx` | Result card — `+{totalPoints}` with shimmer on exact |
| `src/components/wc/RivalPredictionsTab.tsx` | Rival picks — points pill per prediction row |
| `src/app/wc/entrant/[userId]/EntrantProfileHeader.tsx` | Profile header — rank, totalPoints, accuracy % |
| `src/app/wc/entrant/[userId]/PicksByRound.tsx` | Pick history — per-pick points breakdown |
| `src/components/ui/PointsStamp.tsx` | Points badge — `+{earned}/{max}` with color |
| `src/app/wc/picks/[windowId]/FormatScoringExplainer.tsx` | Scoring rules collapsible |
| `src/components/wc/CommunityPicksCard.tsx` | Community prediction distribution |

### Admin
| File | What it shows |
|------|--------------|
| `src/components/tournament/admin/ResultConfirmation.tsx` | Result confirmation panel |
| `src/components/tournament/admin/CorrectionFlow.tsx` | Score correction UI |
| `src/components/tournament/admin/FinalisationPanel.tsx` | Finalisation progress counter |

### Score Input
| File | What it does |
|------|-------------|
| `src/components/ScoreInput.tsx` | Core score input primitive (compact/card/standard) |
| `src/components/ExactScoreSection.tsx` | Exact score wrapper |
| `src/components/ExactScoreInput.tsx` | GAA 4-input score |
| `src/components/tournament/bracket/ScoreCollector.tsx` | Admin tiebreaker score input |

### Notifications
| File | What it does |
|------|-------------|
| `src/lib/notifications/result-confirmed.ts` | Push + chat message on result confirmation |
| `src/lib/notifications/result-disputed.ts` | Alert on cross-validation discrepancy |

### Reputation Tags (post-scoring)
| File | What it does |
|------|-------------|
| `src/lib/reputation/index.ts` | Event-driven + behavioural tag assignment |
| `src/lib/reputation/publish.ts` | Tag publishing + chat messages |

## Key Invariants

1. **Score is source of truth** — exact_score overrides explicit winner pick
2. **Winner = 90-minute result** — AET matches are scored as "Draw" for winner
3. **H2H = who advances** — uses aggregate score (including ET/pens)
4. **PostgREST 1000-row cap** — all aggregation via SQL RPCs, not JS loops
5. **Atomic scoring** — `batch_score_predictions` RPC, single transaction
6. **No confidence multiplier** — 1-5 scale is purely decorative
7. **Round locking** — all events in a round lock at earliest fixture start
