"use client";

// Design 4: BROADCAST — Sky Sports / ESPN aesthetic
// Usage: /designs/4
// Colors: #0c1428 navy, #cc0000 red, #ffcc00 yellow, #ffffff white, #f0f0f0 light gray

import Link from "next/link";
// useEffect and useRef not needed — ticker uses pure CSS animation
import {
  competition,
  leaderboard,
  events,
  stats,
} from "../mock-data";

// ─── colour tokens ────────────────────────────────────────────────────────────
const C = {
  navy: "#0c1428",
  navyMid: "#111e38",
  navyLight: "#1a2d4e",
  red: "#cc0000",
  redBright: "#ff1a1a",
  yellow: "#ffcc00",
  white: "#ffffff",
  gray: "#f0f0f0",
  grayMid: "#b0b8c8",
  grayDark: "#6b7a99",
  gold: "#ffd700",
  silver: "#c0c0c0",
  bronze: "#cd7f32",
  green: "#00c851",
  greenDark: "#007a32",
};

// ─── helper: sport pill colour ────────────────────────────────────────────────
function sportColor(sport: string): string {
  const map: Record<string, string> = {
    Soccer: "#1565c0",
    "Formula 1": "#b71c1c",
    GAA: "#1b5e20",
    NBA: "#e65100",
    Golf: "#33691e",
  };
  return map[sport] ?? "#37474f";
}

// ─── helper: form dot ─────────────────────────────────────────────────────────
function formColor(f: string) {
  if (f === "W") return C.green;
  if (f === "L") return C.red;
  return C.yellow;
}

