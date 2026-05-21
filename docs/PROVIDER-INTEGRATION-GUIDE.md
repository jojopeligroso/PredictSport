# Provider Integration Guide

How to add a new sports data provider to PredictSport.

## Architecture Overview

```
src/lib/sports/
  types.ts           # Sport type, SportsProvider interface, NormalizedResult
  providers/base.ts  # BaseProvider abstract class (fetch, rate limiting, timeout)
  providers/*.ts     # Individual provider implementations
  registry.ts        # Sport → provider chain mapping
  rate-limiter.ts    # In-memory sliding-window rate limiter
```

Every provider extends `BaseProvider` and implements `SportsProvider`:
- `searchEvents(sport, query, options?)` — returns `SearchableEvent[]` for admin fixture search
- `getResult(sport, externalEventId, providerLeague?)` — returns `NormalizedResult | null`

The registry maps each sport to an ordered provider chain. The caller iterates the chain and uses the first non-null result.

## Step-by-Step: Adding a Provider

### 1. Create the provider file

Create `src/lib/sports/providers/your-provider.ts`:

```typescript
import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  ResultPosition,
  ResultScore,
  SearchableEvent,
  Sport,
} from "../types";

// API response types (define what the external API returns)
interface YourApiEvent {
  id: string;
  name: string;
  date: string;
  // ...
}

export class YourProvider extends BaseProvider {
  readonly name = "your-provider";
  readonly supportedSports = ["soccer", "rugby"] as const satisfies readonly Sport[];

  protected readonly config: ProviderConfig = {
    baseUrl: "https://api.example.com/v1/",
    rateLimit: { requests: 100, windowMs: 60_000 },
    // apiKey is optional — set from env var if needed
    apiKey: process.env.YOUR_API_KEY,
  };

  // Override if the API uses non-standard auth
  protected getAuthHeaders(apiKey: string): Record<string, string> {
    return { "X-Api-Key": apiKey };
  }

  async searchEvents(
    sport: Sport,
    query: string,
    options?: { date?: string; limit?: number }
  ): Promise<SearchableEvent[]> {
    const data = await this.apiFetch<YourApiEvent[]>("events", {
      q: query,
      limit: String(options?.limit ?? 10),
    });
    if (!data) return [];

    return data.map((e) => ({
      external_event_id: `your-provider:${e.id}`,
      event_name: e.name,
      sport,
      start_time: e.date,
      competition_name: "League Name",
      participants: [], // or extract team names
      provider: this.name,
    }));
  }

  async getResult(
    sport: Sport,
    externalEventId: string
  ): Promise<NormalizedResult | null> {
    const id = externalEventId.replace("your-provider:", "");
    const data = await this.apiFetch<YourApiEvent>(`events/${id}`);
    if (!data) return null;

    return {
      provider: this.name,
      fetched_at: new Date().toISOString(),
      sport,
      external_event_id: externalEventId,
      event_name: data.name,
      is_final: true, // or check status field
      positions: null, // for multi-competitor sports (F1, golf)
      score: null,     // for team sports with home/away scores
      winner: null,    // name of winner (for H2H predictions)
      margin: null,    // numeric margin
      stats: null,     // e.g. { total_goals: 4 } for over/under
      raw: data,       // always include raw response
    };
  }
}
```

### 2. Register in the provider chain

Edit `src/lib/sports/registry.ts`:

```typescript
import { YourProvider } from "./providers/your-provider";

const providers = {
  // ... existing providers
  yourProvider: new YourProvider(),
} as const;

const sportProviders: Record<Sport, SportsProvider[]> = {
  // Add to the relevant sport chain(s)
  soccer: [providers.fixturePool, providers.yourProvider, providers.espn, ...],
};
```

### 3. Add env var (if key-gated)

Add to `.env.local.example`:
```
YOUR_API_KEY=           # Optional: Your Provider (https://example.com)
```

If the provider should gracefully disable when the key is missing, check in the constructor:
```typescript
constructor() {
  super();
  if (!process.env.YOUR_API_KEY) {
    console.warn("[sports] YOUR_API_KEY not set -- YourProvider disabled");
  }
}
```

