"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Sports ────────────────────────────────────────────────────────────────────

const SPORTS = [
  { id: "soccer", name: "Soccer", emoji: "⚽" },
  { id: "gaa", name: "GAA", emoji: "🇮🇪" },
  { id: "formula_1", name: "Formula 1", emoji: "🏁" },
  { id: "rugby", name: "Rugby", emoji: "🏉" },
  { id: "golf", name: "Golf", emoji: "⛳" },
  { id: "nba", name: "NBA", emoji: "🏀" },
  { id: "horse_racing", name: "Horse Racing", emoji: "🐎" },
  { id: "tennis", name: "Tennis", emoji: "🎾" },
  { id: "cricket", name: "Cricket", emoji: "🏏" },
  { id: "athletics", name: "Athletics", emoji: "🏃" },
];

// ── Scoring presets ────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  name: string;
  blurb: string;
  rules: string[];
  scoringRules: Record<string, unknown>;
}

const SCORING_PRESETS: Preset[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "Pick a winner. Pick a margin. Standard 10pt scoring.",
    rules: [
      "Right winner — 10 points",
      "Right margin — 20 points",
      "Close on margin — 10 points",
    ],
    scoringRules: {
      preset: "classic",
      points: { winner: 10, top_n: 10, head_to_head: 10, margin: 20, over_under: 10, handicap: 10 },
      partial_credit: true,
      partial_points: { margin: 10, top_n: 5 },
    },
  },
  {
    id: "simple",
    name: "Simple",
    blurb: "One pick per match. Right or wrong, no in-between.",
    rules: ["Right pick — 5 points", "Wrong pick — 0 points"],
    scoringRules: {
      preset: "simple",
      points: { winner: 5, top_n: 5, head_to_head: 5, margin: 5, over_under: 5, handicap: 5 },
      partial_credit: false,
    },
  },
  {
    id: "tournament",
    name: "Tournament",
    blurb: "Predict who finishes high in a championship or league.",
    rules: [
      "Right winner — 10 points",
      "In top five — 5 points",
      "In top ten — 3 points",
    ],
    scoringRules: {
      preset: "tournament",
      points: { winner: 10, top_n: 5, head_to_head: 5, margin: 10, over_under: 5, handicap: 5 },
      partial_credit: true,
      partial_points: { top_n: 3, margin: 5 },
    },
  },
  {
    id: "custom",
    name: "Custom",
    blurb: "Set the points yourself for each question type.",
    rules: [],
    scoringRules: {
      preset: "custom",
      points: { winner: 10, top_n: 5, head_to_head: 5, margin: 10, over_under: 5, handicap: 5 },
      partial_credit: true,
      partial_points: { margin: 5, top_n: 3 },
    },
  },
];

const FRIENDLY_TYPE_LABELS: Record<string, string> = {
  winner: "Who wins",
  top_n: "Top finishers",
  head_to_head: "Head to head",
  margin: "Winning margin",
  over_under: "Over or under",
  handicap: "With handicap",
};

// ── League shortcuts per sport ─────────────────────────────────────────────────

const LEAGUE_SHORTCUTS: Record<string, { id: string; label: string }[]> = {
  soccer: [
    { id: "4328", label: "Premier League" },
    { id: "4480", label: "Champions League" },
    { id: "4335", label: "La Liga" },
    { id: "4643", label: "League of Ireland" },
  ],
  formula_1: [{ id: "4370", label: "Formula 1" }],
  gaa: [
    { id: "gaa-football", label: "GAA Football" },
    { id: "gaa-hurling", label: "GAA Hurling" },
  ],
  rugby: [
    { id: "4446", label: "URC" },
    { id: "4550", label: "Champions Cup" },
  ],
  golf: [{ id: "4758", label: "European Tour" }],
  nba: [{ id: "4387", label: "NBA" }],
};

// ── Manual prediction types ────────────────────────────────────────────────────

