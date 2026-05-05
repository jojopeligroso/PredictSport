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

const PREDICTION_TYPES: { value: PredictionType; label: string }[] = [
  { value: "winner", label: "Winner" },
  { value: "top_n", label: "Top N Finish" },
  { value: "head_to_head", label: "Head to Head" },
  { value: "margin", label: "Margin of Victory" },
  { value: "over_under", label: "Over / Under" },
  { value: "handicap", label: "Beat the Handicap" },
];

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
  const [selectedPredictionTypes, setSelectedPredictionTypes] = useState<
    PredictionType[]
  >(["winner"]);
  const [externalEventId, setExternalEventId] = useState<string | null>(null);
  const [linkedFixtureName, setLinkedFixtureName] = useState<string | null>(
    null
  );

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
    // Build a display name: prefer "Home vs Away" when both teams known
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

    // Switch to the form view so the admin can review / adjust before saving
    setMode("manual");
    setError(null);
  };

  const handleUnlink = () => {
    setExternalEventId(null);
    setLinkedFixtureName(null);
  };

  // -----------------------------------------------------------------------
  // Prediction type toggle
  // -----------------------------------------------------------------------

  const togglePredictionType = (pt: PredictionType) => {
    setSelectedPredictionTypes((prev) =>
      prev.includes(pt) ? prev.filter((t) => t !== pt) : [...prev, pt]
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

    if (selectedPredictionTypes.length === 0) {
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
          prediction_types: { types: selectedPredictionTypes },
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
        {/* ----------------------------------------------------------------
            Browse Fixtures tab
        ---------------------------------------------------------------- */}
        {mode === "browse" && (
          <div>
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              Select an upcoming fixture to auto-fill the event details.
            </p>
            <FixtureBrowser onSelect={handleFixtureSelect} />
          </div>
        )}

        {/* ----------------------------------------------------------------
            Manual / Review form
        ---------------------------------------------------------------- */}
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
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selectedPredictionTypes.includes(pt.value)
                          ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                          : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>
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
