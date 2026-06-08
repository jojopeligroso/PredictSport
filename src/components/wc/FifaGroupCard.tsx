import { CountryFlag } from "@/components/CountryFlag";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import { HOST_CITIES, type HostCitySlug } from "@/lib/wc/host-cities";
import type { TeamWithStats } from "@/lib/tournament/bracket/types";

/**
 * Maps each FIFA WC2026 group to a host-city colour for visual identity.
 * Chosen for maximum contrast between adjacent cards in a 3-column grid.
 */
const GROUP_CITY: Record<string, HostCitySlug> = {
  A: "mexico-city",       // #8C4DFC purple
  B: "toronto",           // #3D4EFF blue
  C: "san-francisco-bay-area", // #E0421A red-orange
  D: "dallas",            // #0E5C66 dark teal
  E: "houston",           // #2497F1 bright blue
  F: "seattle",           // #97961B olive
  G: "miami",             // #EE6FA6 pink
  H: "atlanta",           // #00B5C8 cyan
  I: "boston",             // #218521 green
  J: "philadelphia",      // #1F3CAB navy
  K: "kansas-city",       // #FB2350 hot pink
  L: "guadalajara",       // #DA2363 magenta
};

interface FifaGroupCardProps {
  groupId: string;
  teams: string[];
  /** When true, a gold ring highlights the expanded card (accordion mode). */
  isExpanded?: boolean;
  /** Standings data — when provided, teams are reordered by position and Pts shown. */
  standings?: TeamWithStats[];
}

export function FifaGroupCard({
  groupId,
  teams,
  isExpanded,
  standings,
}: FifaGroupCardProps) {
  const citySlug = GROUP_CITY[groupId] ?? "atlanta";
  const cityColor = HOST_CITIES[citySlug].color;

  return (
    <div
      className={[
        "overflow-hidden rounded-xl text-white transition-all",
        isExpanded
          ? "shadow-[0_0_0_2px_white,0_0_0_4px_rgba(212,175,55,0.8),0_1px_3px_rgba(0,0,0,0.2)]"
          : "shadow-sm",
      ].join(" ")}
      style={{ backgroundColor: cityColor }}
    >
      <div className="px-2.5 pt-2 pb-0.5">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/80">
          Group {groupId}
        </p>
      </div>
      <div className="px-2.5 pb-2">
        {(standings ?? teams.map((t) => ({ name: t }))).map((entry) => {
          const team = typeof entry === "string" ? entry : entry.name;
          const pts = standings ? (entry as TeamWithStats).points : null;
          return (
            <div
              key={team}
              className="flex items-center gap-1.5 py-[3px]"
            >
              <CountryFlag name={team} size={14} shape="pill" />
              <span className="flex-1 font-mono text-[10px] font-semibold text-white/90">
                {fifaTrigram(team) ?? team.slice(0, 3).toUpperCase()}
              </span>
              {pts !== null && (
                <span className="font-mono text-[10px] font-bold tabular-nums text-white">
                  {pts}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
