"use client";

/**
 * Test page for card-based prediction UI (Phase 2)
 *
 * Navigate to /admin/test-cards to try the new card UI
 */

import { useState } from "react";
import { CardBasedConfig, PredictionTypeConfig } from "../components/PredictionCards";

export default function TestCardsPage() {
  const [rugbyConfigs, setRugbyConfigs] = useState<PredictionTypeConfig[]>([]);
  const [f1Configs, setF1Configs] = useState<PredictionTypeConfig[]>([]);

  return (
    <div className="min-h-screen bg-ps-bg p-4">
      <div className="mx-auto max-w-[480px] space-y-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-ps-text">
            Card UI Test
          </h1>
          <p className="mt-2 text-sm text-ps-text-sec">
            Phase 2: Testing card-based prediction configuration
          </p>
        </div>

        {/* Rugby Example */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-ps-text">
            2-Team Fixture (Rugby)
          </h2>
          <CardBasedConfig
            fixture={{
              homeTeam: "Leinster",
              awayTeam: "Munster",
              sport: "rugby",
              name: "Leinster vs Munster",
            }}
            defaultPoints={{
              head_to_head: 10,
              winner: 10,
              margin: 20,
              over_under: 15,
              handicap: 15,
              top_n: 10,
              final_standings: 20,
              progression: 15,
              yes_no: 5,
            }}
            onChange={(configs) => {
              setRugbyConfigs(configs);
              console.log("Rugby configs updated:", configs);
            }}
          />

          {rugbyConfigs.length > 0 && (
            <details className="rounded-lg border border-ps-border bg-ps-surface p-3">
              <summary className="cursor-pointer text-xs font-medium text-ps-text">
                API Output ({rugbyConfigs.length} types)
              </summary>
              <pre className="mt-2 overflow-x-auto text-[10px] text-ps-text-sec">
                {JSON.stringify(rugbyConfigs, null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* F1 Example */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-ps-text">
            Multi-Competitor Fixture (F1)
          </h2>
          <CardBasedConfig
            fixture={{
              sport: "formula_1",
              name: "Monaco Grand Prix",
            }}
            defaultPoints={{
              head_to_head: 10,
              winner: 10,
              margin: 20,
              over_under: 15,
              handicap: 15,
              top_n: 10,
              final_standings: 20,
              progression: 15,
              yes_no: 5,
            }}
            onChange={(configs) => {
              setF1Configs(configs);
              console.log("F1 configs updated:", configs);
            }}
          />

          {f1Configs.length > 0 && (
            <details className="rounded-lg border border-ps-border bg-ps-surface p-3">
              <summary className="cursor-pointer text-xs font-medium text-ps-text">
                API Output ({f1Configs.length} types)
              </summary>
              <pre className="mt-2 overflow-x-auto text-[10px] text-ps-text-sec">
                {JSON.stringify(f1Configs, null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* Instructions */}
        <div className="rounded-lg border border-ps-amber bg-ps-amber-soft p-4">
          <h3 className="font-semibold text-ps-amber-deep">Testing Instructions</h3>
          <ul className="mt-2 space-y-1 text-xs text-ps-text">
            <li>• Rugby fixture shows HEAD-TO-HEAD card with HOME/DRAW/AWAY buttons</li>
            <li>• F1 fixture shows WINNER card</li>
            <li>• Expand "Advanced Scoring" to add Margin/O-U/Handicap (rugby)</li>
            <li>• Expand "Advanced Tournament" to add Top N/Standings/Progression (F1)</li>
            <li>• Expand "Yes/No Question" to add custom questions</li>
            <li>• Check API output below each fixture to see generated configs</li>
          </ul>
        </div>

        <div className="text-center">
          <a
            href="/admin"
            className="inline-block text-sm text-ps-amber-deep underline hover:no-underline"
          >
            ← Back to Admin
          </a>
        </div>
      </div>
    </div>
  );
}
