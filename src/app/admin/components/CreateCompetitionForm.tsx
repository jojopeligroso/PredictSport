"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CompetitionType,
  CompetitionVisibility,
} from "@/types/database";

const SCORING_PRESETS: Record<string, { label: string; description: string; rules: Record<string, unknown> }> = {
  classic_quiz: {
    label: "Classic Quiz",
    description: "10pts correct, 20pts dual questions, 10pts partial",
    rules: {
      preset: "classic_quiz",
      points: { winner: 10, top_n: 10, head_to_head: 10, margin: 20, over_under: 10, handicap: 10 },
      partial_credit: true,
      partial_points: { margin: 10, top_n: 5 },
    },
  },
  tournament: {
    label: "Tournament",
    description: "10pts winner, 5pts top 5, 3pts top 10",
    rules: {
      preset: "tournament",
      points: { winner: 10, top_n: 5, head_to_head: 5, margin: 10, over_under: 5, handicap: 5 },
      partial_credit: true,
      partial_points: { top_n: 3, margin: 5 },
    },
  },
  weekly_fixtures: {
    label: "Weekly Fixtures",
    description: "3pts correct result, 1pt correct draw",
    rules: {
      preset: "weekly_fixtures",
      points: { winner: 3, top_n: 3, head_to_head: 3, margin: 5, over_under: 3, handicap: 3 },
      partial_credit: true,
      partial_points: { margin: 1 },
    },
  },
  head_to_head_series: {
    label: "Head to Head Series",
    description: "5pts per correct H2H, bonus for clean sweep",
    rules: {
      preset: "head_to_head_series",
      points: { winner: 5, top_n: 5, head_to_head: 5, margin: 10, over_under: 5, handicap: 5 },
      partial_credit: false,
    },
  },
  custom: {
    label: "Custom",
    description: "Define your own scoring",
    rules: {
      preset: "custom",
      points: { winner: 10, top_n: 5, head_to_head: 5, margin: 10, over_under: 5, handicap: 5 },
      partial_credit: true,
      partial_points: { margin: 5, top_n: 3 },
    },
  },
};

export function CreateCompetitionForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CompetitionType>("open");
  const [visibility, setVisibility] = useState<CompetitionVisibility>("private");
  const [selectedPreset, setSelectedPreset] = useState("classic_quiz");
  const [allowPredictionUpdates, setAllowPredictionUpdates] = useState(true);
  const [minRoundsRequired, setMinRoundsRequired] = useState<string>("");
  const [tiebreakerQuestion, setTiebreakerQuestion] = useState("");

  // Custom scoring state
  const [customPoints, setCustomPoints] = useState<Record<string, number>>({
    winner: 10, top_n: 5, head_to_head: 5, margin: 10, over_under: 5, handicap: 5,
  });
  const [partialCredit, setPartialCredit] = useState(true);
  const [partialPoints, setPartialPoints] = useState<Record<string, number>>({
    margin: 5, top_n: 3,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    let scoringRules: Record<string, unknown>;
    if (selectedPreset === "custom") {
      scoringRules = {
        preset: "custom",
        points: customPoints,
        partial_credit: partialCredit,
        partial_points: partialCredit ? partialPoints : {},
      };
    } else {
      scoringRules = SCORING_PRESETS[selectedPreset].rules;
    }

    try {
      const res = await fetch("/api/admin/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          visibility,
          scoring_rules: scoringRules,
          allow_prediction_updates: allowPredictionUpdates,
          min_rounds_required: minRoundsRequired ? parseInt(minRoundsRequired) : null,
          tiebreaker_question: tiebreakerQuestion.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create competition");
        return;
      }

      // Reset form
      setName("");
      setDescription("");
      setType("open");
      setVisibility("private");
      setSelectedPreset("classic_quiz");
      setTiebreakerQuestion("");
      setIsOpen(false);

      // Navigate to the new competition detail page
      router.push(`/admin/competitions/${data.competition.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Create Competition
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
        New Competition
      </h3>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label
            htmlFor="comp-name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Name *
          </label>
          <input
            id="comp-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wexford FC Prediction League 2026"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="comp-desc"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Description
          </label>
          <textarea
            id="comp-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional description..."
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        {/* Type + Visibility */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="comp-type"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Type *
            </label>
            <select
              id="comp-type"
              value={type}
              onChange={(e) => setType(e.target.value as CompetitionType)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="open">Open / Rolling</option>
              <option value="fixed">Fixed</option>
            </select>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {type === "fixed"
                ? "All events defined at creation"
                : "Events added throughout the competition"}
            </p>
          </div>

          <div>
            <label
              htmlFor="comp-visibility"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Visibility
            </label>
            <select
              id="comp-visibility"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as CompetitionVisibility)
              }
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="private">Private (invite only)</option>
              <option value="public">Public (open join)</option>
            </select>
          </div>
        </div>

        {/* Scoring Preset */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Scoring Template *
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(SCORING_PRESETS).map(([key, preset]) => (
              <label
                key={key}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  selectedPreset === key
                    ? "border-zinc-900 bg-zinc-50 dark:border-zinc-400 dark:bg-zinc-800"
                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="scoring-preset"
                  value={key}
                  checked={selectedPreset === key}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {preset.label}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {preset.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Custom scoring details */}
        {selectedPreset === "custom" && (
          <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-700">
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              Points per Prediction Type
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(customPoints).map(([pType, pts]) => (
                <div key={pType}>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                    {pType.replace(/_/g, " ")}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pts}
                    onChange={(e) =>
                      setCustomPoints((prev) => ({
                        ...prev,
                        [pType]: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={partialCredit}
                  onChange={(e) => setPartialCredit(e.target.checked)}
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Allow partial credit
                </span>
              </label>
            </div>

            {partialCredit && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {Object.entries(partialPoints).map(([pType, pts]) => (
                  <div key={pType}>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                      {pType.replace(/_/g, " ")} (partial)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pts}
                      onChange={(e) =>
                        setPartialPoints((prev) => ({
                          ...prev,
                          [pType]: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Participation rules */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="min-rounds"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Min. Rounds Required
            </label>
            <input
              id="min-rounds"
              type="number"
              min={1}
              value={minRoundsRequired}
              onChange={(e) => setMinRoundsRequired(e.target.value)}
              placeholder="All (leave blank)"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              How many rounds participants must play. Blank = all.
            </p>
          </div>
          <div className="flex items-start pt-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowPredictionUpdates}
                onChange={(e) => setAllowPredictionUpdates(e.target.checked)}
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Allow prediction updates before lock
              </span>
            </label>
          </div>
        </div>

        {/* Tiebreaker */}
        <div>
          <label
            htmlFor="tiebreaker"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Tiebreaker Question
          </label>
          <input
            id="tiebreaker"
            type="text"
            value={tiebreakerQuestion}
            onChange={(e) => setTiebreakerQuestion(e.target.value)}
            placeholder='e.g. "Total goals in the World Cup"'
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Optional. A numeric question used to break ties. Closest to actual value wins.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isSubmitting ? "Creating..." : "Create Competition"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
