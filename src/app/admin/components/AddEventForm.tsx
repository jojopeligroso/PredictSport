"use client";

import { useState } from "react";
import type { PredictionType } from "@/types/database";
import type { Sport } from "@/lib/sports/types";
import { FixtureBrowser } from "./FixtureBrowser";
import type { NormalizedFixture } from "./FixtureBrowser";

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
  { value: "mlb", label: "MLB" },
  { value: "nfl", label: "NFL" },
  { value: "nba", label: "NBA" },
  { value: "nhl", label: "NHL" },
];

const PREDICTION_TYPES: { value: PredictionType; label: string; description: string }[] = [
  { value: "winner", label: "Winner", description: "Pick the outright winner" },
  { value: "yes_no", label: "Yes / No", description: "Binary outcome (Yes/No, Ireland/UK, etc.)" },
  { value: "top_n", label: "Top N Finish", description: "Pick someone to finish in top N" },
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
      return { n: 5 };
    case "progression":
      return { stages: ["Group Stage", "Round of 16", "Quarter-Final", "Semi-Final", "Final", "Winner"] };
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
          prediction_type_configs: selectedTypes,
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
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header + tab switcher */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Add New Event
        </h4>
        <div className="flex rounded-md border border-zinc-300 text-sm dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setMode("browse")}
            className={`rounded-l-md px-3 py-1.5 transition-colors ${
              mode === "browse"
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Browse Fixtures
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`rounded-r-md px-3 py-1.5 transition-colors ${
              mode === "manual"
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              Select an upcoming fixture to auto-fill the event details.
            </p>
            <FixtureBrowser onSelect={handleFixtureSelect} />
          </div>
        )}

        {/* Manual / Review form */}
        {mode === "manual" && (
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Linked fixture banner */}
            {externalEventId && (
              <div className="mb-4 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm dark:bg-green-900/20">
                <div>
                  <span className="font-medium text-green-800 dark:text-green-300">
                    Linked to fixture
                  </span>
                  {linkedFixtureName && (
                    <span className="ml-1 text-green-700 dark:text-green-400">
                      — {linkedFixtureName}
                    </span>
                  )}
                  <div className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                    ID: {externalEventId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUnlink}
                  className="ml-3 shrink-0 text-xs text-red-500 underline hover:no-underline dark:text-red-400"
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
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              {/* Sport */}
              <div>
                <label
                  htmlFor="event-sport"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Sport *
                </label>
                <select
                  id="event-sport"
                  value={sport}
                  onChange={(e) => setSport(e.target.value as Sport)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
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
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Start Time *
                  </label>
                  <input
                    id="event-start"
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label
                    htmlFor="event-lock"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Lock Time *
                  </label>
                  <input
                    id="event-lock"
                    type="datetime-local"
                    required
                    value={lockTime}
                    onChange={(e) => setLockTime(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Auto-set to {lockDefaultMinutes} min before start. You can
                    adjust.
                  </p>
                </div>
              </div>

              {/* Prediction types */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
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
                          ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                          : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

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
                    className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    {showAdvanced ? "Hide advanced scoring" : "Advanced: override points per type"}
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-700">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
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
                                <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                                  {label}
                                </label>
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-500 dark:text-zinc-400">
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
                                  className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-500 dark:text-zinc-400">
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
                                  className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
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
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {isSubmitting ? "Adding..." : "Add Event"}
              </button>
              <button
                type="button"
                onClick={() => setMode("browse")}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Back to fixtures
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
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
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
        <input
          type="text"
          value={options[1]}
          onChange={(e) => handleOptionChange(1, e.target.value)}
          placeholder="Option 2"
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
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

  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
        Top N — how many positions count?
      </label>
      <input
        type="number"
        min={2}
        max={50}
        value={n}
        onChange={(e) =>
          onChange({
            config: { ...config.config, n: parseInt(e.target.value) || 5 },
          })
        }
        className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
      />
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
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
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
            className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
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
        className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
      />
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        Comma-separated, from earliest exit to winner.
      </p>
    </div>
  );
}
