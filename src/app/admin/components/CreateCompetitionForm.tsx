"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CompetitionType,
  CompetitionVisibility,
} from "@/types/database";

interface ScoringPreset {
  label: string;
  description: string;
  icon: string;
  rules: Record<string, unknown>;
}

const SCORING_PRESETS: Record<string, ScoringPreset> = {
  classic_quiz: {
    label: "Pub Quiz Style",
    description: "Predict winners and scores. Bonus points if you're close on the score.",
    icon: "Q",
    rules: {
      preset: "classic_quiz",
      points: { winner: 10, top_n: 10, head_to_head: 10, margin: 20, over_under: 10, handicap: 10 },
      partial_credit: true,
      partial_points: { margin: 10, top_n: 5 },
    },
  },
  tournament: {
    label: "Cup / Championship",
    description: "Pick who'll go furthest. Best for cups, championships, and tournaments.",
    icon: "T",
    rules: {
      preset: "tournament",
      points: { winner: 10, top_n: 5, head_to_head: 5, margin: 10, over_under: 5, handicap: 5 },
      partial_credit: true,
      partial_points: { top_n: 3, margin: 5 },
    },
  },
  weekly_fixtures: {
    label: "Weekend Matches",
    description: "Pick results from this week's games. Quick and easy.",
    icon: "W",
    rules: {
      preset: "weekly_fixtures",
      points: { winner: 3, top_n: 3, head_to_head: 3, margin: 5, over_under: 3, handicap: 3 },
      partial_credit: true,
      partial_points: { margin: 1 },
    },
  },
  head_to_head_series: {
    label: "Simple Picks",
    description: "Just pick the winner. Right or wrong, no in-between.",
    icon: "H",
    rules: {
      preset: "head_to_head_series",
      points: { winner: 5, top_n: 5, head_to_head: 5, margin: 10, over_under: 5, handicap: 5 },
      partial_credit: false,
    },
  },
  custom: {
    label: "Custom Rules",
    description: "Set your own points for each type of question.",
    icon: "*",
    rules: {
      preset: "custom",
      points: { winner: 10, top_n: 5, head_to_head: 5, margin: 10, over_under: 5, handicap: 5 },
      partial_credit: true,
      partial_points: { margin: 5, top_n: 3 },
    },
  },
};

interface CreateCompetitionFormProps {
  alwaysOpen?: boolean;
}

