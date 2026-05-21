/**
 * Provider Audit Script
 *
 * Tests each sports provider for fixture search and result fetch capability.
 * Run: npx tsx scripts/audit-providers.ts
 *
 * Outputs a markdown report to stdout.
 */

import { getProvidersForSport } from "../src/lib/sports/registry";
import type { Sport, SportsProvider } from "../src/lib/sports/types";

// Representative test cases per sport — a popular league and a known event ID
const TEST_CASES: {
  sport: Sport;
  searchQuery: string;
  knownEventId?: string;
  providerLeague?: string;
}[] = [
  { sport: "soccer", searchQuery: "Premier League" },
  { sport: "formula_1", searchQuery: "Grand Prix" },
  { sport: "rugby", searchQuery: "URC" },
  { sport: "tennis", searchQuery: "Wimbledon" },
  { sport: "golf", searchQuery: "PGA" },
  { sport: "gaa", searchQuery: "All-Ireland" },
  { sport: "cricket", searchQuery: "Test", providerLeague: "cricket/8044" },
  { sport: "basketball", searchQuery: "Lakers" },
  { sport: "american_football", searchQuery: "Super Bowl" },
  { sport: "baseball", searchQuery: "Yankees" },
  { sport: "ice_hockey", searchQuery: "Stanley Cup" },
  { sport: "horse_racing", searchQuery: "Ascot" },
  { sport: "snooker", searchQuery: "World Championship" },
];

interface ProviderResult {
  provider: string;
  sport: Sport;
  searchOk: boolean;
  searchCount: number;
  searchMs: number;
  searchError?: string;
  resultOk?: boolean;
  resultMs?: number;
  resultError?: string;
}

async function testProvider(
  provider: SportsProvider,
  sport: Sport,
  query: string,
  _providerLeague?: string
): Promise<ProviderResult> {
  const result: ProviderResult = {
    provider: provider.name,
    sport,
    searchOk: false,
    searchCount: 0,
    searchMs: 0,
  };

  // Test search
  const searchStart = Date.now();
  try {
    const events = await provider.searchEvents(sport, query, { limit: 5 });
    result.searchMs = Date.now() - searchStart;
    result.searchOk = true;
    result.searchCount = events.length;

    // If we got events, try fetching result for the first one
    if (events.length > 0) {
      const testEvent = events[0];
      const resultStart = Date.now();
      try {
        const fetchedResult = await provider.getResult(
          sport,
          testEvent.external_event_id,
          _providerLeague
        );
        result.resultMs = Date.now() - resultStart;
        result.resultOk = fetchedResult !== null;
      } catch (err) {
        result.resultMs = Date.now() - resultStart;
        result.resultOk = false;
        result.resultError = err instanceof Error ? err.message : String(err);
      }
    }
  } catch (err) {
    result.searchMs = Date.now() - searchStart;
    result.searchOk = false;
    result.searchError = err instanceof Error ? err.message : String(err);
  }

  return result;
}

async function main() {
  const allResults: ProviderResult[] = [];
  const tested = new Set<string>();

  for (const tc of TEST_CASES) {
    const providers = getProvidersForSport(tc.sport);

    for (const provider of providers) {
      // Skip manual and fixture pool — not real APIs
      if (provider.name === "Manual" || provider.name === "FixturePool") continue;

      // Only test each provider once per sport
      const key = `${provider.name}:${tc.sport}`;
      if (tested.has(key)) continue;
      tested.add(key);

      // Skip if provider doesn't support this sport
      if (!provider.supportedSports.includes(tc.sport)) continue;

      process.stderr.write(`Testing ${provider.name} for ${tc.sport}...\n`);

      const result = await testProvider(
        provider,
        tc.sport,
        tc.searchQuery,
        tc.providerLeague
      );
      allResults.push(result);

      // Small delay to be respectful of rate limits
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // ── Generate report ──
  console.log("# Provider Audit Report");
  console.log(`\nGenerated: ${new Date().toISOString()}\n`);

  // Summary table
  console.log("## Summary\n");
  console.log("| Provider | Sport | Search | Results | Latency | Events |");
  console.log("|----------|-------|--------|---------|---------|--------|");

  for (const r of allResults) {
    const searchStatus = r.searchOk ? "OK" : "FAIL";
    const resultStatus = r.resultOk === undefined
      ? "N/A"
      : r.resultOk
        ? "OK"
        : "FAIL";
    const latency = `${r.searchMs}ms${r.resultMs ? ` / ${r.resultMs}ms` : ""}`;
    console.log(
      `| ${r.provider} | ${r.sport} | ${searchStatus} | ${resultStatus} | ${latency} | ${r.searchCount} |`
    );
  }

  // Provider stats
  console.log("\n## Provider Stats\n");

  const byProvider = new Map<string, ProviderResult[]>();
  for (const r of allResults) {
    const list = byProvider.get(r.provider) ?? [];
    list.push(r);
    byProvider.set(r.provider, list);
  }

  for (const [name, results] of byProvider) {
    const searchOk = results.filter((r) => r.searchOk).length;
    const resultOk = results.filter((r) => r.resultOk).length;
    const resultTested = results.filter((r) => r.resultOk !== undefined).length;
    const avgSearchMs = Math.round(
      results.reduce((s, r) => s + r.searchMs, 0) / results.length
    );

    console.log(`### ${name}`);
    console.log(`- Sports tested: ${results.length}`);
    console.log(`- Search success: ${searchOk}/${results.length}`);
    console.log(`- Result fetch: ${resultOk}/${resultTested}`);
    console.log(`- Avg search latency: ${avgSearchMs}ms`);

    const failures = results.filter((r) => !r.searchOk || r.resultOk === false);
    if (failures.length > 0) {
      console.log("- Failures:");
      for (const f of failures) {
        if (!f.searchOk) {
          console.log(`  - ${f.sport} search: ${f.searchError ?? "unknown"}`);
        }
        if (f.resultOk === false) {
          console.log(`  - ${f.sport} result: ${f.resultError ?? "returned null"}`);
        }
      }
    }
    console.log("");
  }

  // Coverage matrix
  console.log("## Coverage Matrix\n");
  const sports = [...new Set(allResults.map((r) => r.sport))];
  const providerNames = [...byProvider.keys()];

  const header = ["Sport", ...providerNames].join(" | ");
  const sep = ["---", ...providerNames.map(() => "---")].join(" | ");
  console.log(`| ${header} |`);
  console.log(`| ${sep} |`);

  for (const sport of sports) {
    const row = [sport];
    for (const pName of providerNames) {
      const r = allResults.find(
        (x) => x.sport === sport && x.provider === pName
      );
      if (!r) {
        row.push("-");
      } else if (r.searchOk && r.resultOk !== false) {
        row.push("OK");
      } else {
        row.push("FAIL");
      }
    }
    console.log(`| ${row.join(" | ")} |`);
  }

  // Exit with error if any critical failures
  const criticalFails = allResults.filter(
    (r) => !r.searchOk && r.provider !== "Foireann"
  );
  if (criticalFails.length > 0) {
    process.stderr.write(
      `\n${criticalFails.length} critical failure(s) detected.\n`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
