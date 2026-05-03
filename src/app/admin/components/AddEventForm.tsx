"use client";

import { useState } from "react";
import type { PredictionType } from "@/types/database";
import type { Sport } from "@/lib/sports/types";

interface AddEventFormProps {
  competitionId: string;
  lockDefaultMinutes: number;
  onSuccess: () => void;
  onCancel: () => void;
}

interface SearchResult {
  external_event_id: string;
  event_name: string;
  sport: Sport;
  start_time: string;
  competition_name: string;
  participants: string[];
  provider: string;
}

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventName, setEventName] = useState("");
  const [sport, setSport] = useState<Sport>("soccer");
  const [startTime, setStartTime] = useState("");
  const [lockTime, setLockTime] = useState("");
  const [selectedPredictionTypes, setSelectedPredictionTypes] = useState<PredictionType[]>(["winner"]);
  const [externalEventId, setExternalEventId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    // Auto-calculate lock time
    if (value) {
      const startDate = new Date(value);
      const lockDate = new Date(startDate.getTime() - lockDefaultMinutes * 60 * 1000);
      setLockTime(lockDate.toISOString().slice(0, 16));
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sport,
        q: searchQuery.trim(),
      });
      const res = await fetch(`/api/sports/search?${params}`);
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.events ?? []);
      } else {
        setError(data.error || "Search failed");
      }
    } catch {
      setError("Network error during search");
    } finally {
      setIsSearching(false);
    }
  };

  const handleLinkEvent = (result: SearchResult) => {
    setEventName(result.event_name);
    setSport(result.sport);
    setExternalEventId(result.external_event_id);
    if (result.start_time) {
      const startDate = new Date(result.start_time);
      setStartTime(startDate.toISOString().slice(0, 16));
      const lockDate = new Date(startDate.getTime() - lockDefaultMinutes * 60 * 1000);
      setLockTime(lockDate.toISOString().slice(0, 16));
    }
    setShowSearch(false);
    setSearchResults([]);
    setSearchQuery("");
  };

  const togglePredictionType = (pt: PredictionType) => {
    setSelectedPredictionTypes((prev) =>
      prev.includes(pt) ? prev.filter((t) => t !== pt) : [...prev, pt]
    );
  };

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
          external_event_id: externalEventId || undefined,
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

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
        Add New Event
      </h4>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Link to external event */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {showSearch
            ? "Hide search"
            : externalEventId
              ? "Change linked event"
              : "Search and link to a sports event"}
        </button>

        {externalEventId && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-green-600 dark:text-green-400">
              Linked: {externalEventId}
            </span>
            <button
              type="button"
              onClick={() => setExternalEventId(null)}
              className="text-xs text-red-500 hover:text-red-700 dark:text-red-400"
            >
              Unlink
            </button>
          </div>
        )}

        {showSearch && (
          <div className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for an event..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-white transition-colors hover:bg-zinc-600 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-400"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
                {searchResults.map((result) => (
                  <button
                    key={result.external_event_id}
                    type="button"
                    onClick={() => handleLinkEvent(result)}
                    className="block w-full rounded-md border border-zinc-200 p-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {result.event_name}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {result.competition_name} &middot;{" "}
                      {new Date(result.start_time).toLocaleString()} &middot;{" "}
                      {result.provider}
                    </div>
                    {result.participants.length > 0 && (
                      <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {result.participants.join(" vs ")}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
              Auto-set to {lockDefaultMinutes} min before start. You can adjust.
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
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
