"use client";

// Usage example:
// <ManualEventWizard
//   competitionId="abc-123"
//   lockDefaultMinutes={30}
//   onSuccess={() => router.refresh()}
//   onCancel={() => setShowWizard(false)}
// />

import { useState, useEffect, useRef, useCallback } from "react";
import type { PredictionType } from "@/types/database";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ManualEventWizardProps {
  competitionId: string;
  roundId?: string;
  lockDefaultMinutes: number;
  onSuccess: () => void;
  onCancel: () => void;
}

interface SelectedPredictionType {
  type: PredictionType;
  points: number;
}

// Minimal EventTemplate shape mirroring src/lib/manual-event-templates.ts
// We import the values but define the type locally to avoid a hard dep failure
// if the file doesn't exist at compile time.
interface EventTemplate {
  id: string;
  sport: string;
  name: string;
  description: string;
  participantCount: 2 | "multi";
  defaultPredictionTypes: PredictionType[];
  allowDraw: boolean;
  defaultConfig?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const SPORTS_LIST = [
  { value: "gaa", label: "GAA" },
  { value: "soccer", label: "Soccer" },
  { value: "rugby", label: "Rugby" },
  { value: "rugby_league", label: "Rugby League" },
  { value: "cricket", label: "Cricket" },
  { value: "snooker", label: "Snooker" },
  { value: "tennis", label: "Tennis" },
  { value: "golf", label: "Golf" },
  { value: "formula_1", label: "Formula 1" },
  { value: "horse_racing", label: "Horse Racing" },
  { value: "athletics", label: "Athletics" },
  { value: "american_football", label: "Am. Football" },
  { value: "basketball", label: "Basketball" },
  { value: "ice_hockey", label: "Ice Hockey" },
  { value: "baseball", label: "Baseball" },
];

const TYPE_DESCRIPTIONS: Record<string, string> = {
  head_to_head: "Pick who wins",
  winner: "Pick the outright winner",
  margin: "Predict winning margin range",
  over_under: "Over or under a points/goals line",
  handicap: "Cover the spread",
  yes_no: "Binary outcome question",
  top_n: "Pick top finishers",
  final_standings: "Rank competitors in order",
  progression: "How far will they go?",
};

// Prediction types available per participant count
const TWO_TEAM_TYPES: PredictionType[] = [
  "head_to_head",
  "margin",
  "over_under",
  "handicap",
  "yes_no",
];

const MULTI_TYPES: PredictionType[] = [
  "winner",
  "top_n",
  "final_standings",
  "yes_no",
];

// Fallback templates for sports without a templates file
const FALLBACK_TEMPLATES: EventTemplate[] = [
  {
    id: "gaa-match",
    sport: "gaa",
    name: "GAA Match",
    description: "County or club match (football or hurling). Two teams, draw possible.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "margin"],
    allowDraw: false,
  },
  {
    id: "soccer-match",
    sport: "soccer",
    name: "Soccer Match",
    description: "Standard 90-minute football match. Draw is possible.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "over_under"],
    allowDraw: true,
  },
  {
    id: "rugby-match",
    sport: "rugby",
    name: "Rugby Match",
    description: "Union or league match. Handicap and margin popular.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "handicap", "margin"],
    allowDraw: false,
  },
  {
    id: "rugby-league-match",
    sport: "rugby_league",
    name: "Rugby League Match",
    description: "League match — no draw in regular time.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "handicap"],
    allowDraw: false,
  },
  {
    id: "snooker-match",
    sport: "snooker",
    name: "Snooker Match",
    description: "Frame-based matchplay. No draw.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head"],
    allowDraw: false,
  },
  {
    id: "tennis-match",
    sport: "tennis",
    name: "Tennis Match",
    description: "Singles or doubles match. No draw.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head"],
    allowDraw: false,
  },
  {
    id: "cricket-match",
    sport: "cricket",
    name: "Cricket Match",
    description: "T20, ODI, or Test match. Draw possible in Tests.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "yes_no"],
    allowDraw: true,
  },
  {
    id: "golf-tournament",
    sport: "golf",
    name: "Golf Tournament",
    description: "Multi-competitor tournament. Pick winners and top finishers.",
    participantCount: "multi",
    defaultPredictionTypes: ["winner", "top_n"],
    allowDraw: false,
  },
  {
    id: "formula-1-race",
    sport: "formula_1",
    name: "Formula 1 Race",
    description: "Grand Prix race. Pick the winner, podium, and fastest lap.",
    participantCount: "multi",
    defaultPredictionTypes: ["winner", "top_n"],
    allowDraw: false,
  },
  {
    id: "horse-racing",
    sport: "horse_racing",
    name: "Horse Race",
    description: "Race meeting. Pick the winner or top finishers.",
    participantCount: "multi",
    defaultPredictionTypes: ["winner", "top_n"],
    allowDraw: false,
  },
  {
    id: "athletics-event",
    sport: "athletics",
    name: "Athletics Event",
    description: "Track or field event. Pick the winner.",
    participantCount: "multi",
    defaultPredictionTypes: ["winner", "top_n"],
    allowDraw: false,
  },
  {
    id: "nfl-match",
    sport: "american_football",
    name: "NFL Game",
    description: "American football game. Handicap and margin popular.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "handicap", "over_under"],
    allowDraw: false,
  },
  {
    id: "nba-match",
    sport: "basketball",
    name: "NBA Game",
    description: "Basketball game. No draw.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "handicap", "over_under"],
    allowDraw: false,
  },
  {
    id: "nhl-match",
    sport: "ice_hockey",
    name: "NHL Game",
    description: "Ice hockey game. Possible OT/shootout winner.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "over_under"],
    allowDraw: false,
  },
  {
    id: "mlb-match",
    sport: "baseball",
    name: "MLB Game",
    description: "Baseball game. Run line (handicap) popular.",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "handicap", "over_under"],
    allowDraw: false,
  },
];