// ─── Ticker component ─────────────────────────────────────────────────────────
function BreakingTicker() {
  const items = [
    "ROUND 3 PREDICTIONS NOW OPEN",
    "Davo leads the standings by 3 points",
    "Liverpool vs Arsenal locks in 2 hours",
    "Monaco Grand Prix — Verstappen favourite at 2.1",
    "Wexford vs Kilkenny — Leinster Hurling Championship",
    "Celtics 112–98 Knicks — FULL TIME",
    "Davo on a 5-game winning streak",
    "12 members competing — bragging rights on the line",
    "Nobody predicted the Wexford win over Dublin",
  ];
  const text = items.join("   •   ");

  return (
    <div
      style={{
        background: C.yellow,
        color: C.navy,
        overflow: "hidden",
        height: 32,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: C.red,
          color: C.white,
          fontWeight: 900,
          fontSize: "0.7rem",
          letterSpacing: "0.12em",
          padding: "0 14px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        BREAKING
      </div>
      <div style={{ overflow: "hidden", flex: 1 }}>
        <div
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            fontWeight: 800,
            fontSize: "0.72rem",
            letterSpacing: "0.06em",
            animation: "ticker 40s linear infinite",
            paddingLeft: "100%",
          }}
        >
          {text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}
        </div>
      </div>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse-live {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes flash-gold {
          0%, 100% { background: #ffcc00; }
          50%       { background: #ffd700; }
        }
      `}</style>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeader({
  label,
  sub,
  accent = C.red,
}: {
  label: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{ width: 5, height: 28, background: accent, flexShrink: 0 }}
        />
        <h2
          style={{
            fontSize: "1.35rem",
            fontWeight: 900,
            color: C.white,
            letterSpacing: "-0.01em",
            fontStyle: "italic",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          {label}
        </h2>
        {sub && (
          <span
            style={{
              fontSize: "0.7rem",
              color: C.grayDark,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              alignSelf: "flex-end",
              paddingBottom: 2,
            }}
          >
            {sub}
          </span>
        )}
      </div>
      <div
        style={{
          height: 1,
          background: `linear-gradient(to right, ${accent}, transparent)`,
          marginTop: 6,
          marginLeft: 17,
        }}
      />
    </div>
  );
}

// ─── Upcoming event card ──────────────────────────────────────────────────────
function UpcomingEventCard({ event }: { event: (typeof events)[number] }) {
  const lockTime = new Date(event.lockTime);
  const now = new Date();
  const diffMs = lockTime.getTime() - now.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const countdown =
    diffMs > 0
      ? diffHrs > 0
        ? `${diffHrs}h ${diffMins}m`
        : `${diffMins}m`
      : "LOCKED";

  const total =
    "groupPredictions" in event
      ? Object.values(event.groupPredictions as Record<string, number>).reduce(
          (a, b) => a + b,
          0
        )
      : 0;
  const predictions = event.groupPredictions as Record<string, number>;
  const pEntries = Object.entries(predictions);

  return (
    <div
      style={{
        background: C.navyMid,
        border: `1px solid ${C.navyLight}`,
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: "1rem",
      }}
    >
      {/* Card top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: C.navyLight,
          borderBottom: `1px solid rgba(255,255,255,0.06)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* LIVE badge */}
          <div
            style={{
              background: C.red,
              color: C.white,
              fontSize: "0.6rem",
              fontWeight: 900,
              letterSpacing: "0.12em",
              padding: "3px 7px",
              borderRadius: 2,
              animation: "pulse-live 1.5s ease-in-out infinite",
            }}
          >
            OPEN
          </div>
          {/* Sport pill */}
          <div
            style={{
              background: sportColor(event.sport),
              color: C.white,
              fontSize: "0.6rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "2px 8px",
              borderRadius: 2,
            }}
          >
            {event.sport.toUpperCase()}
          </div>
          <span
            style={{
              fontSize: "0.65rem",
              color: C.grayDark,
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            {event.league}
          </span>
        </div>
        {/* Countdown */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "0.6rem",
              color: C.grayDark,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            LOCKS IN
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "1rem",
              fontWeight: 900,
              color: C.yellow,
              letterSpacing: "0.05em",
            }}
          >
            {countdown}
          </div>
        </div>
      </div>

      {/* Event name */}
      <div style={{ padding: "14px 14px 0" }}>
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: 900,
            color: C.white,
            fontStyle: "italic",
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          {event.name}
        </div>
        <div
          style={{
            fontSize: "0.7rem",
            color: C.grayDark,
            fontWeight: 600,
            letterSpacing: "0.08em",
            marginTop: 4,
          }}
        >
          {new Date(event.startTime).toLocaleDateString("en-GB", {
            weekday: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Pundit Picks bar */}
      {total > 0 && (
        <div style={{ padding: "12px 14px 0" }}>
          <div
            style={{
              fontSize: "0.65rem",
              color: C.yellow,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            PUNDIT PICKS
          </div>
          {/* Stacked bar */}
          <div
            style={{
              display: "flex",
              height: 10,
              borderRadius: 2,
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            {pEntries.map(([key, val], i) => {
              const pct = total > 0 ? (val / total) * 100 : 0;
              const colors = ["#1565c0", "#888", C.red];
              return (
                <div
                  key={key}
                  style={{
                    width: `${pct}%`,
                    background: colors[i % colors.length],
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {pEntries.map(([key, val], i) => {
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              const colors = ["#1565c0", "#888", C.red];
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "0.68rem",
                    color: C.grayMid,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      background: colors[i % colors.length],
                      borderRadius: 1,
                    }}
                  />
                  <span style={{ fontWeight: 700, color: C.white }}>{val}</span>
                  <span style={{ textTransform: "capitalize" }}>{key}</span>
                  <span style={{ color: C.grayDark }}>({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sky Sports Fact File */}
      {"funFacts" in event && Array.isArray(event.funFacts) && (
        <div style={{ padding: "12px 14px 14px" }}>
          <div
            style={{
              border: `1px solid ${C.yellow}`,
              background: "rgba(255,204,0,0.05)",
              borderRadius: 3,
              padding: "8px 12px",
            }}
          >
            <div
              style={{
                fontSize: "0.58rem",
                fontWeight: 900,
                color: C.yellow,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              SKY SPORTS FACT FILE
            </div>
            {(event.funFacts as string[]).slice(0, 2).map((f, i) => (
              <div
                key={i}
                style={{
                  fontSize: "0.72rem",
                  color: C.grayMid,
                  lineHeight: 1.4,
                  marginBottom: i < 1 ? 4 : 0,
                  paddingLeft: 10,
                  borderLeft: `2px solid ${C.yellow}`,
                }}
              >
                {f}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Resulted event card ──────────────────────────────────────────────────────
function ResultedEventCard({ event }: { event: (typeof events)[number] }) {
  const userPred =
    "userPrediction" in event ? event.userPrediction : undefined;
  const isCorrect = userPred?.isCorrect;
  const pts = userPred?.pointsAwarded ?? 0;

  return (
    <div
      style={{
        background: C.navyMid,
        border: `1px solid ${isCorrect ? C.green : C.navyLight}`,
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: "1rem",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: isCorrect
            ? "rgba(0,200,81,0.12)"
            : "rgba(204,0,0,0.10)",
          borderBottom: `1px solid rgba(255,255,255,0.06)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              background: C.red,
              color: C.white,
              fontSize: "0.6rem",
              fontWeight: 900,
              letterSpacing: "0.12em",
              padding: "3px 7px",
              borderRadius: 2,
            }}
          >
            FULL TIME
          </div>
          <div
            style={{
              background: sportColor(event.sport),
              color: C.white,
              fontSize: "0.6rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "2px 8px",
              borderRadius: 2,
            }}
          >
            {event.sport.toUpperCase()}
          </div>
        </div>
        {pts > 0 ? (
          <div
            style={{
              background: C.yellow,
              color: C.navy,
              fontWeight: 900,
              fontSize: "0.7rem",
              letterSpacing: "0.06em",
              padding: "3px 10px",
              borderRadius: 2,
            }}
          >
            +{pts} PTS
          </div>
        ) : (
          <div
            style={{
              background: C.red,
              color: C.white,
              fontWeight: 900,
              fontSize: "0.7rem",
              letterSpacing: "0.06em",
              padding: "3px 10px",
              borderRadius: 2,
            }}
          >
            RED CARD
          </div>
        )}
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 900,
            color: C.white,
            fontStyle: "italic",
            marginBottom: 10,
          }}
        >
          {event.name}
        </div>

        {/* TV scoreboard result */}
        {"result" in event && event.result && (
          <div
            style={{
              background: C.navy,
              borderRadius: 3,
              padding: "10px 14px",
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "0.6rem",
                color: C.red,
                fontWeight: 800,
                letterSpacing: "0.14em",
                marginBottom: 4,
              }}
            >
              RESULT
            </div>
            <div
              style={{
                fontSize: "1.6rem",
                fontWeight: 900,
                color: C.white,
                fontStyle: "italic",
                letterSpacing: "-0.02em",
              }}
            >
              {event.result as string}
            </div>
          </div>
        )}

        {/* Prediction vs actual */}
        {userPred && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div
              style={{
                background: isCorrect
                  ? "rgba(0,200,81,0.1)"
                  : "rgba(204,0,0,0.1)",
                border: `1px solid ${isCorrect ? C.green : C.red}`,
                borderRadius: 3,
                padding: "8px 10px",
              }}
            >
              <div
                style={{
                  fontSize: "0.58rem",
                  color: C.grayDark,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  marginBottom: 3,
                }}
              >
                YOUR PICK
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  color: isCorrect ? C.green : C.red,
                }}
              >
                {userPred.pick}
              </div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid rgba(255,255,255,0.1)`,
                borderRadius: 3,
                padding: "8px 10px",
              }}
            >
              <div
                style={{
                  fontSize: "0.58rem",
                  color: C.grayDark,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  marginBottom: 3,
                }}
              >
                VERDICT
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  color: isCorrect ? C.green : C.grayMid,
                }}
              >
                {isCorrect ? "GOAL!" : "WIDE"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────
function LeaderboardRow({
  entry,
  index,
}: {
  entry: (typeof leaderboard)[number];
  index: number;
}) {
  const rankColor =
    entry.rank === 1
      ? C.gold
      : entry.rank === 2
      ? C.silver
      : entry.rank === 3
      ? C.bronze
      : C.grayDark;

  const movIcon =
    entry.movement > 0 ? "▲" : entry.movement < 0 ? "▼" : "—";
  const movColor =
    entry.movement > 0 ? C.green : entry.movement < 0 ? C.red : C.grayDark;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 80px 80px 100px 40px",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: index % 2 === 0 ? C.navyMid : C.navy,
        borderBottom: `1px solid rgba(255,255,255,0.04)`,
        position: "relative",
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: rankColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: "0.85rem",
          color: entry.rank <= 3 ? C.navy : C.white,
        }}
      >
        {entry.rank}
      </div>

      {/* Name + badges */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: "0.95rem",
              fontWeight: 800,
              color: C.white,
              fontStyle: entry.rank === 1 ? "italic" : "normal",
            }}
          >
            {entry.name}
          </span>
          {entry.rank === 1 && (
            <span
              style={{
                background: C.yellow,
                color: C.navy,
                fontSize: "0.55rem",
                fontWeight: 900,
                letterSpacing: "0.1em",
                padding: "2px 6px",
                borderRadius: 2,
              }}
            >
              TOP SCORER
            </span>
          )}
          {entry.streak >= 3 && entry.streakType === "W" && (
            <span
              style={{
                background: C.green,
                color: C.white,
                fontSize: "0.55rem",
                fontWeight: 900,
                letterSpacing: "0.08em",
                padding: "2px 6px",
                borderRadius: 2,
              }}
            >
              HOT STREAK
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: "0.6rem",
            color: C.grayDark,
            marginTop: 2,
          }}
        >
          {entry.accuracy}% accuracy
        </div>
      </div>

      {/* Points */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "1.35rem",
            fontWeight: 900,
            color: C.yellow,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {entry.points}
        </div>
        <div
          style={{
            fontSize: "0.55rem",
            color: C.grayDark,
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}
        >
          PTS
        </div>
      </div>

      {/* Form dots */}
      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
        {entry.form.map((f, i) => (
          <div
            key={i}
            title={f}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: formColor(f),
            }}
          />
        ))}
      </div>

      {/* W/D/L */}
      <div
        style={{
          display: "flex",
          gap: 6,
          fontSize: "0.68rem",
          justifyContent: "center",
        }}
      >
        <span style={{ color: C.green, fontWeight: 700 }}>{entry.correct}W</span>
        <span style={{ color: C.yellow, fontWeight: 700 }}>{entry.partial}P</span>
        <span style={{ color: C.red, fontWeight: 700 }}>{entry.wrong}L</span>
      </div>

      {/* Movement */}
      <div
        style={{
          textAlign: "right",
          fontWeight: 900,
          fontSize: "0.85rem",
          color: movColor,
        }}
      >
        {movIcon}
        {Math.abs(entry.movement) > 0 && Math.abs(entry.movement)}
      </div>
    </div>
  );
}

// ─── Stat bar ─────────────────────────────────────────────────────────────────
function StatBar({
  label,
  value,
  max,
  color = C.red,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: "0.72rem", color: C.grayMid, fontWeight: 600 }}>
          {label}
        </span>
        <span style={{ fontSize: "0.72rem", color: C.white, fontWeight: 800 }}>
          {value}%
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─── Round bar chart ──────────────────────────────────────────────────────────
const roundData = [
  { round: 1, davo: 18, ger: 16, tommo: 15 },
  { round: 2, davo: 14, ger: 15, tommo: 12 },
  { round: 3, davo: 15, ger: 13, tommo: 14 },
];
const maxRound = 20;

function RoundBarChart() {
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 8,
          fontSize: "0.65rem",
          color: C.grayDark,
        }}
      >
        {[
          { label: "Davo", color: C.yellow },
          { label: "Ger", color: "#1565c0" },
          { label: "Tommo", color: C.red },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
            <div
              style={{ width: 10, height: 10, background: l.color, borderRadius: 1 }}
            />
            <span style={{ fontWeight: 600 }}>{l.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", height: 80 }}>
        {roundData.map((rd) => (
          <div
            key={rd.round}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <div
              style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 64 }}
            >
              {[
                { val: rd.davo, color: C.yellow },
                { val: rd.ger, color: "#1565c0" },
                { val: rd.tommo, color: C.red },
              ].map((b, i) => (
                <div
                  key={i}
                  style={{
                    width: 14,
                    height: `${(b.val / maxRound) * 100}%`,
                    background: b.color,
                    borderRadius: "2px 2px 0 0",
                    minHeight: 4,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontSize: "0.6rem",
                color: C.grayDark,
                fontWeight: 700,
                marginTop: 4,
              }}
            >
              R{rd.round}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Lower third graphic ──────────────────────────────────────────────────────
function LowerThird({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          background: C.red,
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          minWidth: 120,
        }}
      >
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 800,
            color: C.white,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          background: C.navyLight,
          padding: "6px 14px",
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 900,
            color: C.white,
          }}
        >
          {value}
        </span>
        {sub && (
          <span style={{ fontSize: "0.68rem", color: C.grayDark }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── VAR Check panel ──────────────────────────────────────────────────────────
function VarCheck() {
  return (
    <div
      style={{
        border: `2px solid ${C.yellow}`,
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: "1.5rem",
      }}
    >
      <div
        style={{
          background: C.yellow,
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 900,
            color: C.navy,
            letterSpacing: "0.1em",
          }}
        >
          VAR CHECK
        </span>
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: C.navyMid,
          }}
        >
          REVIEWING CLOSE CALLS THIS ROUND
        </span>
      </div>
      <div style={{ background: C.navyMid, padding: "12px 14px" }}>
        <div
          style={{
            fontSize: "0.75rem",
            color: C.grayMid,
            lineHeight: 1.6,
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: C.yellow, fontWeight: 800 }}>
              Robbo on The Masters:
            </span>{" "}
            Picked McIlroy. Scheffler wins by 4. Decision: <span style={{ color: C.red, fontWeight: 700 }}>RED CARD</span>
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: C.yellow, fontWeight: 800 }}>
              Sully on Celtics/Knicks:
            </span>{" "}
            Called Celtics within 12 pts margin. Final margin: 14. Decision:{" "}
            <span style={{ color: C.yellow, fontWeight: 700 }}>PARTIAL</span>
          </div>
          <div>
            <span style={{ color: C.yellow, fontWeight: 800 }}>
              Davo on Celtics/Knicks:
            </span>{" "}
            Celtics, 10–15 pts. Margin was 14. Decision:{" "}
            <span style={{ color: C.green, fontWeight: 700 }}>GOAL!</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Coming Up Next ───────────────────────────────────────────────────────────
function ComingUpNext() {
  return (
    <div
      style={{
        background: C.navyMid,
        border: `1px solid ${C.navyLight}`,
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: "1.5rem",
      }}
    >
      <div
        style={{
          background: C.red,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 900,
            color: C.white,
            letterSpacing: "0.1em",
          }}
        >
          COMING UP NEXT
        </span>
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          ROUND 4 — OPENS FRIDAY
        </span>
      </div>
      <div style={{ padding: "12px 14px" }}>
        {[
          { match: "Man City vs Tottenham", sport: "Soccer", slot: "SATURDAY 12:30" },
          { match: "Canadian Grand Prix", sport: "Formula 1", slot: "SUNDAY 14:00" },
          { match: "Leinster vs Munster", sport: "Rugby", slot: "SATURDAY 17:30" },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 0",
              borderBottom:
                i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  background: sportColor(item.sport),
                  color: C.white,
                  fontSize: "0.55rem",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 2,
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                }}
              >
                {item.sport.toUpperCase()}
              </div>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: C.white,
                }}
              >
                {item.match}
              </span>
            </div>
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                color: C.yellow,
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              {item.slot}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Power Rankings ───────────────────────────────────────────────────────────
const pundits = [
  {
    name: "Davo",
    rank: 1,
    commentary:
      "Five on the bounce. Clinical. Consistent. At this rate, the trophy's already engraved.",
  },
  {
    name: "Ger",
    rank: 2,
    commentary:
      "Three points off the top — dangerous. The F1 rounds could swing this wide open.",
  },
  {
    name: "Tommo",
    rank: 3,
    commentary:
      "Lucky tiebreakers masking an underlying wobble. Three Ls in his last five.",
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BroadcastDesign() {
  const upcomingEvents = events.filter((e) => e.status === "upcoming");
  const resultedEvents = events.filter((e) => e.status === "resulted");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.navy,
        color: C.white,
        fontFamily:
          "'Arial Narrow', 'Arial', 'Helvetica Neue', Helvetica, sans-serif",
      }}
    >
      {/* ── TOP RED ACCENT BAR ── */}
      <div style={{ height: 4, background: C.red }} />

      {/* ── HEADER ── */}
      <header
        style={{
          background: C.navy,
          borderBottom: `2px solid ${C.red}`,
          padding: "0 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Logo */}
            <div
              style={{
                background: C.red,
                padding: "6px 14px",
                borderRadius: 3,
              }}
            >
              <span
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 900,
                  color: C.white,
                  letterSpacing: "-0.02em",
                  fontStyle: "italic",
                }}
              >
                BROADCAST
              </span>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 800,
                  color: C.white,
                  letterSpacing: "0.02em",
                  fontStyle: "italic",
                }}
              >
                {competition.name}
              </div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: C.yellow,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                }}
              >
                {competition.round.name.toUpperCase()} — {competition.memberCount} PUNDITS
              </div>
            </div>
          </div>

          {/* Time-slot branding */}
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "0.65rem",
                color: C.grayDark,
                fontWeight: 700,
                letterSpacing: "0.1em",
              }}
            >
              LIVE COVERAGE
            </div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 900,
                color: C.yellow,
                fontStyle: "italic",
                letterSpacing: "-0.01em",
              }}
            >
              SUPER SUNDAY
            </div>
            <div
              style={{
                fontSize: "0.6rem",
                color: C.grayDark,
                fontWeight: 600,
              }}
            >
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
        </div>
      </header>

      {/* ── BREAKING TICKER ── */}
      <BreakingTicker />

      {/* ── PROGRAMME TITLE CARD ── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${C.navyMid} 0%, ${C.navy} 100%)`,
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
          padding: "20px",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 16,
            }}
          >
            {[
              { label: "COMPETITION", value: competition.name, sub: competition.round.name },
              { label: "PREDICTIONS OPEN", value: `${events.filter(e => e.status === "upcoming").length} EVENTS`, sub: "Locks rolling" },
              { label: "LEADER", value: `${leaderboard[0].name} — ${leaderboard[0].points} pts`, sub: `${leaderboard[0].streak} game streak` },
              { label: "ROUND DEADLINE", value: "50h 00m", sub: "Wexford vs Kilkenny" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: C.navyLight,
                  borderRadius: 3,
                  padding: "12px 14px",
                  borderLeft: `3px solid ${C.red}`,
                }}
              >
                <div
                  style={{
                    fontSize: "0.58rem",
                    color: C.grayDark,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 900,
                    color: C.white,
                    lineHeight: 1.2,
                  }}
                >
                  {item.value}
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: C.yellow,
                    fontWeight: 600,
                    marginTop: 3,
                  }}
                >
                  {item.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 20px",
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* ── LEFT COLUMN ── */}
        <div>

          {/* MATCH CENTRE */}
          <section style={{ marginBottom: "2rem" }}>
            <SectionHeader label="Match Centre" sub="Round 3 — Open for Predictions" />
            {upcomingEvents.map((e) => (
              <UpcomingEventCard key={e.id} event={e} />
            ))}
          </section>

          {/* RESULTS */}
          <section style={{ marginBottom: "2rem" }}>
            <SectionHeader label="Results" sub="Your prediction vs actual" accent={C.yellow} />
            {resultedEvents.map((e) => (
              <ResultedEventCard key={e.id} event={e} />
            ))}
          </section>

          {/* VAR CHECK */}
          <section style={{ marginBottom: "2rem" }}>
            <SectionHeader label="VAR Check" sub="Close Calls This Round" accent={C.yellow} />
            <VarCheck />
          </section>

          {/* COMING UP NEXT */}
          <section style={{ marginBottom: "2rem" }}>
            <SectionHeader label="Coming Up Next" sub="Round 4 Preview" />
            <ComingUpNext />
          </section>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div>

          {/* SUPER SUNDAY STANDINGS */}
          <section style={{ marginBottom: "2rem" }}>
            <SectionHeader label="Super Sunday Standings" sub="Top 6" />

            {/* Leaderboard table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 80px 80px 100px 40px",
                gap: 12,
                padding: "6px 14px",
                background: C.navyLight,
                borderBottom: `2px solid ${C.red}`,
              }}
            >
              {["#", "PUNDIT", "PTS", "FORM", "W/P/L", "MV"].map((h) => (
                <div
                  key={h}
                  style={{
                    fontSize: "0.55rem",
                    fontWeight: 800,
                    color: C.grayDark,
                    letterSpacing: "0.1em",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            {leaderboard.map((entry, i) => (
              <LeaderboardRow key={entry.name} entry={entry} index={i} />
            ))}

            {/* Pundit verdict */}
            <div
              style={{
                background: C.navyLight,
                borderTop: `2px solid ${C.red}`,
                padding: "10px 14px",
              }}
            >
              <div
                style={{
                  fontSize: "0.6rem",
                  color: C.red,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  marginBottom: 4,
                }}
              >
                PUNDIT VERDICT
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: C.grayMid,
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                &ldquo;{stats.closestRace} — a Super Sunday could change everything.&rdquo;
              </div>
            </div>
          </section>

          {/* THE ANALYSIS */}
          <section style={{ marginBottom: "2rem" }}>
            <SectionHeader label="The Analysis" sub="Match of the Day Stats" />

            <div
              style={{
                background: C.navyMid,
                border: `1px solid ${C.navyLight}`,
                borderRadius: 4,
                overflow: "hidden",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  background: C.red,
                  padding: "8px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 900,
                    color: C.white,
                    letterSpacing: "0.1em",
                  }}
                >
                  MATCH OF THE DAY
                </div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 900,
                    color: C.white,
                    fontStyle: "italic",
                  }}
                >
                  Celtics 112–98 Knicks
                </div>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: C.grayMid,
                    lineHeight: 1.5,
                    marginBottom: 10,
                  }}
                >
                  9 of 12 pundits called Celtics. Only Davo nailed the exact margin bracket. Nobody called Knicks — smart money won today.
                </div>

                {/* Two-column comparison */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      background: C.navyLight,
                      borderRadius: 3,
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.58rem",
                        color: C.grayDark,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        marginBottom: 4,
                      }}
                    >
                      CELTICS BACKERS
                    </div>
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 900,
                        color: C.green,
                        lineHeight: 1,
                      }}
                    >
                      9
                    </div>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        color: C.grayDark,
                      }}
                    >
                      75% of group
                    </div>
                  </div>
                  <div
                    style={{
                      background: C.navyLight,
                      borderRadius: 3,
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.58rem",
                        color: C.grayDark,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        marginBottom: 4,
                      }}
                    >
                      KNICKS BACKERS
                    </div>
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 900,
                        color: C.red,
                        lineHeight: 1,
                      }}
                    >
                      3
                    </div>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        color: C.grayDark,
                      }}
                    >
                      25% of group
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* xPredictions */}
            <div
              style={{
                background: C.navyMid,
                border: `1px solid ${C.navyLight}`,
                borderRadius: 4,
                padding: "12px 14px",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 900,
                  color: C.yellow,
                  letterSpacing: "0.12em",
                  marginBottom: 10,
                }}
              >
                xPREDICTIONS — EXPECTED vs ACTUAL
              </div>
              <LowerThird label="xP Leader" value="Davo" sub="Expected 42, got 47 (+5)" />
              <LowerThird label="Underperformer" value="Robbo" sub="Expected 38, got 35 (−3)" />
              <LowerThird label="Surprise Pick" value="Sully" sub="+2 vs expectation" />
            </div>

            {/* Accuracy by sport */}
            <div
              style={{
                background: C.navyMid,
                border: `1px solid ${C.navyLight}`,
                borderRadius: 4,
                padding: "12px 14px",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 900,
                  color: C.yellow,
                  letterSpacing: "0.12em",
                  marginBottom: 10,
                }}
              >
                GROUP ACCURACY BY SPORT
              </div>
              <StatBar label="Soccer" value={62} max={100} color="#1565c0" />
              <StatBar label="Formula 1" value={54} max={100} color={C.red} />
              <StatBar label="GAA" value={48} max={100} color="#1b5e20" />
              <StatBar label="NBA" value={71} max={100} color="#e65100" />
              <StatBar label="Golf" value={33} max={100} color="#33691e" />
            </div>

            {/* Round by round trend */}
            <div
              style={{
                background: C.navyMid,
                border: `1px solid ${C.navyLight}`,
                borderRadius: 4,
                padding: "12px 14px",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 900,
                  color: C.yellow,
                  letterSpacing: "0.12em",
                  marginBottom: 10,
                }}
              >
                ROUND-BY-ROUND POINTS (TOP 3)
              </div>
              <RoundBarChart />
            </div>
          </section>

          {/* POWER RANKINGS */}
          <section style={{ marginBottom: "2rem" }}>
            <SectionHeader label="Power Rankings" sub="Pundit Analysis" accent={C.yellow} />
            {pundits.map((p, i) => (
              <div
                key={p.name}
                style={{
                  background: C.navyMid,
                  border: `1px solid ${C.navyLight}`,
                  borderRadius: 4,
                  padding: "12px 14px",
                  marginBottom: 8,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background:
                      i === 0 ? C.gold : i === 1 ? C.silver : C.bronze,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: "1rem",
                    color: C.navy,
                    flexShrink: 0,
                  }}
                >
                  {p.rank}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 900,
                      color: C.white,
                      marginBottom: 3,
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: C.grayMid,
                      fontStyle: "italic",
                      lineHeight: 1.4,
                    }}
                  >
                    &ldquo;{p.commentary}&rdquo;
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* STREAK HIGHLIGHTS */}
          <section style={{ marginBottom: "2rem" }}>
            <SectionHeader label="Streak Watch" sub="Form Guide" accent={C.green} />
            <div
              style={{
                background: C.navyMid,
                border: `1px solid ${C.navyLight}`,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              {leaderboard
                .filter((e) => e.streak >= 2)
                .map((entry, i, arr) => (
                  <div
                    key={entry.name}
                    style={{
                      padding: "10px 14px",
                      borderBottom:
                        i < arr.length - 1
                          ? `1px solid rgba(255,255,255,0.05)`
                          : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 800,
                          color: C.white,
                        }}
                      >
                        {entry.name}
                      </span>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: C.grayDark,
                          marginTop: 2,
                        }}
                      >
                        {entry.funFact}
                      </div>
                    </div>
                    <div
                      style={{
                        background:
                          entry.streakType === "W" ? C.green : C.red,
                        color: C.white,
                        fontWeight: 900,
                        fontSize: "0.7rem",
                        padding: "4px 10px",
                        borderRadius: 2,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.streak} {entry.streakType === "W" ? "WIN" : "LOSS"} STREAK
                    </div>
                  </div>
                ))}
            </div>
          </section>

        </div>
      </div>

      {/* ── BOTTOM TICKER ── */}
      <div style={{ borderTop: `2px solid ${C.red}` }}>
        <BreakingTicker />
      </div>

      {/* ── FOOTER ── */}
      <footer
        style={{
          background: C.navyMid,
          borderTop: `1px solid rgba(255,255,255,0.08)`,
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/designs"
            style={{
              color: C.grayDark,
              textDecoration: "none",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: C.red, fontSize: "0.9rem" }}>&#8592;</span>
            BACK TO DESIGNS
          </Link>
          <div
            style={{
              fontSize: "0.65rem",
              color: C.grayDark,
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            PREDICTSPORT — BROADCAST CONCEPT — Design 4 of 7
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: C.grayDark,
              fontWeight: 600,
            }}
          >
            {competition.memberCount} PUNDITS — {stats.totalPredictions} PREDICTIONS
          </div>
        </div>
      </footer>
    </div>
  );
}
