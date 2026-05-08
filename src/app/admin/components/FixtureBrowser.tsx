"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Sport } from "@/lib/sports/types";
import type { NormalizedFixture } from "@/app/api/sports/fixtures/route";

// Re-export for use in AddEventForm
export type { NormalizedFixture };

interface LeagueOption {
  id: string;
  label: string;
  sport: Sport;
}

interface LeagueGroup {
  label: string;
  leagues: LeagueOption[];
}

const LEAGUE_GROUPS: LeagueGroup[] = [
  {
    label: "Soccer — England",
    leagues: [
      { id: "4328", label: "Premier League", sport: "soccer" },
      { id: "4329", label: "Championship", sport: "soccer" },
      { id: "4350", label: "League Cup", sport: "soccer" },
    ],
  },
  {
    label: "Soccer — Europe",
    leagues: [
      { id: "4480", label: "Champions League", sport: "soccer" },
      { id: "4481", label: "Europa League", sport: "soccer" },
      { id: "4335", label: "La Liga", sport: "soccer" },
      { id: "4331", label: "Bundesliga", sport: "soccer" },
      { id: "4332", label: "Serie A", sport: "soccer" },
      { id: "4334", label: "Ligue 1", sport: "soccer" },
      { id: "4337", label: "Eredivisie", sport: "soccer" },
      { id: "4338", label: "Pro League (Belgium)", sport: "soccer" },
      { id: "4336", label: "Super League (Greece)", sport: "soccer" },
    ],
  },
  {
    label: "Soccer — Ireland / Scotland",
    leagues: [
      { id: "4643", label: "League of Ireland Premier", sport: "soccer" },
      { id: "4757", label: "League of Ireland First Division", sport: "soccer" },
      { id: "4330", label: "Scottish Premiership", sport: "soccer" },
    ],
  },
  {
    label: "Soccer — International",
    leagues: [
      { id: "4429", label: "FIFA World Cup", sport: "soccer" },
      { id: "4501", label: "Copa Libertadores", sport: "soccer" },
    ],
  },
  {
    label: "GAA",
    leagues: [
      { id: "5564", label: "All-Ireland Senior Football", sport: "gaa" },
      { id: "5566", label: "Connacht Senior Football", sport: "gaa" },
      { id: "5567", label: "Leinster Senior Football", sport: "gaa" },
      { id: "5568", label: "Munster Senior Football", sport: "gaa" },
      { id: "5569", label: "Ulster Senior Football", sport: "gaa" },
      { id: "5576", label: "Tailteann Cup", sport: "gaa" },
      { id: "5565", label: "All-Ireland Senior Hurling", sport: "gaa" },
      { id: "5570", label: "Munster Senior Hurling", sport: "gaa" },
      { id: "5571", label: "Leinster Senior Hurling", sport: "gaa" },
      { id: "5572", label: "Joe McDonagh Cup", sport: "gaa" },
      { id: "5573", label: "Christy Ring Cup", sport: "gaa" },
    ],
  },
  {
    label: "US Sports",
    leagues: [
      { id: "4387", label: "NBA", sport: "nba" },
      { id: "4424", label: "MLB", sport: "mlb" },
      { id: "4380", label: "NHL", sport: "nhl" },
      { id: "4391", label: "NFL", sport: "nfl" },
    ],
  },
  {
    label: "Motorsport",
    leagues: [
      { id: "4370", label: "Formula 1", sport: "formula_1" },
      { id: "4407", label: "MotoGP", sport: "formula_1" },
    ],
  },
  {
    label: "Combat Sports",
    leagues: [
      { id: "4443", label: "UFC", sport: "soccer" },
    ],
  },
  {
    label: "Rugby",
    leagues: [
      { id: "4415", label: "Super League", sport: "rugby" },
      { id: "4416", label: "NRL", sport: "rugby" },
      { id: "4446", label: "United Rugby Championship", sport: "rugby" },
      { id: "4550", label: "Champions Cup", sport: "rugby" },
    ],
  },
  {
    label: "Tennis",
    leagues: [
      { id: "4464", label: "ATP Tour", sport: "tennis" },
      { id: "4517", label: "WTA Tour", sport: "tennis" },
    ],
  },
  {
    label: "Snooker",
    leagues: [
      { id: "4555", label: "World Snooker", sport: "soccer" },
    ],
  },
  {
    label: "Darts",
    leagues: [
      { id: "4554", label: "PDC Darts", sport: "soccer" },
    ],
  },
  {
    label: "Cycling",
    leagues: [
      { id: "4465", label: "UCI World Tour", sport: "soccer" },
    ],
  },
  {
    label: "Golf",
    leagues: [
      { id: "4758", label: "European Tour", sport: "golf" },
    ],
  },
  {
    label: "Cricket — International",
    leagues: [
      { id: "4844", label: "Test Match Series", sport: "soccer" },
      { id: "4801", label: "ODI Series", sport: "soccer" },
      { id: "4979", label: "T20I Series", sport: "soccer" },
      { id: "4575", label: "Cricket World Cup", sport: "soccer" },
      { id: "5587", label: "ICC Champions Trophy", sport: "soccer" },
      { id: "5103", label: "ICC Men's T20 World Cup", sport: "soccer" },
      { id: "5100", label: "ICC World Test Championship", sport: "soccer" },
    ],
  },
  {
    label: "Cricket — T20 Leagues",
    leagues: [
      { id: "4460", label: "Indian Premier League (IPL)", sport: "soccer" },
      { id: "4461", label: "Big Bash League", sport: "soccer" },
      { id: "4463", label: "English T20 Blast", sport: "soccer" },
      { id: "5177", label: "The Hundred", sport: "soccer" },
      { id: "5176", label: "Caribbean Premier League", sport: "soccer" },
      { id: "5067", label: "Pakistan Super League", sport: "soccer" },
      { id: "5532", label: "SA20", sport: "soccer" },
      { id: "5175", label: "Lanka Premier League", sport: "soccer" },
      { id: "5174", label: "NZ Super Smash", sport: "soccer" },
      { id: "5490", label: "International League T20 (UAE)", sport: "soccer" },
      { id: "5401", label: "Major League Cricket (USA)", sport: "soccer" },
    ],
  },
  {
    label: "Cricket — Domestic",
    leagues: [
      { id: "4458", label: "County Championship Div 1", sport: "soccer" },
      { id: "4459", label: "County Championship Div 2", sport: "soccer" },
      { id: "5530", label: "Sheffield Shield", sport: "soccer" },
      { id: "5606", label: "Ireland Inter-Provincial T20", sport: "soccer" },
    ],
  },
];