export function CreateCompetitionForm({ alwaysOpen = false }: CreateCompetitionFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(alwaysOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CompetitionType>("open");
  const [visibility, setVisibility] = useState<CompetitionVisibility>("private");
  const [selectedPreset, setSelectedPreset] = useState("classic_quiz");
  const [allowPredictionUpdates, setAllowPredictionUpdates] = useState(true);
  const [minRoundsRequired, setMinRoundsRequired] = useState<string>("");
  const [tiebreakerQuestion, setTiebreakerQuestion] = useState("");

  // Custom scoring state
  const FRIENDLY_TYPE_LABELS: Record<string, string> = {
    winner: "Who wins",
    top_n: "Top finishers",
    head_to_head: "Head to head",
    margin: "Winning margin",
    over_under: "Over or under",
    handicap: "With handicap",
  };
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
        setError(data.error || "Something went wrong. Check your connection and try again.");
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
      router.push(alwaysOpen ? `/competitions/${data.competition.id}` : `/admin/competitions/${data.competition.id}`);
      router.refresh();
    } catch {
      setError("Couldn't connect. Check your internet and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen && !alwaysOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-2 text-sm font-medium text-ps-text transition-opacity hover:opacity-90"
      >
        Create Competition
      </button>
    );
  }

  const inputClass =
    "mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2.5 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-ps-border bg-ps-surface p-5 sm:p-6"
    >
      {error && (
        <div className="mb-4 rounded-xl bg-ps-red-soft p-3 text-sm text-ps-red">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {/* Name */}
        <div>
          <label
            htmlFor="comp-name"
            className="block text-sm font-semibold text-ps-text"
          >
            What do you want to call it?
          </label>
          <input
            id="comp-name"
            type="text"
            required
            maxLength={100}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunday Predictions, All-Ireland 2026"
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="comp-desc"
            className="block text-sm font-semibold text-ps-text"
          >
            A short description{" "}
            <span className="font-normal text-ps-text-ter">(optional)</span>
          </label>
          <textarea
            id="comp-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="e.g. Lads from the club picking weekend results"
            className={inputClass}
          />
        </div>

        {/* Scoring style */}
        <div>
          <label className="block text-sm font-semibold text-ps-text mb-2">
            How should scoring work?
          </label>
          <div className="grid gap-2.5">
            {Object.entries(SCORING_PRESETS).map(([key, preset]) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-ps-amber focus-within:ring-offset-1 ${
                  selectedPreset === key
                    ? "border-ps-amber bg-ps-amber-soft"
                    : "border-ps-border hover:border-ps-text-ter"
                }`}
              >
                <input
                  type="radio"
                  name="scoring-preset"
                  value={key}
                  checked={selectedPreset === key}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="sr-only"
                />
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    selectedPreset === key
                      ? "bg-ps-amber-deep text-[#1a1208]"
                      : "bg-ps-chip text-ps-text-sec"
                  }`}
                >
                  {preset.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ps-text">
                    {preset.label}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-ps-text-ter">
                    {preset.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Custom scoring details */}
        {selectedPreset === "custom" && (
          <div className="rounded-xl border border-ps-border p-4">
            <h4 className="text-sm font-semibold text-ps-text mb-3">
              Points for each question type
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(customPoints).map(([pType, pts]) => (
                <div key={pType}>
                  <label className="block text-xs text-ps-text-sec">
                    {FRIENDLY_TYPE_LABELS[pType] ?? pType}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={pts}
                    onChange={(e) =>
                      setCustomPoints((prev) => ({
                        ...prev,
                        [pType]: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2.5 text-sm text-ps-text"
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
                  className="h-5 w-5 rounded border-ps-border text-ps-amber focus:ring-ps-amber"
                />
                <span className="text-sm text-ps-text-sec">
                  Give some points for close answers
                </span>
              </label>
            </div>

            {partialCredit && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {Object.entries(partialPoints).map(([pType, pts]) => (
                  <div key={pType}>
                    <label className="block text-xs text-ps-text-sec">
                      {FRIENDLY_TYPE_LABELS[pType] ?? pType} (close answer)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={pts}
                      onChange={(e) =>
                        setPartialPoints((prev) => ({
                          ...prev,
                          [pType]: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2.5 text-sm text-ps-text"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* More options toggle */}
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="flex items-center gap-1.5 text-sm font-medium text-ps-text-sec hover:text-ps-text transition-colors"
        >
          <svg
            className={`h-4 w-4 transition-transform ${showMore ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          More options{" "}
          <span className="font-normal text-ps-text-ter">(all optional)</span>
        </button>

        {showMore && (
          <div className="space-y-4 rounded-xl border border-ps-border bg-ps-bg/50 p-4">
            {/* Who can join */}
            <div>
              <label
                htmlFor="comp-visibility"
                className="block text-sm font-semibold text-ps-text"
              >
                Who can join?
              </label>
              <select
                id="comp-visibility"
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as CompetitionVisibility)
                }
                className={inputClass}
              >
                <option value="private">Only people I invite</option>
                <option value="public">Anyone can join</option>
              </select>
            </div>

            {/* How matches are added */}
            <div>
              <label
                htmlFor="comp-type"
                className="block text-sm font-semibold text-ps-text"
              >
                How will you add matches?
              </label>
              <select
                id="comp-type"
                value={type}
                onChange={(e) => setType(e.target.value as CompetitionType)}
                className={inputClass}
              >
                <option value="open">Add them as I go, week by week</option>
                <option value="fixed">Set them all up at the start</option>
              </select>
              <p className="mt-1 text-xs text-ps-text-ter">
                {type === "fixed"
                  ? "You'll add all the matches before anyone starts predicting."
                  : "You can keep adding new rounds of matches throughout."}
              </p>
            </div>

            {/* Can people change their picks? */}
            <div>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={allowPredictionUpdates}
                  onChange={(e) => setAllowPredictionUpdates(e.target.checked)}
                  className="h-5 w-5 rounded border-ps-border text-ps-amber focus:ring-ps-amber"
                />
                <span className="text-sm text-ps-text">
                  Let people change their picks before the deadline
                </span>
              </label>
            </div>

            {/* Min rounds */}
            <div>
              <label
                htmlFor="min-rounds"
                className="block text-sm font-semibold text-ps-text"
              >
                How many weeks can someone miss?{" "}
                <span className="font-normal text-ps-text-ter">(optional)</span>
              </label>
              <input
                id="min-rounds"
                type="number"
                min={1}
                value={minRoundsRequired}
                onChange={(e) => setMinRoundsRequired(e.target.value)}
                placeholder="Leave blank for no limit"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ps-text-ter">
                Set a number if it&apos;s OK to miss some weeks. Leave blank if everyone must play every week.
              </p>
            </div>

            {/* Tiebreaker */}
            <div>
              <label
                htmlFor="tiebreaker"
                className="block text-sm font-semibold text-ps-text"
              >
                Tiebreaker question{" "}
                <span className="font-normal text-ps-text-ter">(optional)</span>
              </label>
              <input
                id="tiebreaker"
                type="text"
                value={tiebreakerQuestion}
                onChange={(e) => setTiebreakerQuestion(e.target.value)}
                placeholder='e.g. "How many goals in the tournament?"'
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ps-text-ter">
                If two people end up on the same score, whoever guessed closest to this number wins.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-5 py-3 text-sm font-semibold text-ps-text transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Setting things up..." : "Create Competition"}
        </button>
        {!alwaysOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full sm:w-auto rounded-xl border border-ps-border-strong bg-transparent px-4 py-3 text-sm font-medium text-ps-text transition-colors hover:bg-ps-chip"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