function getTemplateForSport(sport: string): EventTemplate | undefined {
  return FALLBACK_TEMPLATES.find((t) => t.sport === sport);
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function fetchSuggestions(q: string): Promise<string[]> {
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `/api/admin/team-suggestions?q=${encodeURIComponent(q)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.suggestions as string[]) ?? [];
  } catch {
    return [];
  }
}

function buildEventName(
  sport: string,
  homeTeam: string,
  awayTeam: string,
  competitors: string,
  template: EventTemplate | undefined,
  startDate: string
): string {
  const isTwoTeam = template?.participantCount === 2 || (!template && homeTeam);
  if (isTwoTeam && homeTeam && awayTeam) {
    return `${homeTeam} vs ${awayTeam}`;
  }
  if (isTwoTeam && homeTeam) {
    return homeTeam;
  }
  const sportLabel =
    SPORTS_LIST.find((s) => s.value === sport)?.label ?? sport;
  if (competitors.trim()) {
    const firstLine = competitors.trim().split("\n")[0];
    return `${sportLabel} — ${firstLine}`;
  }
  if (startDate) {
    return `${sportLabel} — ${startDate}`;
  }
  return sportLabel;
}

function computeLockTime(
  startDate: string,
  startTime: string,
  lockDefaultMinutes: number
): string {
  if (!startDate || !startTime) return "";
  const startMs = new Date(`${startDate}T${startTime}`).getTime();
  const lockMs = startMs - lockDefaultMinutes * 60 * 1000;
  return new Date(lockMs).toTimeString().slice(0, 5); // HH:MM
}

function formatTimeForDisplay(date: string, time: string): string {
  if (!date || !time) return "—";
  try {
    const dt = new Date(`${date}T${time}`);
    return dt.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return `${date} ${time}`;
  }
}

// ----------------------------------------------------------------------------
// Step indicator
// ----------------------------------------------------------------------------

function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-1 mb-5" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total} aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#1a1208]"
                  : isDone
                  ? "bg-ps-amber-soft text-ps-amber-deep"
                  : "border border-ps-border bg-ps-chip text-ps-text-ter"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              {isDone ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                step
              )}
            </div>
            {step < total && (
              <div
                className={`h-px w-6 ${isDone ? "bg-ps-amber" : "bg-ps-border"}`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Autocomplete input
// ----------------------------------------------------------------------------

function AutocompleteInput({
  id,
  label,
  value,
  onChange,
  suggestions,
  onSelect,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  onSelect: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-ps-text-sec mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={`${id}-suggestions`}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute z-20 mt-1 w-full rounded-xl border border-ps-border bg-ps-surface shadow-lg max-h-48 overflow-y-auto"
        >
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={value === s}
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-ps-text hover:bg-ps-chip transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main wizard
// ----------------------------------------------------------------------------

export function ManualEventWizard({
  competitionId,
  roundId,
  lockDefaultMinutes,
  onSuccess,
  onCancel,
}: ManualEventWizardProps) {
  // Step
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [showCustomSport, setShowCustomSport] = useState(false);
  const [customSport, setCustomSport] = useState("");

  // Step 2
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [customName, setCustomName] = useState("");
  const [useCustomName, setUseCustomName] = useState(false);
  const [teamSuggestions, setTeamSuggestions] = useState<{
    home: string[];
    away: string[];
  }>({ home: [], away: [] });

  // Step 3
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("15:00");
  const [lockTimeOverride, setLockTimeOverride] = useState<string | null>(null);
  const [showLockOverride, setShowLockOverride] = useState(false);

  // Step 4
  const [selectedTypes, setSelectedTypes] = useState<SelectedPredictionType[]>(
    []
  );

  // Step 5
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived
  const template = selectedSport
    ? getTemplateForSport(selectedSport)
    : undefined;

  const isMulti = template?.participantCount === "multi";
  const isTwoTeam = !isMulti;

  const autoName = buildEventName(
    selectedSport,
    homeTeam,
    awayTeam,
    competitors,
    template,
    startDate
  );
  const finalEventName = useCustomName && customName.trim()
    ? customName.trim()
    : autoName;

  const computedLockTime = computeLockTime(
    startDate,
    startTime,
    lockDefaultMinutes
  );
  const effectiveLockTime = lockTimeOverride ?? computedLockTime;

  const availableTypes = isMulti ? MULTI_TYPES : TWO_TEAM_TYPES;

  // Initialise prediction types when sport/template changes
  useEffect(() => {
    if (!selectedSport) return;
    const defaults = template?.defaultPredictionTypes ?? (isMulti ? ["winner"] : ["head_to_head"]);
    setSelectedTypes(
      (defaults as PredictionType[]).map((t) => ({ type: t, points: 10 }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSport]);

  // Autocomplete debounce — home team
  const homeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (homeDebounce.current) clearTimeout(homeDebounce.current);
    homeDebounce.current = setTimeout(async () => {
      const results = await fetchSuggestions(homeTeam);
      setTeamSuggestions((prev) => ({ ...prev, home: results }));
    }, 300);
    return () => {
      if (homeDebounce.current) clearTimeout(homeDebounce.current);
    };
  }, [homeTeam]);

  // Autocomplete debounce — away team
  const awayDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (awayDebounce.current) clearTimeout(awayDebounce.current);
    awayDebounce.current = setTimeout(async () => {
      const results = await fetchSuggestions(awayTeam);
      setTeamSuggestions((prev) => ({ ...prev, away: results }));
    }, 300);
    return () => {
      if (awayDebounce.current) clearTimeout(awayDebounce.current);
    };
  }, [awayTeam]);

  // Toggle prediction type
  const toggleType = useCallback(
    (pt: PredictionType) => {
      setSelectedTypes((prev) => {
        const exists = prev.some((t) => t.type === pt);
        if (exists) return prev.filter((t) => t.type !== pt);
        return [...prev, { type: pt, points: 10 }];
      });
    },
    []
  );

  const updatePoints = useCallback((pt: PredictionType, points: number) => {
    setSelectedTypes((prev) =>
      prev.map((t) => (t.type === pt ? { ...t, points } : t))
    );
  }, []);

  // Navigation guards
  const canGoNext: Record<number, boolean> = {
    1: !!selectedSport,
    2: isMulti ? true : !!(homeTeam.trim() && awayTeam.trim()),
    3: !!(startDate && startTime),
    4: selectedTypes.length > 0,
    5: false,
  };

  function goNext() {
    if (canGoNext[step]) setStep((s) => (s + 1) as typeof step);
  }

  function goBack() {
    setStep((s) => (s - 1) as typeof step);
  }

  // Submit
  async function handleCreate() {
    setIsSubmitting(true);
    setError(null);

    try {
      const startISO = new Date(`${startDate}T${startTime}`).toISOString();
      const lockDate = lockTimeOverride
        ? new Date(`${startDate}T${lockTimeOverride}`)
        : new Date(
            new Date(`${startDate}T${startTime}`).getTime() -
              lockDefaultMinutes * 60 * 1000
          );
      const lockISO = lockDate.toISOString();

      const predictionTypeConfigs = selectedTypes.map(({ type, points }) => {
        let config: Record<string, unknown> | null = null;

        if (type === "head_to_head") {
          config = {
            options: [homeTeam.trim(), awayTeam.trim()],
            allow_draw: template?.allowDraw ?? false,
          };
        } else if (type === "yes_no") {
          config = { options: ["Yes", "No"] };
        } else if (type === "winner" && isMulti && competitors.trim()) {
          const competitorList = competitors
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          if (competitorList.length > 0) {
            config = { options: competitorList };
          }
        }

        return {
          prediction_type: type,
          points,
          config,
        };
      });

      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: competitionId,
          round_id: roundId ?? undefined,
          event_name: finalEventName,
          sport: selectedSport,
          start_time: startISO,
          lock_time: lockISO,
          prediction_type_configs: predictionTypeConfigs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create event");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ----------------------------------------------------------------------------
  // Render steps
  // ----------------------------------------------------------------------------

  return (
    <div className="rounded-2xl border border-ps-border bg-ps-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ps-border px-5 py-4">
        <h4 className="text-base font-semibold text-ps-text">
          Create Manual Event
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-ps-text-ter hover:text-ps-text transition-colors"
          aria-label="Cancel and close wizard"
        >
          Cancel
        </button>
      </div>

      <div className="p-5">
        <StepIndicator current={step} total={5} />

        {/* ------------------------------------------------------------------ */}
        {/* Step 1: Sport & Template                                             */}
        {/* ------------------------------------------------------------------ */}
        {step === 1 && (
          <div>
            <h5 className="mb-1 text-sm font-semibold text-ps-text">
              Choose a sport
            </h5>
            <p className="mb-4 text-xs text-ps-text-ter">
              Select the sport to pre-load sensible defaults.
            </p>

            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Sport selection"
            >
              {SPORTS_LIST.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSelectedSport(s.value)}
                  aria-pressed={selectedSport === s.value}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedSport === s.value
                      ? "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#1a1208]"
                      : "border border-ps-border text-ps-text-sec hover:bg-ps-chip"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {selectedSport && template && (
              <div className="mt-4 rounded-xl border border-ps-border bg-ps-bg px-4 py-3">
                <p className="text-xs font-semibold text-ps-amber-deep mb-1">
                  {template.name}
                </p>
                <p className="text-xs text-ps-text-ter">{template.description}</p>
                <p className="mt-2 text-xs text-ps-text-ter">
                  Defaults:{" "}
                  <span className="text-ps-text-sec">
                    {template.defaultPredictionTypes.join(", ")}
                  </span>
                </p>
              </div>
            )}

            {selectedSport && !template && (
              <div className="mt-4 rounded-xl border border-ps-border bg-ps-bg px-4 py-3">
                <p className="text-xs text-ps-text-ter">
                  No template for this sport — you will configure everything manually.
                </p>
              </div>
            )}

            {/* Custom / niche sport */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowCustomSport((v) => !v)}
                className="text-xs text-ps-text-ter underline hover:text-ps-text transition-colors"
              >
                {showCustomSport ? "Hide" : "Sport not listed? Enter it manually"}
              </button>
              {showCustomSport && (
                <input
                  type="text"
                  value={customSport}
                  onChange={(e) => {
                    setCustomSport(e.target.value);
                    setSelectedSport(e.target.value.trim().toLowerCase().replace(/\s+/g, "_"));
                  }}
                  placeholder="e.g. darts, cycling, sumo..."
                  className="mt-2 block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                  aria-label="Custom sport name"
                />
              )}
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Step 2: Participants                                                 */}
        {/* ------------------------------------------------------------------ */}
        {step === 2 && (
          <div>
            <h5 className="mb-1 text-sm font-semibold text-ps-text">
              Participants
            </h5>
            <p className="mb-4 text-xs text-ps-text-ter">
              {isTwoTeam
                ? "Enter the two teams or competitors."
                : "Enter all competitors, one per line."}
            </p>

            {isTwoTeam ? (
              <div className="space-y-4">
                <AutocompleteInput
                  id="home-team"
                  label="Home / Team A"
                  value={homeTeam}
                  onChange={setHomeTeam}
                  suggestions={teamSuggestions.home}
                  onSelect={setHomeTeam}
                  placeholder="e.g. Dublin"
                />
                <AutocompleteInput
                  id="away-team"
                  label="Away / Team B"
                  value={awayTeam}
                  onChange={setAwayTeam}
                  suggestions={teamSuggestions.away}
                  onSelect={setAwayTeam}
                  placeholder="e.g. Kerry"
                />
              </div>
            ) : (
              <div>
                <label
                  htmlFor="competitors"
                  className="block text-sm font-medium text-ps-text-sec mb-1"
                >
                  Competitors
                </label>
                <textarea
                  id="competitors"
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                  rows={6}
                  placeholder={"Scheffler\nMcIlroy\nRahm\nFleetwood\n..."}
                  className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                />
                <p className="mt-1 text-xs text-ps-text-ter">
                  One competitor per line. Used to populate prediction options.
                </p>
              </div>
            )}

            {/* Event name preview */}
            <div className="mt-5 rounded-xl border border-ps-border bg-ps-bg px-4 py-3">
              <p className="text-xs text-ps-text-ter mb-1">Event name preview</p>
              <p className="text-sm font-medium text-ps-text">{autoName || "—"}</p>
            </div>

            {/* Custom name override */}
            <div className="mt-3 flex items-start gap-2">
              <input
                id="use-custom-name"
                type="checkbox"
                checked={useCustomName}
                onChange={(e) => setUseCustomName(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ps-border accent-ps-amber"
              />
              <label
                htmlFor="use-custom-name"
                className="text-xs text-ps-text-sec cursor-pointer select-none"
              >
                Use a custom event name
              </label>
            </div>

            {useCustomName && (
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Custom event name..."
                className="mt-2 block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                aria-label="Custom event name"
              />
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Step 3: Date & Time                                                  */}
        {/* ------------------------------------------------------------------ */}
        {step === 3 && (
          <div>
            <h5 className="mb-1 text-sm font-semibold text-ps-text">
              Date &amp; Time
            </h5>
            <p className="mb-4 text-xs text-ps-text-ter">
              Times are in your local time zone.
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="start-date"
                  className="block text-sm font-medium text-ps-text-sec mb-1"
                >
                  Start date
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                />
              </div>

              <div>
                <label
                  htmlFor="start-time"
                  className="block text-sm font-medium text-ps-text-sec mb-1"
                >
                  Start time
                </label>
                <input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    // Reset lock override when start changes
                    setLockTimeOverride(null);
                  }}
                  className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text shadow-sm focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                />
              </div>

              {/* Lock time preview */}
              <div className="rounded-xl border border-ps-border bg-ps-bg px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-ps-text-ter">Lock time</p>
                    <p className="text-sm font-medium text-ps-text">
                      {startDate && startTime
                        ? formatTimeForDisplay(
                            startDate,
                            effectiveLockTime || computedLockTime
                          )
                        : "—"}
                    </p>
                    {!lockTimeOverride && (
                      <p className="mt-0.5 text-xs text-ps-text-ter">
                        Auto: {lockDefaultMinutes} min before start
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLockOverride((v) => !v);
                      if (!showLockOverride && !lockTimeOverride) {
                        setLockTimeOverride(computedLockTime);
                      }
                    }}
                    className="text-xs text-ps-text-ter underline hover:text-ps-text transition-colors"
                  >
                    {showLockOverride ? "Hide" : "Adjust"}
                  </button>
                </div>

                {showLockOverride && (
                  <div className="mt-3 border-t border-ps-border pt-3">
                    <label
                      htmlFor="lock-time-override"
                      className="block text-xs text-ps-text-ter mb-1"
                    >
                      Custom lock time (same day)
                    </label>
                    <input
                      id="lock-time-override"
                      type="time"
                      value={lockTimeOverride ?? computedLockTime}
                      onChange={(e) => setLockTimeOverride(e.target.value)}
                      className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-1.5 text-sm text-ps-text focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLockTimeOverride(null);
                        setShowLockOverride(false);
                      }}
                      className="mt-1.5 text-xs text-ps-text-ter underline hover:text-ps-text transition-colors"
                    >
                      Reset to auto
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Step 4: Prediction Types                                             */}
        {/* ------------------------------------------------------------------ */}
        {step === 4 && (
          <div>
            <h5 className="mb-1 text-sm font-semibold text-ps-text">
              Prediction types
            </h5>
            <p className="mb-4 text-xs text-ps-text-ter">
              Select which predictions participants will make. Points can be
              adjusted per type.
            </p>

            <div className="space-y-2" role="group" aria-label="Prediction type selection">
              {availableTypes.map((pt) => {
                const entry = selectedTypes.find((t) => t.type === pt);
                const isSelected = !!entry;
                return (
                  <div
                    key={pt}
                    className={`rounded-xl border px-4 py-3 transition-colors ${
                      isSelected
                        ? "border-ps-amber bg-ps-amber-soft"
                        : "border-ps-border bg-ps-bg"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        id={`pt-${pt}`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleType(pt)}
                        className="mt-0.5 h-4 w-4 rounded border-ps-border accent-ps-amber"
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`pt-${pt}`}
                          className="block text-sm font-medium text-ps-text cursor-pointer select-none"
                        >
                          {pt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </label>
                        <p className="text-xs text-ps-text-ter mt-0.5">
                          {TYPE_DESCRIPTIONS[pt] ?? ""}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={entry.points}
                            onChange={(e) =>
                              updatePoints(pt, parseInt(e.target.value) || 0)
                            }
                            aria-label={`Points for ${pt}`}
                            className="w-14 rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                          />
                          <span className="text-xs text-ps-text-ter">pts</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedTypes.length === 0 && (
              <div className="mt-3 rounded-xl bg-ps-red-soft px-4 py-3">
                <p className="text-xs text-ps-red">
                  Select at least one prediction type to continue.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Step 5: Review & Create                                              */}
        {/* ------------------------------------------------------------------ */}
        {step === 5 && (
          <div>
            <h5 className="mb-1 text-sm font-semibold text-ps-text">
              Review &amp; create
            </h5>
            <p className="mb-4 text-xs text-ps-text-ter">
              Check the details below, then create the event.
            </p>

            <div className="rounded-xl border border-ps-border bg-ps-bg divide-y divide-ps-border overflow-hidden">
              <ReviewRow label="Sport">
                {SPORTS_LIST.find((s) => s.value === selectedSport)?.label ??
                  selectedSport}
              </ReviewRow>
              <ReviewRow label="Event name">{finalEventName}</ReviewRow>

              {isTwoTeam ? (
                <ReviewRow label="Participants">
                  <span className="font-medium">{homeTeam}</span>
                  <span className="mx-2 text-ps-text-ter">vs</span>
                  <span className="font-medium">{awayTeam}</span>
                </ReviewRow>
              ) : (
                <ReviewRow label="Competitors">
                  <span className="text-ps-text-sec">
                    {competitors.trim()
                      ? `${competitors.trim().split("\n").filter(Boolean).length} entered`
                      : "None entered"}
                  </span>
                </ReviewRow>
              )}

              <ReviewRow label="Start time">
                {formatTimeForDisplay(startDate, startTime)}
              </ReviewRow>
              <ReviewRow label="Lock time">
                {formatTimeForDisplay(
                  startDate,
                  effectiveLockTime || computedLockTime
                )}
                {lockTimeOverride && (
                  <span className="ml-1.5 text-xs text-ps-amber-deep">(custom)</span>
                )}
              </ReviewRow>
              <ReviewRow label="Prediction types">
                <ul className="space-y-1">
                  {selectedTypes.map(({ type, points }) => (
                    <li key={type} className="flex items-center justify-between gap-3">
                      <span className="text-ps-text-sec text-xs">
                        {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span className="text-xs font-mono text-ps-text-ter">
                        {points} pts
                      </span>
                    </li>
                  ))}
                </ul>
              </ReviewRow>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl bg-ps-red-soft px-4 py-3 text-sm text-ps-red"
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={isSubmitting}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-3 text-sm font-semibold text-[#1a1208] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Event"}
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Navigation buttons                                                   */}
        {/* ------------------------------------------------------------------ */}
        <div className="mt-5 flex items-center gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="rounded-xl border border-ps-border px-4 py-2 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip"
            >
              Back
            </button>
          )}
          {step < 5 && (
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext[step]}
              className="rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-2 text-sm font-semibold text-[#1a1208] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {step === 4 ? "Review" : "Next"}
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              onClick={onCancel}
              className="ml-auto text-xs text-ps-text-ter hover:text-ps-text transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Review row helper
// ----------------------------------------------------------------------------

function ReviewRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="w-28 shrink-0 text-xs font-medium text-ps-text-ter pt-0.5">
        {label}
      </span>
      <div className="flex-1 text-sm text-ps-text">{children}</div>
    </div>
  );
}
