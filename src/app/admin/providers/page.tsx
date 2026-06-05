"use client";

import { useState } from "react";
import type { Sport } from "@/lib/sports/types";

interface HealthResult {
  provider: string;
  sport: Sport;
  status: "ok" | "fail" | "disabled";
  events: number;
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  timestamp: string;
  results: HealthResult[];
}

export default function ProviderHealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/provider-health");
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Group results by provider
  const byProvider = new Map<string, HealthResult[]>();
  if (data) {
    for (const r of data.results) {
      const list = byProvider.get(r.provider) ?? [];
      list.push(r);
      byProvider.set(r.provider, list);
    }
  }

  const statusIcon = (status: string) => {
    if (status === "ok") return "bg-ps-correct";
    if (status === "fail") return "bg-ps-wrong";
    return "bg-ps-text-ter";
  };

  return (
    <div className="mx-auto max-w-[640px] px-4 py-6">
      <h1 className="font-display text-2xl font-extrabold text-ps-text">
        Provider Health
      </h1>
      <p className="mt-1 text-sm text-ps-text-sec">
        Tests each provider&apos;s search capability across all supported sports.
      </p>

      <button
        onClick={runCheck}
        disabled={loading}
        className="mt-4 rounded-xl bg-ps-accent px-4 py-2 text-sm font-semibold text-ps-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Running checks..." : "Run Health Check"}
      </button>

      {error && (
        <div className="mt-4 rounded-xl border border-ps-wrong/30 bg-ps-wrong/10 px-4 py-3 text-sm text-ps-wrong">
          {error}
        </div>
      )}

      {data && (
        <>
          <p className="mt-4 text-xs text-ps-text-ter">
            Last run: {new Date(data.timestamp).toLocaleString()}
          </p>

          {/* Summary stats */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-ps-border bg-ps-card px-3 py-2 text-center">
              <div className="font-mono text-xl font-bold text-ps-correct">
                {data.results.filter((r) => r.status === "ok").length}
              </div>
              <div className="text-xs text-ps-text-ter">Working</div>
            </div>
            <div className="rounded-xl border border-ps-border bg-ps-card px-3 py-2 text-center">
              <div className="font-mono text-xl font-bold text-ps-wrong">
                {data.results.filter((r) => r.status === "fail").length}
              </div>
              <div className="text-xs text-ps-text-ter">Failed</div>
            </div>
            <div className="rounded-xl border border-ps-border bg-ps-card px-3 py-2 text-center">
              <div className="font-mono text-xl font-bold text-ps-text-ter">
                {data.results.filter((r) => r.status === "disabled").length}
              </div>
              <div className="text-xs text-ps-text-ter">Disabled</div>
            </div>
          </div>

          {/* Provider cards */}
          <div className="mt-6 space-y-4">
            {[...byProvider.entries()].map(([name, results]) => {
              const okCount = results.filter((r) => r.status === "ok").length;
              const failCount = results.filter(
                (r) => r.status === "fail"
              ).length;
              const avgLatency = Math.round(
                results.reduce((s, r) => s + r.latencyMs, 0) / results.length
              );

              return (
                <div
                  key={name}
                  className="rounded-xl border border-ps-border bg-ps-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-extrabold text-ps-text">
                      {name}
                    </h2>
                    <span className="font-mono text-xs text-ps-text-ter">
                      {avgLatency}ms avg
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-ps-text-sec">
                    {okCount}/{results.length} sports working
                    {failCount > 0 && (
                      <span className="text-ps-wrong">
                        {" "}
                        ({failCount} failed)
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {results.map((r) => (
                      <div
                        key={`${r.provider}-${r.sport}`}
                        className="flex items-center gap-1.5 rounded-lg border border-ps-border px-2 py-1"
                        title={
                          r.error
                            ? `Error: ${r.error}`
                            : `${r.events} events, ${r.latencyMs}ms`
                        }
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${statusIcon(r.status)}`}
                        />
                        <span className="text-xs text-ps-text-sec">
                          {r.sport.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Failures detail */}
          {data.results.some((r) => r.status === "fail") && (
            <div className="mt-6">
              <h2 className="font-display text-base font-extrabold text-ps-text">
                Failures
              </h2>
              <div className="mt-2 space-y-2">
                {data.results
                  .filter((r) => r.status === "fail")
                  .map((r) => (
                    <div
                      key={`${r.provider}-${r.sport}-fail`}
                      className="rounded-xl border border-ps-wrong/30 bg-ps-wrong/5 px-4 py-3"
                    >
                      <div className="text-sm font-medium text-ps-text">
                        {r.provider} / {r.sport.replace(/_/g, " ")}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-ps-wrong">
                        {r.error ?? "Unknown error"}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