And return early from both methods:
```typescript
async searchEvents(...): Promise<SearchableEvent[]> {
  if (!this.config.apiKey) return [];
  // ...
}
```

## Key Interfaces

### NormalizedResult

Every provider must return this shape from `getResult()`. Not all fields are needed — set irrelevant ones to `null`.

| Field | Type | Used By |
|-------|------|---------|
| `positions` | `ResultPosition[]` | winner, top_n (F1, golf, athletics) |
| `score` | `ResultScore` | winner, margin, over_under, handicap (team sports) |
| `winner` | `string` | head_to_head |
| `margin` | `number` | margin |
| `stats` | `Record<string, number>` | over_under (e.g. `total_goals`) |
| `is_final` | `boolean` | Whether the result is confirmed |
| `raw` | `unknown` | Always include — used for debugging |

### SearchableEvent

Returned from `searchEvents()` for admin fixture search/linking.

| Field | Type | Notes |
|-------|------|-------|
| `external_event_id` | `string` | Prefix with provider name: `"espn:401234"` |
| `event_name` | `string` | Human-readable: "Man Utd vs Liverpool" |
| `sport` | `Sport` | Pass through from the `sport` parameter |
| `start_time` | `string` | ISO 8601 datetime |
| `competition_name` | `string` | League/tournament name |
| `participants` | `string[]` | Team/player names (used for winner prediction options) |
| `provider` | `string` | `this.name` |

## Provider Chain Design

The chain order matters:

1. **FixturePool** — always first. Returns admin-curated events from the DB.
2. **Sport-specific provider** — best data quality (e.g., OpenF1 for F1, Foireann for GAA).
3. **ESPN** — broad coverage, reliable for team sports.
4. **TheSportsDB** — round-based fixture browsing, backup results.
5. **BallDontLie** — US sports fallback (free NBA, paid others).
6. **Manual** — implicit final fallback (not listed in chain, always available).

Place your provider where it makes sense in terms of data quality and reliability.

## BaseProvider Features

`BaseProvider` handles:
- **Rate limiting** — in-memory sliding window per provider. Configure via `config.rateLimit`.
- **Fetch timeout** — 10 seconds, auto-abort via `AbortController`.
- **Error handling** — non-200 responses and network errors return `null` (logged to console).
- **Auth headers** — `config.apiKey` is passed to `getAuthHeaders()`. Override for non-Bearer auth.

Use `this.apiFetch<T>(path, params?)` for all HTTP calls. Never call `fetch()` directly.

## Testing

Run the provider audit to verify your provider works:
```bash
npx tsx scripts/audit-providers.ts
```

This tests `searchEvents()` and `getResult()` for every provider/sport combination and generates a markdown report.

To add your sport to the audit, add a test case in `scripts/audit-providers.ts`:
```typescript
const TEST_CASES = [
  // ... existing
  { sport: "your_sport", searchQuery: "Known Event Name" },
];
```

## Existing Providers Reference

| Provider | File | Sports | Auth | Notes |
|----------|------|--------|------|-------|
| OpenF1 | `openf1.ts` | F1 | None | Official F1 API |
| API-Football | `api-football.ts` | Soccer | `API_FOOTBALL_KEY` | Free tier: 4 req/hr |
| TheSportsDB | `thesportsdb.ts` | Soccer, Golf, Rugby, Tennis, Cricket | None | Free, round-based fixtures |
| ESPN | `espn.ts` | 10 sports | None | Unofficial, broad coverage |
| BallDontLie | `balldontlie.ts` | NBA (+paid: NFL, MLB, NHL) | `BALLDONTLIE_KEY` | Free NBA tier |
| MLBStats | `mlb-stats.ts` | MLB | None | Official MLB stats API |
| TheRacingAPI | `theracing-api.ts` | Horse Racing | `THERACING_API_KEY` | Free tier |
| Foireann | `foireann.ts` | GAA | `FOIREANN_API_KEY` | GAA official, key-gated |
| FixturePool | `fixture-pool.ts` | All | None | DB-curated events |
| Manual | `manual.ts` | All | None | Fallback (no-op search/result) |
