"use client";

import Link from "next/link";
import {
  Avatar,
  FormBadge,
  SectionHeader,
  PersonaCallout,
  SPORT_CONFIG,
  type SportKey,
  toSportKey,
} from "@/components/ui";

const AVATAR_PALETTE = [
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#0aa86d",
  "#e23d4f",
  "#0ea5e9",
  "#d97706",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface PersonPrediction {
  id: string;
  eventName: string;
  sport: string;
  pickValue: string;
  resultValue: string;
  isCorrect: boolean | null;
  isPartial: boolean;
  pointsAwarded: number;
}

interface PersonDetailProps {
  person: { id: string; displayName: string; calloutLabel: string };
  competitionName: string;
  rank: number;
  totalPoints: number;
  accuracy: number;
  streak: number;
  form: Array<"W" | "L" | "P">;
  predictions: PersonPrediction[];
}

export function PersonDetail({
  person,
  competitionName,
  rank,
  totalPoints,
  accuracy,
  streak,
  form,
  predictions,
}: PersonDetailProps) {
  const color = avatarColor(person.id);
  const initials = getInitials(person.displayName);

  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Hero */}
      <div
        style={{
          position: "relative",
          background: `linear-gradient(160deg, ${color}, ${color}88 70%, transparent)`,
          padding: "16px 16px 30px",
        }}
      >
        <Link
          href="/leaderboard"
          className="flex items-center justify-center rounded-full"
          style={{ width: 32, height: 32, background: "rgba(255,255,255,0.22)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18l-6-6 6-6"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <div className="mt-3.5 flex items-center gap-3.5">
          <Avatar
            initials={initials}
            color={color}
            size={64}
            ring="0 0 0 2px rgba(255,255,255,0.45)"
          />
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Rank &middot; #{rank}
            </p>
            <h1
              className="mt-1 font-display"
              style={{ fontSize: 36, lineHeight: 1, color: "#fff", letterSpacing: 0.6 }}
            >
              {person.displayName}
            </h1>
            <p
              className="mt-1"
              style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontStyle: "italic" }}
            >
              &ldquo;{person.calloutLabel}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="mx-4 -mt-4.5 grid grid-cols-3 gap-2">
        {[
          { label: "Points", val: String(totalPoints), color: "var(--ps-amber-deep)" },
          { label: "Accuracy", val: `${accuracy}%`, color: "var(--ps-green)" },
          { label: "Streak", val: streak > 0 ? `${streak}W` : "\u2014", color: "var(--ps-blue)" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-ps-border bg-ps-surface py-2.5 px-2 text-center"
            style={{ boxShadow: "0 4px 14px rgba(40,30,20,0.06)" }}
          >
            <p
              style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase" }}
              className="text-ps-text-sec"
            >
              {s.label}
            </p>
            <p className="mt-0.5 font-display" style={{ fontSize: 22, letterSpacing: 0.5, color: s.color }}>
              {s.val}
            </p>
          </div>
        ))}
      </div>

      {/* Last 5 form */}
      {form.length > 0 && (
        <div className="px-4 mt-4">
          <SectionHeader label="Last 5" />
          <div className="mt-2 flex gap-2">
            {form.map((f, i) => (
              <FormBadge key={i} letter={f} size={36} />
            ))}
          </div>
        </div>
      )}

      {/* Picks vs Results */}
      <div className="px-4 mt-5">
        <SectionHeader label="Picks vs Results" accent="var(--ps-violet)" />
        {predictions.length === 0 ? (
          <div className="mt-3 rounded-[14px] border border-ps-border bg-ps-surface p-8 text-center text-sm text-ps-text-sec">
            No resulted predictions yet
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-[14px] border border-ps-border bg-ps-surface">
            {predictions.map((p, i) => {
              const sportKey = toSportKey(p.sport);
              const sportCfg = SPORT_CONFIG[sportKey];
              const stateColor =
                p.isCorrect === true
                  ? "var(--ps-green)"
                  : p.isPartial
                    ? "var(--ps-amber-deep)"
                    : "var(--ps-red)";
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-3 py-2.5"
                  style={{
                    borderBottom: i < predictions.length - 1 ? "1px solid var(--ps-border)" : "none",
                  }}
                >
                  <span className="w-[22px] text-center text-base">{sportCfg.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold leading-snug text-ps-text">
                      {p.eventName}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-ps-text-sec">
                      {p.pickValue} <span className="text-ps-text-ter">vs</span> {p.resultValue}
                    </p>
                  </div>
                  <span
                    className="text-[11px] font-extrabold tabular-nums"
                    style={{ color: stateColor }}
                  >
                    +{p.pointsAwarded}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fun fact callout */}
      <div className="px-4 mt-5 mb-4">
        <PersonaCallout
          calloutLabel="Fun fact"
          fact={`${person.displayName} has been on a tear lately${streak > 2 ? ` \u2014 ${streak} correct in a row` : ""}.`}
          variant="border"
        />
      </div>
    </div>
  );
}
