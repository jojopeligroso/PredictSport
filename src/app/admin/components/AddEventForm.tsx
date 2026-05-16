"use client";

import { useState } from "react";
import type { PredictionType } from "@/types/database";
import type { Sport } from "@/lib/sports/types";
import { FixtureBrowser } from "./FixtureBrowser";
import type { NormalizedFixture } from "./FixtureBrowser";
import { parseWinnerOptions } from "@/lib/parse-options";
import { getRaceEntrants } from "@/lib/race-entrants";

interface AddEventFormProps {
  competitionId: string;
  lockDefaultMinutes: number;
  onSuccess: () => void;
  onCancel: () => void;
}

type EntryMode = "browse" | "manual";

const SPORTS: { value: Sport; label: string }[] = [
  { value: "soccer", label: "Soccer" },
  { value: "formula_1", label: "Formula 1" },
  { value: "golf", label: "Golf" },
  { value: "rugby", label: "Rugby" },
  { value: "tennis", label: "Tennis" },
  { value: "gaa", label: "GAA" },
  { value: "horse_racing", label: "Horse Racing" },
  { value: "snooker", label: "Snooker" },
  { value: "mlb", label: "Baseball" },
  { value: "nfl", label: "American Football" },
  { value: "nba", label: "Basketball" },
  { value: "nhl", label: "Ice Hockey" },
];

const PREDICTION_TYPES: { value: PredictionType; label: string; description: string }[] = [
  { value: "winner", label: "Winner", description: "Pick the outright winner" },
  { value: "yes_no", label: "Yes / No", description: "Binary outcome (Yes/No, Ireland/UK, etc.)" },
  { value: "top_n", label: "Top Finishers", description: "Pick someone to finish in the top positions" },
  { value: "final_standings", label: "Final Standings", description: "Rank multiple competitors in predicted finishing order" },
  { value: "head_to_head", label: "Head to Head", description: "Pick which of two finishes higher" },
  { value: "margin", label: "Margin of Victory", description: "Predict winning margin range" },
  { value: "over_under", label: "Over / Under", description: "Predict above or below a line" },
  { value: "handicap", label: "Beat the Handicap", description: "Predict whether a team covers the spread" },
  { value: "progression", label: "How Far Will They Go?", description: "Predict tournament progression stage" },
];

interface PredictionTypeConfig {
  prediction_type: PredictionType;
  points?: number;
  partial_points?: number;
  config?: Record<string, unknown> | null;
}

function getDefaultConfig(pt: PredictionType): Record<string, unknown> | null {
  switch (pt) {
    case "yes_no":
      return { options: ["Yes", "No"] };
    case "top_n":
      return {
        n: 5,
        points_ladder: [
          { position: 1, points: 10 },
          { position: 2, points: 8 },
          { position: 3, points: 6 },
          { position: 4, points: 4 },
          { position: 5, points: 2 },
        ],
      };
    case "final_standings":
      return {
        positions: 5,
        points_per_correct: 10,
        points_per_included: 3,
      };
    case "progression":
      return { stages: ["Group Stage", "Round of 16", "Quarter-Final", "Semi-Final", "Final", "Winner"] };
    case "over_under":
      return { line: 2.5, stat: "total_goals" };
    case "handicap":
      return { line: -1.5, team: "", options: [] };
    default:
      return null;
  }
}