const MANUAL_PRED_TYPES: { id: string; label: string }[] = [
  { id: "winner", label: "Who wins" },
  { id: "yes_no", label: "Yes or No" },
  { id: "head_to_head", label: "Head to head" },
  { id: "margin", label: "Winning margin" },
  { id: "over_under", label: "Over or under" },
  { id: "progression", label: "Goes through?" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  external_event_id?: string;
  event_name: string;
  sport: string;
  start_time: string;
  lock_time?: string;                     // per-event override (manual events)
  manual_pred_types?: string[];          // per-event prediction types (manual)
  manual_options?: string[];             // config.options for winner/h2h
  competition_name?: string;
  participants?: string[];
  venue?: string;
  provider?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "TBC";
  return d.toLocaleString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function subtractMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

/** Convert a Date to the value format expected by datetime-local inputs */
function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a datetime-local string to ISO (treating as local time) */
function dateTimeLocalToISO(s: string): string {
  if (!s) return "";
  return new Date(s).toISOString();
}

function presetToConfigs(presetId: string, customPoints: Record<string, number>) {
  switch (presetId) {
    case "classic":
      return [
        { prediction_type: "winner", points: 10 },
        { prediction_type: "margin", points: 20, partial_points: 10 },
      ];
    case "simple":
      return [{ prediction_type: "winner", points: 5 }];
    case "tournament":
      return [{ prediction_type: "winner", points: 10 }];
    case "custom":
    default:
      return [{ prediction_type: "winner", points: customPoints.winner ?? 10 }];
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepHeader({
  step,
  total,
  title,
  sub,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  sub: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-full border border-ps-border flex items-center justify-center text-ps-text-sec hover:text-ps-text hover:border-ps-border-strong transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className="h-1 rounded-full transition-all duration-200"
              style={{
                width: i < step ? 22 : 8,
                background: i < step ? "#f59e0b" : "rgba(40,30,20,0.14)",
              }}
            />
          ))}
        </div>
        <div className="w-8" />
      </div>
      <div className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter mb-1">
        Step {step} of {total}
      </div>
      <h1 className="font-display font-extrabold text-2xl tracking-tight text-ps-text leading-tight">
        {title}
      </h1>
      <p className="mt-1.5 text-sm text-ps-text-sec leading-snug">{sub}</p>
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3.5 rounded-xl text-sm font-extrabold tracking-wide transition-opacity ${
        disabled
          ? "bg-ps-chip text-ps-text-ter cursor-default"
          : "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#1a1208] hover:opacity-90"
      }`}
    >
      {children}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface CreateCompetitionFormProps {
  alwaysOpen?: boolean;
}

export function CreateCompetitionForm({ alwaysOpen = false }: CreateCompetitionFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(alwaysOpen);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Wizard state
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;

  // Step 1
  const [name, setName] = useState("");
  const [openType, setOpenType] = useState<"open" | "fixed">("open");

  // Step 2
  const [selectedSports, setSelectedSports] = useState<string[]>(["soccer", "gaa"]);

  // Step 3
  const [selectedPreset, setSelectedPreset] = useState("classic");
  const [customPoints, setCustomPoints] = useState<Record<string, number>>({
    winner: 10, top_n: 5, head_to_head: 5, margin: 10, over_under: 5, handicap: 5,
  });
  const [partialCredit, setPartialCredit] = useState(true);
  const [partialPoints, setPartialPoints] = useState<Record<string, number>>({
    margin: 5, top_n: 3,
  });

  // After competition creation
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Step 4: round builder
  const [roundName, setRoundName] = useState("Round 1");
  const [searchSport, setSearchSport] = useState(selectedSports[0] ?? "soccer");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedFixtures, setSelectedFixtures] = useState<SearchResult[]>([]);
  const [roundSaving, setRoundSaving] = useState(false);

  // Manual event form
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualSport, setManualSport] = useState(selectedSports[0] ?? "soccer");
  const [manualStartTime, setManualStartTime] = useState("");
  const [manualLockTime, setManualLockTime] = useState("");
  const [manualPredTypes, setManualPredTypes] = useState<string[]>(["winner"]);
  const [manualOptionsText, setManualOptionsText] = useState("");

  // Step 5
  const [roundCreated, setRoundCreated] = useState(false);
  const [fixtureCount, setFixtureCount] = useState(0);

  const includesGaa = selectedSports.includes("gaa");

  function toggleSport(id: string) {
    setSelectedSports((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function toggleFixture(f: SearchResult) {
    setSelectedFixtures((prev) => {
      const key = f.external_event_id ?? f.event_name;
      const exists = prev.some((x) => (x.external_event_id ?? x.event_name) === key);
      return exists
        ? prev.filter((x) => (x.external_event_id ?? x.event_name) !== key)
        : [...prev, f];
    });
  }

  function isFixtureSelected(f: SearchResult) {
    const key = f.external_event_id ?? f.event_name;
    return selectedFixtures.some((x) => (x.external_event_id ?? x.event_name) === key);
  }

  // Create competition (called from Step 3)
  async function createCompetition(): Promise<string | null> {
    setSubmitting(true);
    setError(null);

    const preset = SCORING_PRESETS.find((p) => p.id === selectedPreset);
    let scoringRules: Record<string, unknown>;

    if (selectedPreset === "custom") {
      scoringRules = {
        preset: "custom",
        points: customPoints,
        partial_credit: partialCredit,
        partial_points: partialCredit ? partialPoints : {},
      };
    } else {
      scoringRules = preset?.scoringRules ?? SCORING_PRESETS[0].scoringRules;
    }

    try {
      const res = await fetch("/api/admin/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: openType,
          visibility: "private",
          scoring_rules: scoringRules,
          allow_prediction_updates: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return null;
      }

      setCompetitionId(data.competition.id);
      setInviteCode(data.competition.invite_code ?? null);
      setSearchSport(selectedSports[0] ?? "soccer");
      return data.competition.id;
    } catch {
      setError("Couldn't connect. Check your internet and try again.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  // Search fixtures
  const searchFixtures = useCallback(async (sport: string, query: string, league?: string) => {
    setSearching(true);
    setSearchResults([]);
    try {
      let url: string;
      if (league) {
        url = `/api/sports/search?sport=${encodeURIComponent(sport)}&league=${encodeURIComponent(league)}`;
      } else if (query.trim()) {
        url = `/api/sports/search?sport=${encodeURIComponent(sport)}&q=${encodeURIComponent(query.trim())}`;
      } else {
        setSearching(false);
        return;
      }
      const res = await fetch(url);
      const data = await res.json();
      setSearchResults(Array.isArray(data.events) ? data.events : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Add a manually-entered event to selectedFixtures
  function addManualEvent() {
    if (!manualName.trim() || !manualStartTime || !manualSport) return;

    const startISO = dateTimeLocalToISO(manualStartTime);
    const lockISO = manualLockTime
      ? dateTimeLocalToISO(manualLockTime)
      : subtractMinutes(startISO, 30);

    // Parse options text: split by "/" or "," trimming whitespace
    const options = manualOptionsText
      .split(/[/,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const event: SearchResult = {
      event_name: manualName.trim(),
      sport: manualSport,
      start_time: startISO,
      lock_time: lockISO,
      manual_pred_types: manualPredTypes,
      manual_options: options.length >= 2 ? options : undefined,
    };

    setSelectedFixtures((prev) => [...prev, event]);

    // Reset form
    setManualName("");
    setManualStartTime("");
    setManualLockTime("");
    setManualOptionsText("");
    setManualPredTypes(["winner"]);
    setShowManualForm(false);
  }

  // Create round (Step 4)
  async function createRound(compId: string, asDraft: boolean) {
    if (!asDraft && selectedFixtures.length === 0) return;
    setRoundSaving(true);
    setError(null);

    const defaultPredTypeConfigs = presetToConfigs(selectedPreset, customPoints);

    try {
      const events = selectedFixtures.map((f) => {
        // Manual events carry their own prediction types + options
        const predConfigs = f.manual_pred_types
          ? f.manual_pred_types.map((pt) => ({
              prediction_type: pt,
              ...(f.manual_options &&
                (pt === "winner" || pt === "head_to_head")
                ? { config: { options: f.manual_options } }
                : {}),
            }))
          : defaultPredTypeConfigs;

        return {
          event_name: f.event_name,
          sport: f.sport,
          start_time: f.start_time,
          lock_time: f.lock_time ?? subtractMinutes(f.start_time, 30),
          external_event_id: f.external_event_id ?? undefined,
          prediction_type_configs: predConfigs,
        };
      });

      const res = await fetch("/api/admin/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: compId,
          round_number: 1,
          name: roundName.trim() || "Round 1",
          events: asDraft ? [] : events,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save the round. Please try again.");
        return;
      }

      setRoundCreated(!asDraft);
      setFixtureCount(asDraft ? 0 : selectedFixtures.length);
      setStep(5);
    } catch {
      setError("Couldn't connect. Please try again.");
    } finally {
      setRoundSaving(false);
    }
  }

  // ── Closed state ─────────────────────────────────────────────────────────────

  if (!isOpen && !alwaysOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-2.5 text-sm font-extrabold text-[#1a1208] transition-opacity hover:opacity-90"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="#1a1208" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
        New Competition
      </button>
    );
  }

  // ── Error banner ─────────────────────────────────────────────────────────────

  const ErrorBanner = error ? (
    <div className="mb-4 rounded-xl bg-ps-red-soft p-3 text-sm text-ps-red">
      {error}
    </div>
  ) : null;

  // ── Step 1: Name + Type ───────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div>
        {ErrorBanner}
        <StepHeader
          step={1}
          total={TOTAL_STEPS}
          title="Name your competition"
          sub="Two quick things, then we'll add the first round together."
          onBack={() => {
            if (alwaysOpen) router.push("/competitions");
            else setIsOpen(false);
          }}
        />

        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-extrabold tracking-widest uppercase text-ps-text-sec mb-1.5">
              Competition name
            </label>
            <input
              type="text"
              autoFocus
              maxLength={100}
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunday Predictions"
              className={`block w-full rounded-xl border bg-ps-surface px-3.5 py-3 text-sm text-ps-text focus:outline-none transition-colors ${
                name ? "border-ps-amber" : "border-ps-border focus:border-ps-amber"
              }`}
            />
          </div>

          <div>
            <label className="block text-[10px] font-extrabold tracking-widest uppercase text-ps-text-sec mb-2">
              How will you add matches?
            </label>
            <div className="flex flex-col gap-2.5">
              {[
                {
                  v: "open" as const,
                  t: "Round by round",
                  d: "Add a new round whenever you want. Best for ongoing leagues.",
                },
                {
                  v: "fixed" as const,
                  t: "All up front",
                  d: "Lock in every match at the start. Best for one tournament.",
                },
              ].map((o) => (
                <label
                  key={o.v}
                  className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                    openType === o.v
                      ? "border-ps-amber bg-ps-amber-soft"
                      : "border-ps-border hover:border-ps-border-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="open-type"
                    checked={openType === o.v}
                    onChange={() => setOpenType(o.v)}
                    className="mt-0.5 accent-[#f59e0b]"
                  />
                  <div>
                    <div className="text-sm font-bold text-ps-text">{o.t}</div>
                    <div className="mt-0.5 text-xs leading-snug text-ps-text-sec">{o.d}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-7">
          <PrimaryBtn disabled={!name.trim()} onClick={() => setStep(2)}>
            Continue
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  // ── Step 2: Sports ────────────────────────────────────────────────────────────

  if (step === 2) {
    return (
      <div>
        {ErrorBanner}
        <StepHeader
          step={2}
          total={TOTAL_STEPS}
          title="Which sports?"
          sub="Tap any that might appear in a round. You can mix freely."
          onBack={() => setStep(1)}
        />

        <div className="grid grid-cols-2 gap-2.5">
          {SPORTS.map((s) => {
            const on = selectedSports.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSport(s.id)}
                className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left transition-colors ${
                  on
                    ? "border-ps-amber bg-ps-amber-soft"
                    : "border-ps-border bg-ps-surface hover:border-ps-border-strong"
                }`}
              >
                <span className="text-xl leading-none">{s.emoji}</span>
                <span className="flex-1 text-sm font-bold text-ps-text">{s.name}</span>
                <span
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                    on ? "border-transparent bg-[#f59e0b]" : "border-ps-border-strong bg-transparent"
                  }`}
                >
                  {on && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="#1a1208" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {includesGaa && (
          <div className="mt-4 flex items-center gap-3 rounded-r-xl border-l-[3px] border-ps-green bg-ps-green-soft/60 px-3 py-2.5">
            <span className="text-base leading-none">🇮🇪</span>
            <span className="text-xs text-ps-text leading-snug">
              <strong>GAA is on.</strong> The umpire mark will show up on your competition now and then.
            </span>
          </div>
        )}

        <div className="mt-7">
          <PrimaryBtn disabled={selectedSports.length === 0} onClick={() => setStep(3)}>
            Continue
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  // ── Step 3: Scoring presets ────────────────────────────────────────────────────

  if (step === 3) {
    return (
      <div>
        {ErrorBanner}
        <StepHeader
          step={3}
          total={TOTAL_STEPS}
          title="How does scoring work?"
          sub="Pick a preset — you can adjust point values later."
          onBack={() => setStep(2)}
        />

        <div className="flex flex-col gap-2.5">
          {SCORING_PRESETS.map((p) => {
            const on = selectedPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPreset(p.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  on
                    ? "border-ps-amber bg-ps-amber-soft"
                    : "border-ps-border bg-ps-surface hover:border-ps-border-strong"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-ps-text">{p.name}</span>
                  {on && (
                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#f59e0b]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="#1a1208" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs leading-snug text-ps-text-sec">{p.blurb}</div>
                {p.rules.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {p.rules.map((r) => (
                      <li key={r} className="flex items-start gap-1.5 text-xs text-ps-text-sec">
                        <span className="font-extrabold text-ps-amber-deep shrink-0">·</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom scoring options */}
        {selectedPreset === "custom" && (
          <div className="mt-4 rounded-xl border border-ps-border bg-ps-bg/50 p-4 space-y-4">
            <div>
              <h4 className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-sec mb-3">
                Points per question type
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(customPoints).map(([pType, pts]) => (
                  <div key={pType}>
                    <label className="block text-xs text-ps-text-sec mb-1">
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
                      className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text focus:border-ps-amber focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={partialCredit}
                onChange={(e) => setPartialCredit(e.target.checked)}
                className="h-4 w-4 rounded accent-[#f59e0b]"
              />
              <span className="text-sm text-ps-text-sec">Give points for close answers</span>
            </label>

            {partialCredit && (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(partialPoints).map(([pType, pts]) => (
                  <div key={pType}>
                    <label className="block text-xs text-ps-text-sec mb-1">
                      {FRIENDLY_TYPE_LABELS[pType] ?? pType} (close)
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
                      className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text focus:border-ps-amber focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-7 space-y-2">
          <PrimaryBtn
            disabled={submitting}
            onClick={async () => {
              const id = await createCompetition();
              if (id) setStep(4);
            }}
          >
            {submitting ? "Setting things up..." : "Create and add first round"}
          </PrimaryBtn>
          <p className="text-center text-[11px] text-ps-text-ter">
            We&apos;ll set this up and bring you straight to round one.
          </p>
        </div>
      </div>
    );
  }

  // ── Step 4: Add first round ────────────────────────────────────────────────────

  if (step === 4 && competitionId) {
    const leagues = LEAGUE_SHORTCUTS[searchSport] ?? [];

    return (
      <div>
        {ErrorBanner}
        <StepHeader
          step={4}
          total={TOTAL_STEPS}
          title="Add the first round"
          sub="Round one goes in now — that's what sends the competition live."
          onBack={() => setStep(3)}
        />

        {/* Competition created confirmation */}
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-ps-green bg-ps-green-soft p-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ps-green">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-ps-text truncate">&ldquo;{name}&rdquo; created</div>
            <div className="text-xs text-ps-text-sec mt-0.5">Now add one or more matches to round one.</div>
          </div>
        </div>

        {/* Round name */}
        <div className="mb-5">
          <label className="block text-[10px] font-extrabold tracking-widest uppercase text-ps-text-sec mb-1.5">
            Round name
          </label>
          <input
            type="text"
            value={roundName}
            onChange={(e) => setRoundName(e.target.value)}
            className="block w-full rounded-xl border border-ps-border bg-ps-surface px-3.5 py-3 text-sm text-ps-text focus:border-ps-amber focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-ps-text-ter">
            Call it anything — &ldquo;Bank Holiday Weekend&rdquo;, &ldquo;Champions League Semis&rdquo;, etc.
          </p>
        </div>

        {/* Fixture search */}
        <div className="mb-3">
          <label className="block text-[10px] font-extrabold tracking-widest uppercase text-ps-text-sec mb-2">
            Search for matches
          </label>

          {/* Sport filter */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedSports.map((s) => {
              const sport = SPORTS.find((sp) => sp.id === s);
              const isActive = searchSport === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSearchSport(s);
                    setSearchResults([]);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-ps-amber text-[#1a1208]"
                      : "bg-ps-chip text-ps-text-sec hover:text-ps-text"
                  }`}
                >
                  <span>{sport?.emoji}</span>
                  <span>{sport?.name}</span>
                </button>
              );
            })}
          </div>

          {/* League shortcuts */}
          {leagues.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {leagues.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => searchFixtures(searchSport, "", l.id)}
                  className="rounded-lg border border-ps-border bg-ps-surface px-2.5 py-1 text-xs font-semibold text-ps-text-sec hover:border-ps-border-strong hover:text-ps-text transition-colors"
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by team or event name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchFixtures(searchSport, searchQuery);
                }
              }}
              className="flex-1 rounded-xl border border-ps-border bg-ps-surface px-3.5 py-2.5 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none"
            />
            <button
              type="button"
              onClick={() => searchFixtures(searchSport, searchQuery)}
              disabled={searching}
              className="rounded-xl bg-ps-chip px-4 py-2.5 text-sm font-semibold text-ps-text-sec hover:text-ps-text transition-colors disabled:opacity-50"
            >
              {searching ? "..." : "Search"}
            </button>
          </div>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            <div className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter mb-1">
              Results ({searchResults.length})
            </div>
            {searchResults.map((f) => {
              const on = isFixtureSelected(f);
              const sport = SPORTS.find((s) => s.id === f.sport);
              return (
                <button
                  key={f.external_event_id ?? f.event_name}
                  type="button"
                  onClick={() => toggleFixture(f)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    on
                      ? "border-ps-amber bg-ps-amber-soft"
                      : "border-ps-border bg-ps-surface hover:border-ps-border-strong"
                  }`}
                >
                  <span className="text-lg leading-none w-6 text-center shrink-0">
                    {sport?.emoji ?? "🏆"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ps-text truncate">{f.event_name}</div>
                    <div className="text-[11px] text-ps-text-sec mt-0.5">
                      {f.competition_name && `${f.competition_name} · `}
                      {formatDateTime(f.start_time)}
                      {f.venue && ` · ${f.venue}`}
                    </div>
                  </div>
                  <span
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                      on
                        ? "border-transparent bg-[#f59e0b]"
                        : "border-ps-border-strong bg-transparent"
                    }`}
                  >
                    {on && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="#1a1208" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Manual event entry */}
        <div className="mb-4">
          {!showManualForm ? (
            <button
              type="button"
              onClick={() => {
                setShowManualForm(true);
                setManualSport(searchSport);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-ps-text-sec hover:text-ps-text transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
              Add manually
            </button>
          ) : (
            <div className="rounded-xl border border-ps-border bg-ps-surface p-4 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-sec">
                  Add manually
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="text-ps-text-ter hover:text-ps-text transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Event name */}
              <div>
                <label className="block text-xs font-bold text-ps-text-sec mb-1">Event name</label>
                <input
                  type="text"
                  maxLength={150}
                  autoComplete="off"
                  placeholder="e.g. Wexford v Kilkenny"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3.5 py-2.5 text-sm text-ps-text focus:border-ps-amber focus:outline-none"
                />
              </div>

              {/* Sport */}
              <div>
                <label className="block text-xs font-bold text-ps-text-sec mb-2">Sport</label>
                <div className="flex flex-wrap gap-1.5">
                  {SPORTS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setManualSport(s.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                        manualSport === s.id
                          ? "bg-ps-amber text-[#1a1208]"
                          : "bg-ps-chip text-ps-text-sec hover:text-ps-text"
                      }`}
                    >
                      <span>{s.emoji}</span>
                      <span>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Start time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ps-text-sec mb-1">Start time</label>
                  <input
                    type="datetime-local"
                    value={manualStartTime}
                    onChange={(e) => {
                      setManualStartTime(e.target.value);
                      // Auto-set lock to 30min before if not already set
                      if (e.target.value && !manualLockTime) {
                        const lockD = new Date(e.target.value);
                        lockD.setMinutes(lockD.getMinutes() - 30);
                        setManualLockTime(toDateTimeLocal(lockD));
                      }
                    }}
                    className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2.5 text-sm text-ps-text focus:border-ps-amber focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ps-text-sec mb-1">
                    Lock time
                    <span className="ml-1 font-normal text-ps-text-ter">(predictions close)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={manualLockTime}
                    onChange={(e) => setManualLockTime(e.target.value)}
                    className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-2.5 text-sm text-ps-text focus:border-ps-amber focus:outline-none"
                  />
                </div>
              </div>

              {/* Prediction types */}
              <div>
                <label className="block text-xs font-bold text-ps-text-sec mb-2">
                  What can people predict?
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {MANUAL_PRED_TYPES.map((pt) => {
                    const on = manualPredTypes.includes(pt.id);
                    return (
                      <label
                        key={pt.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                          on
                            ? "border-ps-amber bg-ps-amber-soft"
                            : "border-ps-border hover:border-ps-border-strong"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setManualPredTypes((prev) =>
                              on ? prev.filter((t) => t !== pt.id) : [...prev, pt.id]
                            )
                          }
                          className="accent-[#f59e0b]"
                        />
                        <span className="text-xs font-semibold text-ps-text">{pt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Options for winner / head_to_head */}
              {(manualPredTypes.includes("winner") || manualPredTypes.includes("head_to_head")) && (
                <div>
                  <label className="block text-xs font-bold text-ps-text-sec mb-1">
                    Participants
                    <span className="ml-1 font-normal text-ps-text-ter">(shows pick buttons, optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Wexford / Kilkenny"
                    value={manualOptionsText}
                    onChange={(e) => setManualOptionsText(e.target.value)}
                    className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3.5 py-2.5 text-sm text-ps-text focus:border-ps-amber focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-ps-text-ter">
                    Separate names with / or comma. Leaves a free-text field if blank.
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={!manualName.trim() || !manualStartTime || manualPredTypes.length === 0}
                onClick={addManualEvent}
                className={`w-full py-2.5 rounded-xl text-sm font-extrabold transition-opacity ${
                  !manualName.trim() || !manualStartTime || manualPredTypes.length === 0
                    ? "bg-ps-chip text-ps-text-ter cursor-default"
                    : "bg-ps-ink text-ps-bg hover:opacity-80"
                }`}
              >
                Add to round
              </button>
            </div>
          )}
        </div>

        {/* Selected fixtures summary */}
        {selectedFixtures.length > 0 && (
          <div className="mb-4 rounded-xl border border-ps-border bg-ps-chip px-4 py-3">
            <div className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter mb-2">
              Selected ({selectedFixtures.length})
            </div>
            <div className="flex flex-col gap-1">
              {selectedFixtures.map((f) => (
                <div key={f.external_event_id ?? f.event_name} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ps-text truncate">{f.event_name}</span>
                  <button
                    type="button"
                    onClick={() => toggleFixture(f)}
                    className="text-ps-text-ter hover:text-ps-red transition-colors shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <PrimaryBtn
            disabled={selectedFixtures.length === 0 || roundSaving}
            onClick={() => createRound(competitionId, false)}
          >
            {roundSaving
              ? "Saving..."
              : selectedFixtures.length > 0
              ? `Send round one live · ${selectedFixtures.length} ${selectedFixtures.length === 1 ? "match" : "matches"}`
              : "Pick at least one match"}
          </PrimaryBtn>
          <button
            type="button"
            onClick={() => createRound(competitionId, true)}
            disabled={roundSaving}
            className="w-full py-2.5 text-sm font-semibold text-ps-text-sec hover:text-ps-text transition-colors"
          >
            Save as draft, add matches later
          </button>
        </div>
      </div>
    );
  }

  // ── Step 5: Done ──────────────────────────────────────────────────────────────

  if (step === 5 && competitionId) {
    const joinUrl = inviteCode
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${inviteCode}`
      : null;

    return (
      <div className="text-center">
        <div className="flex justify-center mb-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ps-green">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <h2 className="font-display font-extrabold text-3xl tracking-tight text-ps-text leading-tight mb-2">
          {roundCreated ? "You're live" : "Competition saved"}
        </h2>
        <p className="text-sm text-ps-text-sec leading-relaxed">
          {roundCreated
            ? `"${name}" is set up with ${fixtureCount} ${fixtureCount === 1 ? "match" : "matches"} in ${roundName.trim() || "Round 1"}.`
            : `"${name}" is saved as a draft. Head in to add your first round when you're ready.`}
        </p>

        {joinUrl && (
          <div className="mt-6 rounded-xl border border-ps-border bg-ps-surface p-4 text-left">
            <div className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-sec mb-3">
              Share with the group
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-ps-chip px-3 py-2 font-mono text-xs text-ps-text">
              <span className="flex-1 truncate">{joinUrl}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(joinUrl)}
                className="shrink-0 rounded-md bg-[#f59e0b] px-2.5 py-1 text-[10px] font-extrabold text-[#1a1208]"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <div className="mt-5">
          <PrimaryBtn
            onClick={() => {
              router.push(`/competitions/${competitionId}`);
              router.refresh();
            }}
          >
            Open competition
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  return null;
}