// Flat lookup map for quick label resolution
const LEAGUE_MAP = new Map<string, LeagueOption>(
  LEAGUE_GROUPS.flatMap((g) => g.leagues.map((l) => [l.id, l]))
);

const DEFAULT_FAVOURITE_IDS = [
  "4328", // Premier League - soccer
  "5564", // All-Ireland Football - gaa
  "4370", // Formula 1 - motorsport
  "4391", // NFL - nfl
  "4446", // URC - rugby
  "4464", // ATP - tennis
];
const LS_KEY = "ps-favourite-leagues";

function loadFavourites(): string[] {
  if (typeof window === "undefined") return DEFAULT_FAVOURITE_IDS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_FAVOURITE_IDS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Filter out stale IDs that no longer exist in LEAGUE_MAP
      const valid = (parsed as string[]).filter((id) => LEAGUE_MAP.has(id));
      if (valid.length > 0) return valid;
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_FAVOURITE_IDS;
}

function saveFavourites(ids: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

interface FixtureBrowserProps {
  onSelect: (fixture: NormalizedFixture) => void;
}

// Keyed fixture: fixture + which league it came from
interface KeyedFixture {
  fixture: NormalizedFixture;
  leagueId: string;
}

function formatDateHeading(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Date TBC";
  return date.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatFixtureTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "TBC";
  return date.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// Returns a sortable date key like "2026-05-08"
function dateKey(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "9999-99-99";
  return date.toISOString().slice(0, 10);
}

function StarFilledIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-ps-amber"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 1.5l1.9 3.85 4.25.62-3.08 3 .73 4.25L8 11.1l-3.8 2.12.73-4.25-3.08-3 4.25-.62L8 1.5z" />
    </svg>
  );
}

function StarOutlineIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-ps-text-ter"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      <path d="M8 1.5l1.9 3.85 4.25.62-3.08 3 .73 4.25L8 11.1l-3.8 2.12.73-4.25-3.08-3 4.25-.62L8 1.5z" />
    </svg>
  );
}

function FixtureRow({
  fixture,
  leagueId,
  onSelect,
}: {
  fixture: NormalizedFixture;
  leagueId: string;
  onSelect: (f: NormalizedFixture) => void;
}) {
  const [home, away] = fixture.participants;
  const hasTeams = home && away;
  const leagueLabel = LEAGUE_MAP.get(leagueId)?.label ?? null;

  return (
    <button
      type="button"
      onClick={() => onSelect(fixture)}
      className="group w-full rounded-xl border border-ps-border bg-ps-surface p-3 text-left transition-colors hover:border-ps-border-strong hover:bg-ps-chip"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {hasTeams ? (
            <div className="truncate text-sm font-medium text-ps-text">
              {home}{" "}
              <span className="text-xs font-normal text-ps-text-ter">vs</span>{" "}
              {away}
            </div>
          ) : (
            <div className="truncate text-sm font-medium text-ps-text">
              {fixture.event_name}
            </div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ps-text-ter">
            <span className="shrink-0">{formatFixtureTime(fixture.start_time)}</span>
            {fixture.round && (
              <span className="shrink-0 text-ps-text-ter">R{fixture.round}</span>
            )}
            {leagueLabel && (
              <span className="truncate rounded-full bg-ps-chip px-1.5 py-px text-[10px] text-ps-text-ter">
                {leagueLabel}
              </span>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-ps-amber-soft px-2 py-1 text-xs font-medium text-ps-amber-deep opacity-0 transition-opacity group-hover:opacity-100">
          Select
        </span>
      </div>
    </button>
  );
}

// ---- Drag handle icon -------------------------------------------------------

function DragHandleIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-ps-text-ter"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="4" r="1.1" />
      <circle cx="5" cy="8" r="1.1" />
      <circle cx="5" cy="12" r="1.1" />
      <circle cx="10" cy="4" r="1.1" />
      <circle cx="10" cy="8" r="1.1" />
      <circle cx="10" cy="12" r="1.1" />
    </svg>
  );
}

// ---- Chevron icon -----------------------------------------------------------

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-3.5 w-3.5"}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

// ---- X icon -----------------------------------------------------------------

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-3 w-3"}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

// ---- League Dropdown --------------------------------------------------------

function LeagueDropdown({
  excludeIds,
  onSelect,
  onClose,
  triggerRef,
}: {
  excludeIds: Set<string>;
  onSelect: (id: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the search input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click (but not on the trigger button itself)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const normalised = query.trim().toLowerCase();

  const filteredGroups = LEAGUE_GROUPS.map((group) => ({
    ...group,
    leagues: group.leagues.filter(
      (l) =>
        !excludeIds.has(l.id) &&
        (normalised === "" || l.label.toLowerCase().includes(normalised))
    ),
  })).filter((g) => g.leagues.length > 0);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Browse leagues"
      className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-ps-border bg-ps-surface shadow-lg"
    >
      {/* Search input */}
      <div className="border-b border-ps-border p-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leagues..."
          className="w-full rounded-lg bg-ps-chip px-3 py-1.5 text-sm text-ps-text placeholder:text-ps-text-ter focus:outline-none focus:ring-1 focus:ring-ps-border-strong"
        />
      </div>

      {/* Scrollable league list */}
      <div className="max-h-72 overflow-y-auto px-2 py-2">
        {filteredGroups.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-ps-text-ter">
            No leagues found
          </p>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-ps-text-ter">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.leagues.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    onClick={() => {
                      onSelect(league.id);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-ps-text transition-colors hover:bg-ps-chip"
                  >
                    <span>{league.label}</span>
                    <StarOutlineIcon />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- Add-to-favourites Dropdown (excludes current favourites) ---------------

function AddFavouriteDropdown({
  favouriteIds,
  onAdd,
  onClose,
  triggerRef,
}: {
  favouriteIds: string[];
  onAdd: (id: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <LeagueDropdown
      excludeIds={new Set(favouriteIds)}
      onSelect={onAdd}
      onClose={onClose}
      triggerRef={triggerRef}
    />
  );
}

// ---- Main component ---------------------------------------------------------

export function FixtureBrowser({ onSelect }: FixtureBrowserProps) {
  const [favouriteIds, setFavouriteIds] = useState<string[]>(() =>
    loadFavourites()
  );
  const [editMode, setEditMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownLeagueId, setDropdownLeagueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // allFixtures: map of leagueId -> fixtures (only loaded leagues)
  const [allFixtures, setAllFixtures] = useState<
    Record<string, NormalizedFixture[]>
  >({});
  const [cache, setCache] = useState<Record<string, NormalizedFixture[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Persist favourites on change
  useEffect(() => {
    saveFavourites(favouriteIds);
  }, [favouriteIds]);

  const fetchLeague = useCallback(
    async (leagueId: string): Promise<NormalizedFixture[]> => {
      if (cache[leagueId]) return cache[leagueId];
      const res = await fetch(`/api/sports/fixtures?league=${leagueId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load fixtures");
      const fetched: NormalizedFixture[] = data.fixtures ?? [];
      setCache((prev) => ({ ...prev, [leagueId]: fetched }));
      return fetched;
    },
    [cache]
  );

  // Determine which league IDs the calendar should show
  const activeLeagueIds = dropdownLeagueId
    ? [dropdownLeagueId]
    : favouriteIds;

  // Fetch leagues whenever active set changes
  useEffect(() => {
    if (activeLeagueIds.length === 0) return;

    const needed = activeLeagueIds.filter(
      (id) => !(id in allFixtures) && !loadingIds.has(id)
    );
    if (needed.length === 0) return;

    setLoadingIds((prev) => {
      const next = new Set(prev);
      needed.forEach((id) => next.add(id));
      return next;
    });

    Promise.allSettled(
      needed.map((id) => fetchLeague(id).then((f) => ({ id, f })))
    ).then((results) => {
      const newFixtures: Record<string, NormalizedFixture[]> = {};
      const newErrors: Record<string, string> = {};

      results.forEach((result, idx) => {
        const id = needed[idx];
        if (result.status === "fulfilled") {
          newFixtures[id] = result.value.f;
        } else {
          newErrors[id] =
            result.reason instanceof Error
              ? result.reason.message
              : "Failed to load";
        }
      });

      setAllFixtures((prev) => ({ ...prev, ...newFixtures }));
      setErrors((prev) => ({ ...prev, ...newErrors }));
      setLoadingIds((prev) => {
        const next = new Set(prev);
        needed.forEach((id) => next.delete(id));
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeagueIds.join(",")]);

  // Build calendar view: group KeyedFixtures by date
  const calendarGroups = (() => {
    const keyed: KeyedFixture[] = [];

    activeLeagueIds.forEach((leagueId) => {
      const fixtures = allFixtures[leagueId] ?? [];
      fixtures.forEach((f) => keyed.push({ fixture: f, leagueId }));
    });

    keyed.sort(
      (a, b) =>
        new Date(a.fixture.start_time).getTime() -
        new Date(b.fixture.start_time).getTime()
    );

    const groups = new Map<string, { heading: string; items: KeyedFixture[] }>();
    keyed.forEach((kf) => {
      const key = dateKey(kf.fixture.start_time);
      if (!groups.has(key)) {
        groups.set(key, {
          heading: formatDateHeading(kf.fixture.start_time),
          items: [],
        });
      }
      groups.get(key)!.items.push(kf);
    });

    return Array.from(groups.values());
  })();

  const isAnyLoading = activeLeagueIds.some((id) => loadingIds.has(id));
  const hasAnyFixtures = calendarGroups.length > 0;
  const failedIds = activeLeagueIds.filter((id) => errors[id]);

  // ---- Favourites management ------------------------------------------------

  const removeFavourite = useCallback((id: string) => {
    setFavouriteIds((prev) => {
      if (prev.length <= 1) return prev; // enforce minimum 1
      return prev.filter((x) => x !== id);
    });
  }, []);

  const addFavourite = useCallback((id: string) => {
    setFavouriteIds((prev) => {
      if (prev.includes(id) || prev.length >= 6) return prev;
      return [...prev, id];
    });
  }, []);

  // ---- Drag and drop (HTML5) ------------------------------------------------

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setFavouriteIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  // ---- Edit mode toggling ---------------------------------------------------

  function handleEditClick() {
    if (editMode) {
      setEditMode(false);
      setAddDropdownOpen(false);
    } else {
      // If in dropdown override, clear it first
      setDropdownLeagueId(null);
      setDropdownOpen(false);
      setSearchQuery("");
      setEditMode(true);
    }
  }

  // ---- Dropdown (browse leagues) selection ----------------------------------

  function handleDropdownSelect(id: string) {
    setDropdownLeagueId(id);
    setSearchQuery("");
  }

  function clearDropdownOverride() {
    setDropdownLeagueId(null);
    setDropdownOpen(false);
    setSearchQuery("");
  }

  const selectedLeagueLabel = dropdownLeagueId
    ? LEAGUE_MAP.get(dropdownLeagueId)?.label ?? dropdownLeagueId
    : null;

  return (
    <div className="space-y-2">
      {/* ---- Toolbar row --------------------------------------------------- */}
      <div className="flex items-center justify-between gap-2">
        {/* Browse leagues dropdown trigger */}
        <div className="relative">
          {dropdownLeagueId ? (
            // Selected state: show league name + clear button
            <div className="flex items-center gap-1 rounded-lg border border-ps-border bg-ps-surface px-3 py-1.5 text-sm text-ps-text">
              <span className="max-w-40 truncate">{selectedLeagueLabel}</span>
              <button
                type="button"
                onClick={clearDropdownOverride}
                aria-label="Clear league filter"
                className="ml-1 rounded p-0.5 text-ps-text-ter hover:text-ps-text"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              ref={browseButtonRef}
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-lg border border-ps-border bg-ps-surface px-3 py-1.5 text-sm text-ps-text-sec transition-colors hover:border-ps-border-strong hover:text-ps-text"
              aria-expanded={dropdownOpen}
              aria-haspopup="dialog"
            >
              Browse leagues...
              <ChevronDownIcon
                className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}

          {/* Dropdown popover */}
          {dropdownOpen && !dropdownLeagueId && (
            <LeagueDropdown
              excludeIds={new Set()}
              onSelect={handleDropdownSelect}
              onClose={() => setDropdownOpen(false)}
              triggerRef={browseButtonRef}
            />
          )}
        </div>

        {/* Edit favourites button */}
        <button
          type="button"
          onClick={handleEditClick}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            editMode
              ? "bg-ps-amber text-white hover:bg-ps-amber-deep"
              : "text-ps-text-ter hover:text-ps-text"
          }`}
        >
          {editMode ? "Done" : "Edit favourites"}
        </button>
      </div>

      {/* ---- Favourites bar ------------------------------------------------- */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {favouriteIds.map((id, index) => {
          const league = LEAGUE_MAP.get(id);
          if (!league) return null;

          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index && dragIndex !== index;

          if (editMode) {
            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex shrink-0 cursor-grab items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-all ${
                  isDragging
                    ? "border-ps-amber-deep bg-ps-amber text-white opacity-60"
                    : isDragOver
                    ? "border-ps-amber-deep bg-ps-amber-soft text-ps-amber-deep ring-2 ring-ps-amber"
                    : "border-ps-amber bg-ps-amber-soft text-ps-amber-deep"
                }`}
                aria-label={`Drag to reorder ${league.label}`}
              >
                <DragHandleIcon />
                <span>{league.label}</span>
                <button
                  type="button"
                  onClick={() => removeFavourite(id)}
                  disabled={favouriteIds.length <= 1}
                  aria-label={`Remove ${league.label} from favourites`}
                  className="ml-0.5 rounded-full p-0.5 text-ps-amber-deep transition-colors hover:bg-ps-amber hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <XIcon className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          }

          // Normal mode: pills are indicators, not interactive filters
          return (
            <span
              key={id}
              className={`shrink-0 rounded-full border border-ps-amber bg-ps-amber-soft px-3 py-1 text-xs font-medium text-ps-amber-deep transition-opacity ${
                dropdownLeagueId ? "opacity-50" : ""
              }`}
            >
              {league.label}
            </span>
          );
        })}

        {/* + Add slot in edit mode */}
        {editMode && favouriteIds.length < 6 && (
          <div className="relative shrink-0">
            <button
              ref={addButtonRef}
              type="button"
              onClick={() => setAddDropdownOpen((o) => !o)}
              aria-expanded={addDropdownOpen}
              aria-haspopup="dialog"
              className="flex items-center gap-1 rounded-full border border-dashed border-ps-border px-3 py-1 text-xs text-ps-text-ter transition-colors hover:border-ps-border-strong hover:text-ps-text"
            >
              + Add
            </button>

            {addDropdownOpen && (
              <AddFavouriteDropdown
                favouriteIds={favouriteIds}
                onAdd={(id) => {
                  addFavourite(id);
                  setAddDropdownOpen(false);
                }}
                onClose={() => setAddDropdownOpen(false)}
                triggerRef={addButtonRef}
              />
            )}
          </div>
        )}
      </div>

      {/* ---- Dropdown override banner --------------------------------------- */}
      {dropdownLeagueId && (
        <div className="flex items-center justify-between rounded-lg bg-ps-chip px-3 py-2 text-xs text-ps-text-sec">
          <span>
            Showing: <strong className="text-ps-text">{selectedLeagueLabel}</strong>
          </span>
          <button
            type="button"
            onClick={clearDropdownOverride}
            className="text-ps-amber-deep underline hover:no-underline"
          >
            Return to favourites
          </button>
        </div>
      )}

      {/* ---- Calendar view -------------------------------------------------- */}
      <div
        className={`transition-all ${editMode ? "pointer-events-none opacity-40" : ""}`}
      >
        {/* Loading spinner */}
        {isAnyLoading && (
          <div className="flex items-center gap-2 py-1 text-xs text-ps-text-ter">
            <svg
              className="h-3.5 w-3.5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Loading fixtures...
          </div>
        )}

        {/* Per-league fetch errors */}
        {failedIds.length > 0 && (
          <div className="space-y-1">
            {failedIds.map((id) => {
              const label = LEAGUE_MAP.get(id)?.label ?? id;
              return (
                <div
                  key={id}
                  className="rounded-xl bg-ps-red-soft px-3 py-2 text-xs text-ps-red"
                >
                  {label}: {errors[id]}
                  <button
                    type="button"
                    className="ml-2 underline hover:no-underline"
                    onClick={() => {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                      });
                      setAllFixtures((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                      });
                      setCache((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                      });
                    }}
                  >
                    Retry
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isAnyLoading && activeLeagueIds.length > 0 && !hasAnyFixtures && (
          <div className="rounded-xl border border-dashed border-ps-border py-8 text-center text-sm text-ps-text-ter">
            No upcoming fixtures found.
          </div>
        )}

        {/* Fixture calendar */}
        {hasAnyFixtures && (
          <div className="max-h-[420px] space-y-4 overflow-y-auto pr-0.5">
            {calendarGroups.map((group) => (
              <div key={group.heading}>
                <div className="mb-1.5 border-b border-ps-border pb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-ps-text-sec">
                    {group.heading}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.items.map(({ fixture, leagueId }) => (
                    <FixtureRow
                      key={`${leagueId}-${fixture.external_event_id}`}
                      fixture={fixture}
                      leagueId={leagueId}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
