"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import {
  DashboardResultCard,
  computeMatchdaySummary,
  computeMovement,
} from "@/components/wc/DashboardResultCard";
import { OnboardingSection } from "@/components/wc/OnboardingFlow";
import type { ResultRow } from "../fetchDashboardData";

interface ResultsSectionProps {
  awaitingResults: number;
  liveMode: boolean;
  visibleResults: ResultRow[];
  windowedResults: ResultRow[];
  streakByExternalId: Map<string, number>;
  canExpandResults: boolean;
  remainingResultsCount: number;
  onExpandResults: () => void;
}

export function ResultsSection({
  awaitingResults,
  liveMode,
  visibleResults,
  windowedResults,
  streakByExternalId,
  canExpandResults,
  remainingResultsCount,
  onExpandResults,
}: ResultsSectionProps) {
  const t = useT();

  return (
    <>
      {/* ── 4c. Results coming soon indicator ──────────────────────── */}
      {awaitingResults > 0 && !liveMode && (
        <section className="mt-5">
          <div className="flex items-center gap-2 rounded-xl border border-ps-amber/30 bg-ps-amber-soft px-4 py-3">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ps-amber opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ps-amber" />
            </span>
            <p className="text-xs font-semibold text-ps-text-sec">
              {t('dash.results_coming_soon', { count: awaitingResults })}
            </p>
          </div>
        </section>
      )}

      {/* ── 5. Latest Results (6AM-anchored window) ─────────────────── */}
      {visibleResults.length > 0 && (
        <OnboardingSection id="other">
          <section className="ps-panel mt-5">
            <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
              <ResultsHeader results={windowedResults} t={t} />
              <div className="mt-3 space-y-0 divide-y divide-ps-border">
                {visibleResults.map((r) => (
                  <DashboardResultCard
                    key={r.fixture.externalId}
                    result={r}
                    movement={computeMovement(r)}
                    streak={streakByExternalId.get(r.fixture.externalId) ?? 0}
                  />
                ))}
              </div>
              {canExpandResults && remainingResultsCount > 0 && (
                <button
                  onClick={onExpandResults}
                  className="mt-3 w-full text-center text-body font-semibold text-ps-amber transition-colors hover:opacity-80"
                >
                  {t('dash.show_more_results', { count: remainingResultsCount })}
                </button>
              )}
              <div className="mt-2 text-center">
                <Link
                  href="/wc?tab=results"
                  className="text-caption font-medium text-ps-text-ter transition-colors hover:text-ps-text-sec"
                >
                  {t('dash.go_to_results')}
                </Link>
              </div>
            </div>
          </section>
        </OnboardingSection>
      )}
    </>
  );
}

/** Results header with title + matchday summary (e.g. "3/4 correct · +18 pts"). */
function ResultsHeader({
  results,
  t,
}: {
  results: ResultRow[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const summary = computeMatchdaySummary(results);

  return (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-bold text-ps-text">
        {t("dash.latest_results")}
      </h3>
      {summary.totalPredicted > 0 ? (
        <span className="text-caption font-semibold tabular-nums text-ps-text-sec">
          <span className="text-ps-green">
            {t("dash.results_correct_count", {
              correct: summary.correctCount,
              total: summary.totalPredicted,
            })}
          </span>
          {" correct \u00B7 "}
          <span className="text-ps-amber">
            {t("dash.results_pts", { points: summary.totalPoints })}
          </span>
        </span>
      ) : (
        <span className="text-caption font-semibold uppercase text-ps-text-ter">
          {t(
            results.length === 1 ? "wc.match" : "wc.matches",
            { count: results.length },
          )}
        </span>
      )}
    </div>
  );
}