export function AddEventForm({
  competitionId,
  lockDefaultMinutes,
  onSuccess,
  onCancel,
}: AddEventFormProps) {
  const [mode, setMode] = useState<EntryMode>("browse");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [eventName, setEventName] = useState("");
  const [sport, setSport] = useState<Sport>("soccer");
  const [startTime, setStartTime] = useState("");
  const [lockTime, setLockTime] = useState("");
  const [externalEventId, setExternalEventId] = useState<string | null>(null);
  const [linkedFixtureName, setLinkedFixtureName] = useState<string | null>(null);

  // Prediction type configs
  const [selectedTypes, setSelectedTypes] = useState<PredictionTypeConfig[]>([
    { prediction_type: "winner", config: null },
  ]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const applyLockTime = (startIso: string) => {
    const startDate = new Date(startIso);
    const lockDate = new Date(
      startDate.getTime() - lockDefaultMinutes * 60 * 1000
    );
    setLockTime(lockDate.toISOString().slice(0, 16));
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (value) applyLockTime(value);
  };

  // -----------------------------------------------------------------------
  // Fixture browser selection
  // -----------------------------------------------------------------------

  const handleFixtureSelect = (fixture: NormalizedFixture) => {
    const [home, away] = fixture.participants;
    const name =
      home && away ? `${home} vs ${away}` : fixture.event_name;

    setEventName(name);
    setSport(fixture.sport);
    setExternalEventId(fixture.external_event_id);
    setLinkedFixtureName(fixture.competition_name);

    const startLocal = new Date(fixture.start_time)
      .toISOString()
      .slice(0, 16);
    setStartTime(startLocal);
    applyLockTime(fixture.start_time);

    // Auto-populate winner options from fixture participants
    if (home && away) {
      const winnerOpts = parseWinnerOptions(name, fixture.sport);
      if (winnerOpts.length > 0) {
        setSelectedTypes((prev) =>
          prev.map((t) =>
            t.prediction_type === "winner"
              ? { ...t, config: { ...t.config, options: winnerOpts } }
              : t
          )
        );
      }
    }

    setMode("manual");
    setError(null);
  };

  const handleUnlink = () => {
    setExternalEventId(null);
    setLinkedFixtureName(null);
  };

  // -----------------------------------------------------------------------
  // Prediction type management
  // -----------------------------------------------------------------------

  const isTypeSelected = (pt: PredictionType) =>
    selectedTypes.some((t) => t.prediction_type === pt);

  const togglePredictionType = (pt: PredictionType) => {
    if (isTypeSelected(pt)) {
      setSelectedTypes((prev) =>
        prev.filter((t) => t.prediction_type !== pt)
      );
    } else {
      setSelectedTypes((prev) => [
        ...prev,
        { prediction_type: pt, config: getDefaultConfig(pt) },
      ]);
    }
  };

  const updateTypeConfig = (
    pt: PredictionType,
    updates: Partial<PredictionTypeConfig>
  ) => {
    setSelectedTypes((prev) =>
      prev.map((t) =>
        t.prediction_type === pt ? { ...t, ...updates } : t
      )
    );
  };

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!eventName.trim()) {
      setError("Event name is required");
      setIsSubmitting(false);
      return;
    }

    if (!startTime || !lockTime) {
      setError("Start time and lock time are required");
      setIsSubmitting(false);
      return;
    }

    if (selectedTypes.length === 0) {
      setError("Select at least one prediction type");
      setIsSubmitting(false);
      return;
    }

    // Auto-populate winner options from event name if not already set
    const finalTypes = selectedTypes.map((t) => {
      if (
        t.prediction_type === "winner" &&
        (!(t.config?.options as string[] | undefined)?.length)
      ) {
        const opts = parseWinnerOptions(eventName.trim(), sport);
        if (opts.length > 0) {
          return { ...t, config: { ...t.config, options: opts } };
        }
      }
      return t;
    });

    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: competitionId,
          event_name: eventName.trim(),
          sport,
          start_time: new Date(startTime).toISOString(),
          lock_time: new Date(lockTime).toISOString(),
          prediction_type_configs: finalTypes,
          external_event_id: externalEventId ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create event");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="rounded-2xl border border-ps-border bg-ps-surface">
      {/* Header + tab switcher */}
      <div className="flex items-center justify-between border-b border-ps-border px-5 py-4">
        <h4 className="text-base font-semibold text-ps-text">
          Add New Event
        </h4>
        <div className="flex rounded-xl border border-ps-border text-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("browse")}
            className={`px-3 py-1.5 transition-colors ${
              mode === "browse"
                ? "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#1a1208] font-medium"
                : "text-ps-text-sec hover:bg-ps-chip"
            }`}
          >
            Browse Fixtures
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`px-3 py-1.5 transition-colors ${
              mode === "manual"
                ? "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#1a1208] font-medium"
                : "text-ps-text-sec hover:bg-ps-chip"
            }`}
          >
            Manual Entry
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Browse Fixtures tab */}
        {mode === "browse" && (
          <div>
            <p className="mb-3 text-sm text-ps-text-ter">
              Select an upcoming fixture to auto-fill the event details.
            </p>
            <FixtureBrowser onSelect={handleFixtureSelect} />
          </div>
        )}

        {/* Manual / Review form */}
        {mode === "manual" && (
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="mb-4 rounded-xl bg-ps-red-soft p-3 text-sm text-ps-red">
                {error}
              </div>
            )}

            {/* Linked fixture banner */}
            {externalEventId && (
              <div className="mb-4 flex items-center justify-between rounded-xl bg-ps-green-soft px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-ps-green">
                    Linked to fixture
                  </span>
                  {linkedFixtureName && (
                    <span className="ml-1 text-ps-green">
                      — {linkedFixtureName}
                    </span>
                  )}
                  <div className="text-xs text-ps-green mt-0.5 opacity-80">
                    ID: {externalEventId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUnlink}
                  className="ml-3 shrink-0 text-xs text-ps-red underline hover:no-underline"
                >
                  Unlink
                </button>
              </div>
            )}

            <div className="space-y-4">
              {/* Event name */}
              <div>
                <label
                  htmlFor="event-name"
                  className="block text-sm font-medium text-ps-text-sec"
                >
                  Event Name *
                </label>
                <input
                  id="event-name"
                  type="text"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Liverpool vs Man City"
                  className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                />
              </div>

              {/* Sport */}
              <div>
                <label
                  htmlFor="event-sport"
                  className="block text-sm font-medium text-ps-text-sec"
                >
                  Sport *
                </label>
                <select
                  id="event-sport"
                  value={sport}
                  onChange={(e) => {
                    const newSport = e.target.value as Sport;
                    setSport(newSport);
                    const entrants = getRaceEntrants(newSport);
                    if (entrants.length > 0) {
                      setSelectedTypes((prev) =>
                        prev.map((t) =>
                          t.prediction_type === "winner" &&
                          !(t.config?.options as string[] | undefined)?.length
                            ? { ...t, config: { ...t.config, options: entrants } }
                            : t
                        )
                      );
                    }
                  }}
                  className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                >
                  {SPORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Times */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="event-start"
                    className="block text-sm font-medium text-ps-text-sec"
                  >
                    Start Time *
                  </label>
                  <input
                    id="event-start"
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                  />
                </div>
                <div>
                  <label
                    htmlFor="event-lock"
                    className="block text-sm font-medium text-ps-text-sec"
                  >
                    Lock Time *
                  </label>
                  <input
                    id="event-lock"
                    type="datetime-local"
                    required
                    value={lockTime}
                    onChange={(e) => setLockTime(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                  />
                  <p className="mt-1 text-xs text-ps-text-ter">
                    Auto-set to {lockDefaultMinutes} min before start. You can
                    adjust.
                  </p>
                </div>
              </div>

              {/* Prediction types */}
              <div>
                <label className="block text-sm font-medium text-ps-text-sec mb-2">
                  Prediction Types *
                </label>
                <div className="flex flex-wrap gap-2">
                  {PREDICTION_TYPES.map((pt) => (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => togglePredictionType(pt.value)}
                      title={pt.description}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        isTypeSelected(pt.value)
                          ? "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#1a1208]"
                          : "border border-ps-border text-ps-text-sec hover:bg-ps-chip"
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Winner config (allow_draw toggle) */}
              {isTypeSelected("winner") && (
                <WinnerConfig
                  config={selectedTypes.find((t) => t.prediction_type === "winner")!}
                  onChange={(cfg) => updateTypeConfig("winner", cfg)}
                />
              )}

              {/* Yes/No options config (inline, always shown when yes_no is selected) */}
              {isTypeSelected("yes_no") && (
                <YesNoConfig
                  config={selectedTypes.find((t) => t.prediction_type === "yes_no")!}
                  onChange={(cfg) => updateTypeConfig("yes_no", cfg)}
                />
              )}

              {/* Top N config (inline) */}
              {isTypeSelected("top_n") && (
                <TopNConfig
                  config={selectedTypes.find((t) => t.prediction_type === "top_n")!}
                  onChange={(cfg) => updateTypeConfig("top_n", cfg)}
                />
              )}

              {/* Final Standings config (inline) */}
              {isTypeSelected("final_standings") && (
                <FinalStandingsConfig
                  config={selectedTypes.find((t) => t.prediction_type === "final_standings")!}
                  onChange={(cfg) => updateTypeConfig("final_standings", cfg)}
                />
              )}

              {/* Over/Under config (inline) */}
              {isTypeSelected("over_under") && (
                <OverUnderConfig
                  config={selectedTypes.find((t) => t.prediction_type === "over_under")!}
                  onChange={(cfg) => updateTypeConfig("over_under", cfg)}
                />
              )}

              {/* Handicap config (inline) */}
              {isTypeSelected("handicap") && (
                <HandicapConfig
                  config={selectedTypes.find((t) => t.prediction_type === "handicap")!}
                  onChange={(cfg) => updateTypeConfig("handicap", cfg)}
                  eventName={eventName}
                />
              )}

              {/* Progression stages config (inline) */}
              {isTypeSelected("progression") && (
                <ProgressionConfig
                  config={selectedTypes.find((t) => t.prediction_type === "progression")!}
                  onChange={(cfg) => updateTypeConfig("progression", cfg)}
                />
              )}

              {/* Advanced: per-type points override */}
              {selectedTypes.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs text-ps-text-ter underline hover:text-ps-text"
                  >
                    {showAdvanced ? "Hide advanced scoring" : "Advanced: override points per type"}
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 rounded-xl border border-ps-border p-4">
                      <p className="text-xs text-ps-text-ter mb-3">
                        Override the default points from the competition scoring template.
                      </p>
                      <div className="space-y-3">
                        {selectedTypes.map((ptc) => {
                          const label = PREDICTION_TYPES.find(
                            (p) => p.value === ptc.prediction_type
                          )?.label ?? ptc.prediction_type;

                          return (
                            <div
                              key={ptc.prediction_type}
                              className="grid grid-cols-3 gap-3 items-end"
                            >
                              <div>
                                <label className="block text-xs text-ps-text-ter">
                                  {label}
                                </label>
                              </div>
                              <div>
                                <label className="block text-xs text-ps-text-ter">
                                  Points
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={ptc.points ?? ""}
                                  placeholder="Default"
                                  onChange={(e) =>
                                    updateTypeConfig(ptc.prediction_type, {
                                      points: e.target.value
                                        ? parseInt(e.target.value)
                                        : undefined,
                                    })
                                  }
                                  className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-ps-text-ter">
                                  Partial
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={ptc.partial_points ?? ""}
                                  placeholder="Default"
                                  onChange={(e) =>
                                    updateTypeConfig(ptc.prediction_type, {
                                      partial_points: e.target.value
                                        ? parseInt(e.target.value)
                                        : undefined,
                                    })
                                  }
                                  className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-2 text-sm font-medium text-[#1a1208] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? "Adding..." : "Add Event"}
              </button>
              <button
                type="button"
                onClick={() => setMode("browse")}
                className="rounded-xl border border-ps-border-strong bg-transparent px-4 py-2 text-sm font-medium text-ps-text transition-colors hover:bg-ps-chip"
              >
                Back to fixtures
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-ps-border-strong bg-transparent px-4 py-2 text-sm font-medium text-ps-text transition-colors hover:bg-ps-chip"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Config sub-components
// -----------------------------------------------------------------------

function WinnerConfig({
  config,
  onChange,
}: {
  config: PredictionTypeConfig;
  onChange: (updates: Partial<PredictionTypeConfig>) => void;
}) {
  const allowDraw = (config.config?.allow_draw as boolean) ?? false;
  const options = (config.config?.options as string[] | undefined) ?? [];

  return (
    <div className="rounded-xl border border-ps-border p-3">
      <label className="block text-xs font-medium text-ps-text-ter mb-2">
        Winner Options
      </label>

      {options.length > 0 && (
        <p className="text-xs text-ps-text-ter mb-2">
          Options: {options.join(", ")}
        </p>
      )}

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allowDraw}
          onChange={(e) =>
            onChange({ config: { ...config.config, allow_draw: e.target.checked } })
          }
          className="h-4 w-4 rounded border-ps-border accent-ps-amber"
        />
        <span className="text-sm text-ps-text-sec">Allow Draw as a pick option</span>
      </label>
      <p className="mt-1 text-xs text-ps-text-ter">
        Enable for soccer, GAA, rugby, and other sports where draws are a valid result.
      </p>
    </div>
  );
}

function YesNoConfig({
  config,
  onChange,
}: {
  config: PredictionTypeConfig;
  onChange: (updates: Partial<PredictionTypeConfig>) => void;
}) {
  const options = (config.config?.options as string[]) ?? ["Yes", "No"];

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onChange({ config: { ...config.config, options: newOptions } });
  };

  const presets = [
    { label: "Yes / No", options: ["Yes", "No"] },
    { label: "Ireland / UK", options: ["Ireland", "UK"] },
    { label: "Europe / USA", options: ["Europe", "USA"] },
  ];

  return (
    <div className="rounded-xl border border-ps-border p-3">
      <label className="block text-xs font-medium text-ps-text-ter mb-2">
        Yes/No Options
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() =>
              onChange({ config: { ...config.config, options: preset.options } })
            }
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              options[0] === preset.options[0] && options[1] === preset.options[1]
                ? "bg-ps-chip text-ps-text"
                : "border border-ps-border text-ps-text-sec hover:bg-ps-chip"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={options[0]}
          onChange={(e) => handleOptionChange(0, e.target.value)}
          placeholder="Option 1"
          className="rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
        />
        <input
          type="text"
          value={options[1]}
          onChange={(e) => handleOptionChange(1, e.target.value)}
          placeholder="Option 2"
          className="rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
        />
      </div>
    </div>
  );
}

function TopNConfig({
  config,
  onChange,
}: {
  config: PredictionTypeConfig;
  onChange: (updates: Partial<PredictionTypeConfig>) => void;
}) {
  const n = (config.config?.n as number) ?? 5;
  const ladder = (config.config?.points_ladder as Array<{ position: number; points: number }>) ?? [];
  const options = (config.config?.options as string[] | undefined) ?? [];

  // Build a per-position ladder from 1 to n, filling gaps with 0
  const buildFullLadder = (newN: number, existing: Array<{ position: number; points: number }>) => {
    return Array.from({ length: newN }, (_, i) => {
      const pos = i + 1;
      const match = existing.find((t) => t.position === pos);
      return { position: pos, points: match?.points ?? 0 };
    });
  };

  const handleNChange = (newN: number) => {
    const newLadder = buildFullLadder(newN, ladder);
    onChange({ config: { ...config.config, n: newN, points_ladder: newLadder } });
  };

  const updatePositionPoints = (position: number, points: number) => {
    const newLadder = ladder.map((t) =>
      t.position === position ? { ...t, points } : t
    );
    onChange({ config: { ...config.config, points_ladder: newLadder } });
  };

  // Initialize ladder if empty
  const ensureLadder = () => {
    if (ladder.length === 0) {
      handleNChange(n);
    }
  };

  // Presets generate a full per-position ladder
  const presets = [
    {
      label: "Golf (Top 5)",
      apply: () => onChange({
        config: {
          n: 5,
          points_ladder: [
            { position: 1, points: 10 },
            { position: 2, points: 8 },
            { position: 3, points: 6 },
            { position: 4, points: 4 },
            { position: 5, points: 2 },
          ],
        },
      }),
    },
    {
      label: "Podium Pick (races)",
      apply: () => onChange({
        config: {
          n: 3,
          points_ladder: [
            { position: 1, points: 25 },
            { position: 2, points: 18 },
            { position: 3, points: 15 },
          ],
        },
      }),
    },
    {
      label: "Top 10 (F1 style)",
      apply: () => onChange({
        config: {
          n: 10,
          points_ladder: [
            { position: 1, points: 25 },
            { position: 2, points: 18 },
            { position: 3, points: 15 },
            { position: 4, points: 12 },
            { position: 5, points: 10 },
            { position: 6, points: 8 },
            { position: 7, points: 6 },
            { position: 8, points: 4 },
            { position: 9, points: 2 },
            { position: 10, points: 1 },
          ],
        },
      }),
    },
  ];

  return (
    <div className="rounded-xl border border-ps-border p-3">
      <label className="block text-xs font-medium text-ps-text-ter mb-2">
        Top Finishers — points per finishing position
      </label>

      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={preset.apply}
            className="rounded-full border border-ps-border px-2.5 py-1 text-xs text-ps-text-sec hover:bg-ps-chip transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-ps-text-ter">Positions:</span>
        <input
          type="number"
          min={1}
          max={50}
          value={n}
          onChange={(e) => handleNChange(parseInt(e.target.value) || 5)}
          onFocus={ensureLadder}
          className="w-16 rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
        />
      </div>

      {ladder.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ladder.map((tier) => (
            <div key={tier.position} className="flex items-center gap-1.5">
              <span className="text-xs text-ps-text-ter w-10 text-right tabular-nums">
                {tier.position === 1 ? "1st" : tier.position === 2 ? "2nd" : tier.position === 3 ? "3rd" : `${tier.position}th`}:
              </span>
              <input
                type="number"
                min={0}
                value={tier.points}
                onChange={(e) =>
                  updatePositionPoints(tier.position, parseInt(e.target.value) || 0)
                }
                className="w-14 rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-xs text-ps-text"
              />
              <span className="text-xs text-ps-text-ter">pts</span>
            </div>
          ))}
        </div>
      )}

      {ladder.length === 0 && (
        <button
          type="button"
          onClick={ensureLadder}
          className="text-xs text-ps-text-ter underline hover:text-ps-text"
        >
          Set points per position
        </button>
      )}

      <div className="mt-3 border-t border-ps-border pt-3">
        <label className="block text-xs font-medium text-ps-text-ter mb-1">
          Competitor options (one per line)
        </label>
        <textarea
          value={options.join("\n")}
          onChange={(e) =>
            onChange({
              config: {
                ...config.config,
                options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              },
            })
          }
          placeholder={"Scheffler\nMcIlroy\nRahm\n..."}
          rows={4}
          className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
        />
        <p className="mt-1 text-xs text-ps-text-ter">
          If provided, participants pick from buttons instead of typing names.
        </p>
      </div>
    </div>
  );
}

function ProgressionConfig({
  config,
  onChange,
}: {
  config: PredictionTypeConfig;
  onChange: (updates: Partial<PredictionTypeConfig>) => void;
}) {
  const stages = (config.config?.stages as string[]) ?? [];
  const stagesStr = stages.join(", ");

  const presets = [
    {
      label: "World Cup",
      stages: ["Group Stage", "Round of 16", "Quarter-Final", "Semi-Final", "Final", "Winner"],
    },
    {
      label: "Champions League",
      stages: ["Group Stage", "Round of 16", "Quarter-Final", "Semi-Final", "Final", "Winner"],
    },
    {
      label: "Knockout (4 rounds)",
      stages: ["Quarter-Final", "Semi-Final", "Final", "Winner"],
    },
  ];

  return (
    <div className="rounded-xl border border-ps-border p-3">
      <label className="block text-xs font-medium text-ps-text-ter mb-2">
        Progression Stages (earliest to best)
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() =>
              onChange({ config: { ...config.config, stages: preset.stages } })
            }
            className="rounded-full border border-ps-border px-2.5 py-1 text-xs text-ps-text-sec hover:bg-ps-chip transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={stagesStr}
        onChange={(e) =>
          onChange({
            config: {
              ...config.config,
              stages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            },
          })
        }
        placeholder="Stage 1, Stage 2, Stage 3, ..."
        className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
      />
      <p className="mt-1 text-xs text-ps-text-ter">
        Comma-separated, from earliest exit to winner.
      </p>
    </div>
  );
}

function FinalStandingsConfig({
  config,
  onChange,
}: {
  config: PredictionTypeConfig;
  onChange: (updates: Partial<PredictionTypeConfig>) => void;
}) {
  const positions = (config.config?.positions as number) ?? 5;
  const pointsPerCorrect = (config.config?.points_per_correct as number) ?? 10;
  const pointsPerIncluded = (config.config?.points_per_included as number) ?? 3;
  const options = (config.config?.options as string[] | undefined) ?? [];

  const updateField = (field: string, value: number) => {
    onChange({ config: { ...config.config, [field]: value } });
  };

  const presets = [
    {
      label: "Top 3",
      apply: () => onChange({
        config: { positions: 3, points_per_correct: 10, points_per_included: 3 },
      }),
    },
    {
      label: "Top 5",
      apply: () => onChange({
        config: { positions: 5, points_per_correct: 10, points_per_included: 3 },
      }),
    },
    {
      label: "Top 10",
      apply: () => onChange({
        config: { positions: 10, points_per_correct: 8, points_per_included: 2 },
      }),
    },
  ];

  return (
    <div className="rounded-xl border border-ps-border p-3">
      <label className="block text-xs font-medium text-ps-text-ter mb-2">
        Final Standings — rank competitors in order
      </label>

      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={preset.apply}
            className="rounded-full border border-ps-border px-2.5 py-1 text-xs text-ps-text-sec hover:bg-ps-chip transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <span className="block text-xs text-ps-text-ter mb-1">
            Positions to predict
          </span>
          <input
            type="number"
            min={2}
            max={50}
            value={positions}
            onChange={(e) => updateField("positions", parseInt(e.target.value) || 5)}
            className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
          />
        </div>
        <div>
          <span className="block text-xs text-ps-text-ter mb-1">
            Pts per correct position
          </span>
          <input
            type="number"
            min={0}
            value={pointsPerCorrect}
            onChange={(e) => updateField("points_per_correct", parseInt(e.target.value) || 0)}
            className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
          />
        </div>
        <div>
          <span className="block text-xs text-ps-text-ter mb-1">
            Pts per correct name, wrong position
          </span>
          <input
            type="number"
            min={0}
            value={pointsPerIncluded}
            onChange={(e) => updateField("points_per_included", parseInt(e.target.value) || 0)}
            className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-ps-text-ter">
        Participants rank {positions} competitors in order. They earn {pointsPerCorrect} pts for each
        correctly placed competitor, and {pointsPerIncluded} pts for naming someone who finishes
        in the top {positions} but in the wrong position.
      </p>

      <div className="mt-3 border-t border-ps-border pt-3">
        <label className="block text-xs font-medium text-ps-text-ter mb-1">
          Competitor options (one per line)
        </label>
        <textarea
          value={options.join("\n")}
          onChange={(e) =>
            onChange({
              config: {
                ...config.config,
                options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              },
            })
          }
          placeholder={"Scheffler\nMcIlroy\nRahm\n..."}
          rows={4}
          className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
        />
        <p className="mt-1 text-xs text-ps-text-ter">
          If provided, participants tap to rank from buttons instead of typing names.
        </p>
      </div>
    </div>
  );
}

function OverUnderConfig({
  config,
  onChange,
}: {
  config: PredictionTypeConfig;
  onChange: (updates: Partial<PredictionTypeConfig>) => void;
}) {
  const line = (config.config?.line as number) ?? 2.5;
  const stat = (config.config?.stat as string) ?? "total_goals";

  const updateField = (field: string, value: unknown) => {
    onChange({ config: { ...config.config, [field]: value } });
  };

  const presets = [
    { label: "Goals 2.5", line: 2.5, stat: "total_goals" },
    { label: "Goals 1.5", line: 1.5, stat: "total_goals" },
    { label: "Goals 3.5", line: 3.5, stat: "total_goals" },
    { label: "Points 40.5", line: 40.5, stat: "total_points" },
    { label: "Points 200.5", line: 200.5, stat: "total_points" },
    { label: "Corners 9.5", line: 9.5, stat: "total_corners" },
  ];

  return (
    <div className="rounded-xl border border-ps-border p-3">
      <label className="block text-xs font-medium text-ps-text-ter mb-2">
        Over / Under Line
      </label>

      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() =>
              onChange({ config: { ...config.config, line: preset.line, stat: preset.stat } })
            }
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              line === preset.line && stat === preset.stat
                ? "bg-ps-chip text-ps-text"
                : "border border-ps-border text-ps-text-sec hover:bg-ps-chip"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="block text-xs text-ps-text-ter mb-1">Line</span>
          <input
            type="number"
            step="0.5"
            min={0}
            value={line}
            onChange={(e) => updateField("line", parseFloat(e.target.value) || 0)}
            className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
          />
        </div>
        <div>
          <span className="block text-xs text-ps-text-ter mb-1">Stat</span>
          <select
            value={stat}
            onChange={(e) => updateField("stat", e.target.value)}
            className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
          >
            <option value="total_goals">Total Goals</option>
            <option value="total_points">Total Points</option>
            <option value="total_corners">Total Corners</option>
            <option value="total_cards">Total Cards</option>
            <option value="total_tries">Total Tries</option>
            <option value="total_sets">Total Sets</option>
          </select>
        </div>
      </div>

      <p className="mt-2 text-xs text-ps-text-ter">
        Participants predict whether the {stat.replace("total_", "")} total will
        be over or under {line}.
      </p>
    </div>
  );
}

function HandicapConfig({
  config,
  onChange,
  eventName,
}: {
  config: PredictionTypeConfig;
  onChange: (updates: Partial<PredictionTypeConfig>) => void;
  eventName: string;
}) {
  const line = (config.config?.line as number) ?? -1.5;
  const team = (config.config?.team as string) ?? "";
  const options = (config.config?.options as string[]) ?? [];

  // Try to extract team names from event name (e.g. "Liverpool vs Man City")
  const inferredTeams = eventName
    .split(/\s+vs?\s+/i)
    .map((t) => t.trim())
    .filter(Boolean);

  const availableTeams =
    options.length >= 2 ? options : inferredTeams.length >= 2 ? inferredTeams : [];

  const updateField = (field: string, value: unknown) => {
    onChange({ config: { ...config.config, [field]: value } });
  };

  // Auto-populate options from event name if not set
  const ensureOptions = () => {
    if (options.length < 2 && inferredTeams.length >= 2) {
      onChange({
        config: {
          ...config.config,
          options: inferredTeams,
          team: team || inferredTeams[0],
        },
      });
    }
  };

  const presets = [
    { label: "-1.5", line: -1.5 },
    { label: "-2.5", line: -2.5 },
    { label: "-3.5", line: -3.5 },
    { label: "-6.5", line: -6.5 },
    { label: "-12.5", line: -12.5 },
    { label: "+1.5", line: 1.5 },
  ];

  return (
    <div className="rounded-xl border border-ps-border p-3">
      <label className="block text-xs font-medium text-ps-text-ter mb-2">
        Handicap / Spread
      </label>

      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => updateField("line", preset.line)}
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              line === preset.line
                ? "bg-ps-chip text-ps-text"
                : "border border-ps-border text-ps-text-sec hover:bg-ps-chip"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <span className="block text-xs text-ps-text-ter mb-1">Spread</span>
          <input
            type="number"
            step="0.5"
            value={line}
            onChange={(e) => updateField("line", parseFloat(e.target.value) || 0)}
            className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
          />
        </div>
        <div>
          <span className="block text-xs text-ps-text-ter mb-1">Favoured team</span>
          {availableTeams.length >= 2 ? (
            <select
              value={team}
              onChange={(e) => updateField("team", e.target.value)}
              onFocus={ensureOptions}
              className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
            >
              <option value="">Select team...</option>
              {availableTeams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={team}
              onChange={(e) => updateField("team", e.target.value)}
              placeholder="e.g. Liverpool"
              className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
            />
          )}
        </div>
        <div>
          <span className="block text-xs text-ps-text-ter mb-1">Teams</span>
          <input
            type="text"
            value={availableTeams.join(", ")}
            onChange={(e) =>
              onChange({
                config: {
                  ...config.config,
                  options: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
            placeholder="Team A, Team B"
            className="w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-ps-text-ter">
        {team
          ? `"${team} covers ${line}" — participants predict whether ${team} wins by more than ${Math.abs(line)} ${line > 0 ? "(given a head start)" : ""}.`
          : "Select a favoured team to preview the prediction."}
      </p>
    </div>
  );
}
