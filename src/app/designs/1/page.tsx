// Design 1 — "Matchday" — Premier League broadcast aesthetic
// Usage: visit /designs/1 to preview this concept

import Link from "next/link";
import {
  competition,
  leaderboard,
  events,
  stats,
  sportEmoji,
} from "../mock-data";

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  purple: "#37003c",
  purpleMid: "#4e0055",
  purpleLight: "#6b006e",
  cyan: "#00ff87",
  cyanDim: "#00cc6a",
  white: "#ffffff",
  offWhite: "#f0f0f0",
  dark: "#2d2d2d",
  darker: "#1a1a1a",
  black: "#0a0a0a",
  gold: "#ffd700",
  silver: "#c0c0c0",
  bronze: "#cd7f32",
  green: "#00c853",
  amber: "#ffa000",
  red: "#d50000",
  liveRed: "#e53935",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCountdown(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "LOCKED";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function sportAccent(sport: string): string {
  const map: Record<string, string> = {
    Soccer: C.cyan,
    "Formula 1": "#e10600",
    GAA: "#3ddc84",
    NBA: "#f97316",
    Golf: "#84cc16",
  };
  return map[sport] ?? C.cyan;
}

function formDotColor(result: string): string {
  if (result === "W") return C.green;
  if (result === "P") return C.amber;
  return C.red;
}

function movementIcon(mv: number): string {
  if (mv > 0) return "▲";
  if (mv < 0) return "▼";
  return "—";
}

function movementColor(mv: number): string {
  if (mv > 0) return C.green;
  if (mv < 0) return C.red;
  return "#666";
}

function rankBackground(rank: number): string {
  if (rank === 1) return "rgba(255,215,0,0.08)";
  if (rank === 2) return "rgba(192,192,192,0.06)";
  if (rank === 3) return "rgba(205,127,50,0.06)";
  return "transparent";
}

function rankBorderColor(rank: number): string {
  if (rank === 1) return C.gold;
  if (rank === 2) return C.silver;
  if (rank === 3) return C.bronze;
  return "transparent";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: C.liveRed,
        color: C.white,
        fontSize: "0.6rem",
        fontWeight: 800,
        letterSpacing: "0.12em",
        padding: "2px 7px",
        borderRadius: 3,
        textTransform: "uppercase" as const,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: C.white,
          display: "inline-block",
          animation: "pulse 1s infinite",
        }}
      />
      LIVE
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: "1.25rem",
      }}
    >
      <span
        style={{
          fontSize: "0.7rem",
          fontWeight: 900,
          letterSpacing: "0.18em",
          textTransform: "uppercase" as const,
          color: C.cyan,
        }}
      >
        {children}
      </span>
      <div
        style={{
          flex: 1,
          height: 1,
          background: "linear-gradient(to right, #ffffff22, transparent)",
        }}
      />
    </div>
  );
}

function DidYouKnow({ fact }: { fact: string }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${C.purple} 0%, ${C.purpleMid} 100%)`,
        border: `1px solid ${C.cyan}44`,
        borderLeft: `3px solid ${C.cyan}`,
        borderRadius: 6,
        padding: "0.65rem 0.9rem",
        marginTop: "0.65rem",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>💡</span>
      <span
        style={{
          fontSize: "0.78rem",
          color: C.offWhite,
          lineHeight: 1.5,
          opacity: 0.9,
        }}
      >
        <strong style={{ color: C.cyan, marginRight: 4 }}>DID YOU KNOW?</strong>
        {fact}
      </span>
    </div>
  );
}

function GroupSaysBar({
  predictions,
  sport,
}: {
  predictions: Record<string, number>;
  sport: string;
}) {
  const total = Object.values(predictions).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const accent = sportAccent(sport);

  const labels: Record<string, string> = {
    home: "Home",
    draw: "Draw",
    away: "Away",
    verstappen: "VER",
    leclerc: "LEC",
    norris: "NOR",
  };

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "#aaa",
          textTransform: "uppercase" as const,
          marginBottom: 6,
        }}
      >
        THE GROUP SAYS
      </div>
      <div
        style={{
          display: "flex",
          borderRadius: 4,
          overflow: "hidden",
          height: 8,
          gap: 2,
        }}
      >
        {Object.entries(predictions).map(([key, count]) => (
          <div
            key={key}
            style={{
              flex: count,
              background:
                key === "home" || key === "verstappen"
                  ? accent
                  : key === "draw"
                    ? "#666"
                    : "#ff4444",
              borderRadius: 2,
            }}
            title={`${labels[key] ?? key}: ${count}`}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 5,
        }}
      >
        {Object.entries(predictions).map(([key, count]) => (
          <span
            key={key}
            style={{ fontSize: "0.7rem", color: "#aaa" }}
          >
            <strong style={{ color: C.white }}>{count}</strong> {labels[key] ?? key}
          </span>
        ))}
      </div>
    </div>
  );
}

function PredictionButtons({ sport }: { sport: string }) {
  const accent = sportAccent(sport);
  const options =
    sport === "Formula 1"
      ? ["Verstappen", "Leclerc", "Norris"]
      : sport === "Golf"
        ? ["Scheffler", "McIlroy", "Morikawa"]
        : ["Home", "Draw", "Away"];

  return (
    <div style={{ marginTop: "0.9rem" }}>
      <div
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "#aaa",
          textTransform: "uppercase" as const,
          marginBottom: 8,
        }}
      >
        YOUR PREDICTION
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {options.map((opt, i) => (
          <button
            key={opt}
            style={{
              flex: 1,
              padding: "0.55rem 0",
              borderRadius: 5,
              border: `1.5px solid ${i === 0 ? accent : "#444"}`,
              background: i === 0 ? `${accent}22` : "transparent",
              color: i === 0 ? accent : "#888",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              cursor: "pointer",
              textTransform: "uppercase" as const,
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultBadge({ correct, points }: { correct: boolean; points: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: "0.75rem",
        padding: "0.55rem 0.8rem",
        borderRadius: 6,
        background: correct ? "rgba(0,200,83,0.1)" : "rgba(213,0,0,0.1)",
        border: `1px solid ${correct ? C.green : C.red}44`,
      }}
    >
      <span style={{ fontSize: "1.1rem" }}>{correct ? "✅" : "❌"}</span>
      <span
        style={{
          fontSize: "0.8rem",
          fontWeight: 700,
          color: correct ? C.green : C.red,
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
        }}
      >
        {correct ? "Correct" : "Wrong pick"}
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: "0.75rem",
          color: "#aaa",
        }}
      >
        {points > 0 ? (
          <span style={{ color: C.cyan, fontWeight: 800 }}>+{points} pts</span>
        ) : (
          "0 pts"
        )}
      </span>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: (typeof events)[number] }) {
  const accent = sportAccent(event.sport);
  const isResulted = event.status === "resulted";
  const countdown = formatCountdown(event.lockTime);
  const emoji = sportEmoji[event.sport] ?? "🏆";

  return (
    <div
      style={{
        background: "#161616",
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #2a2a2a",
        position: "relative" as const,
      }}
    >
      {/* Sport colour strip at top */}
      <div
        style={{
          height: 4,
          background: `linear-gradient(to right, ${accent}, ${accent}66)`,
        }}
      />

      <div style={{ padding: "1.1rem 1.25rem 1.25rem" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "0.6rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: "0.7rem",
              color: "#888",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>{emoji}</span>
            {event.league}
          </div>
          {isResulted ? (
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#666",
                textTransform: "uppercase" as const,
                padding: "2px 7px",
                border: "1px solid #333",
                borderRadius: 3,
              }}
            >
              RESULTED
            </span>
          ) : (
            <LiveBadge />
          )}
        </div>

        {/* Event name */}
        <h3
          style={{
            fontSize: "1.25rem",
            fontWeight: 900,
            color: C.white,
            letterSpacing: "-0.01em",
            margin: "0 0 0.3rem",
            lineHeight: 1.15,
          }}
        >
          {event.name}
        </h3>

        {/* Countdown or result */}
        {isResulted ? (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#aaa",
              marginBottom: "0.25rem",
            }}
          >
            Final:{" "}
            <strong style={{ color: C.white }}>
              {"result" in event ? event.result : "—"}
            </strong>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ fontSize: "0.7rem", color: "#666" }}>
              LOCKS IN
            </span>
            <span
              style={{
                fontSize: "1rem",
                fontWeight: 900,
                color: accent,
                letterSpacing: "0.04em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {countdown}
            </span>
          </div>
        )}

        {/* Fun facts */}
        {"funFacts" in event && event.funFacts.length > 0 && (
          <DidYouKnow fact={event.funFacts[0]} />
        )}

        {/* Group says */}
        <GroupSaysBar predictions={event.groupPredictions as Record<string, number>} sport={event.sport} />

        {/* Prediction input or result */}
        {isResulted && "userPrediction" in event && event.userPrediction ? (
          <ResultBadge
            correct={event.userPrediction.isCorrect}
            points={event.userPrediction.pointsAwarded}
          />
        ) : (
          !isResulted && <PredictionButtons sport={event.sport} />
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({ entry, isMe }: { entry: (typeof leaderboard)[number]; isMe: boolean }) {
  const rankColors: Record<number, string> = {
    1: C.gold,
    2: C.silver,
    3: C.bronze,
  };
  const rankColor = rankColors[entry.rank] ?? "#555";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 40px 1fr 80px 90px 32px",
        alignItems: "center",
        gap: "0 10px",
        padding: "0.7rem 1rem",
        background: isMe ? `${C.cyan}0a` : rankBackground(entry.rank),
        borderBottom: "1px solid #1e1e1e",
        borderLeft: `3px solid ${isMe ? C.cyan : rankBorderColor(entry.rank)}`,
        position: "relative" as const,
      }}
    >
      {/* Rank */}
      <span
        style={{
          fontWeight: 900,
          fontSize: "0.95rem",
          color: rankColor,
          letterSpacing: "-0.01em",
        }}
      >
        {entry.rank}
      </span>

      {/* Avatar */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.purple} 0%, ${C.purpleMid} 100%)`,
          border: `2px solid ${rankColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.85rem",
          fontWeight: 800,
          color: C.white,
        }}
      >
        {entry.avatar}
      </div>

      {/* Name + form + fun fact */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: "0.95rem",
              color: C.white,
            }}
          >
            {entry.name}
          </span>
          {entry.streak >= 3 && entry.streakType === "W" && (
            <span
              style={{
                fontSize: "0.65rem",
                background: "rgba(255,100,0,0.15)",
                border: "1px solid #ff640044",
                color: "#ff9a00",
                borderRadius: 3,
                padding: "1px 5px",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              🔥 HOT
            </span>
          )}
        </div>
        {/* Form guide dots */}
        <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
          {entry.form.map((f, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: formDotColor(f),
              }}
              title={f === "W" ? "Correct" : f === "P" ? "Partial" : "Wrong"}
            />
          ))}
        </div>
      </div>

      {/* Accuracy % */}
      <div style={{ textAlign: "center" as const }}>
        <div
          style={{
            fontSize: "0.7rem",
            color: "#555",
            letterSpacing: "0.06em",
            marginBottom: 2,
          }}
        >
          ACC
        </div>
        <div
          style={{
            fontSize: "0.9rem",
            fontWeight: 700,
            color: entry.accuracy >= 50 ? C.green : "#aaa",
          }}
        >
          {entry.accuracy}%
        </div>
      </div>

      {/* Points */}
      <div style={{ textAlign: "right" as const }}>
        <div
          style={{
            fontSize: "1.3rem",
            fontWeight: 900,
            color: C.white,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {entry.points}
          <span
            style={{
              fontSize: "0.65rem",
              color: "#555",
              fontWeight: 600,
              letterSpacing: "0.05em",
              marginLeft: 2,
            }}
          >
            PTS
          </span>
        </div>
      </div>

      {/* Movement */}
      <div
        style={{
          textAlign: "center" as const,
          fontSize: "0.75rem",
          fontWeight: 800,
          color: movementColor(entry.movement),
        }}
      >
        {movementIcon(entry.movement)}
      </div>
    </div>
  );
}

// ─── Accuracy bar chart ───────────────────────────────────────────────────────

function AccuracyChart() {
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
      {leaderboard.map((entry) => (
        <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 45,
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#aaa",
              flexShrink: 0,
              textAlign: "right" as const,
            }}
          >
            {entry.name}
          </span>
          <div
            style={{
              flex: 1,
              height: 16,
              background: "#1e1e1e",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${entry.accuracy}%`,
                background:
                  entry.accuracy >= 55
                    ? `linear-gradient(to right, ${C.cyan}, ${C.cyanDim})`
                    : entry.accuracy >= 45
                      ? `linear-gradient(to right, #ffa000, #e65100)`
                      : `linear-gradient(to right, #d50000, #b71c1c)`,
                borderRadius: 4,
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <span
            style={{
              width: 36,
              fontSize: "0.75rem",
              fontWeight: 700,
              color: C.white,
              flexShrink: 0,
            }}
          >
            {entry.accuracy}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Points race sparkline (CSS-only) ────────────────────────────────────────

function PointsRace() {
  // Mock trend data — 3 rounds of progress
  const trendData = [
    { name: "Davo", rounds: [14, 28, 47], color: C.cyan },
    { name: "Ger", rounds: [10, 27, 44], color: C.gold },
    { name: "Tommo", rounds: [12, 25, 41], color: "#ff6b6b" },
  ];
  const maxPts = 50;

  return (
    <div style={{ position: "relative" as const }}>
      {trendData.map((player) => (
        <div
          key={player.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              width: 45,
              fontSize: "0.75rem",
              fontWeight: 700,
              color: player.color,
              flexShrink: 0,
              textAlign: "right" as const,
            }}
          >
            {player.name}
          </span>
          <div style={{ flex: 1, display: "flex", gap: 4, alignItems: "flex-end", height: 30 }}>
            {player.rounds.map((pts, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${(pts / maxPts) * 100}%`,
                  minHeight: 4,
                  background:
                    i === player.rounds.length - 1
                      ? player.color
                      : `${player.color}55`,
                  borderRadius: "2px 2px 0 0",
                  position: "relative" as const,
                }}
              />
            ))}
          </div>
          <span
            style={{
              width: 36,
              fontSize: "0.8rem",
              fontWeight: 900,
              color: player.color,
              flexShrink: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {player.rounds[player.rounds.length - 1]}
          </span>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          paddingLeft: 55,
          paddingRight: 36,
          gap: 4,
          marginTop: 4,
        }}
      >
        {["R1", "R2", "R3"].map((r) => (
          <span
            key={r}
            style={{
              flex: 1,
              textAlign: "center" as const,
              fontSize: "0.6rem",
              color: "#444",
              letterSpacing: "0.06em",
            }}
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Confidence meter ─────────────────────────────────────────────────────────

function ConfidenceMeter({ value, label }: { value: number; label: string }) {
  const segments = 10;
  return (
    <div>
      <div
        style={{
          fontSize: "0.65rem",
          color: "#666",
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 2,
              background:
                i < Math.round(value / 10)
                  ? i < 3
                    ? C.red
                    : i < 7
                      ? C.amber
                      : C.green
                  : "#222",
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontSize: "0.6rem",
          color: "#444",
        }}
      >
        <span>LOW</span>
        <span style={{ color: C.cyan, fontWeight: 700 }}>{value}%</span>
        <span>HIGH</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchdayDesignPage() {
  const upcomingEvents = events.filter((e) => e.status === "upcoming");
  const resultedEvents = events.filter((e) => e.status === "resulted");
  const roundProgress = Math.round(
    (stats.eventsResulted / stats.totalEvents) * 100
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.black,
        color: C.white,
        fontFamily:
          "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* ── Back nav ──────────────────────────────────────────────────── */}
      <div
        style={{
          background: C.darker,
          borderBottom: "1px solid #222",
          padding: "0.6rem 1.5rem",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          href="/designs"
          style={{
            fontSize: "0.75rem",
            color: "#666",
            textDecoration: "none",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← Back to designs
        </Link>
        <span style={{ color: "#333" }}>|</span>
        <span style={{ fontSize: "0.75rem", color: "#444", letterSpacing: "0.06em" }}>
          DESIGN 1 — MATCHDAY
        </span>
      </div>

      {/* ── Hero / Header ─────────────────────────────────────────────── */}
      <div
        style={{
          background: `linear-gradient(160deg, ${C.purple} 0%, #1e0020 55%, ${C.darker} 100%)`,
          padding: "2.5rem 1.5rem 0",
          position: "relative" as const,
          overflow: "hidden",
        }}
      >
        {/* Background texture lines */}
        <div
          style={{
            position: "absolute" as const,
            inset: 0,
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 39px,
              #ffffff04 39px,
              #ffffff04 40px
            )`,
            pointerEvents: "none" as const,
          }}
        />

        {/* Top badge row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: "1.5rem",
            position: "relative" as const,
          }}
        >
          <div
            style={{
              background: C.cyan,
              color: C.purple,
              fontSize: "0.6rem",
              fontWeight: 900,
              letterSpacing: "0.16em",
              padding: "3px 9px",
              borderRadius: 3,
              textTransform: "uppercase" as const,
            }}
          >
            ROUND {competition.round.number}
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: `${C.white}99`,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
            }}
          >
            {competition.round.name}
          </div>
        </div>

        {/* MATCHDAY wordmark */}
        <div
          style={{
            fontSize: "clamp(3.5rem, 12vw, 6.5rem)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 0.9,
            color: C.white,
            position: "relative" as const,
            marginBottom: "0.5rem",
          }}
        >
          MATCH
          <span
            style={{
              color: C.cyan,
              display: "block",
              WebkitTextStroke: "2px " + C.cyan,
            }}
          >
            DAY
          </span>
        </div>

        {/* Competition name */}
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: `${C.white}cc`,
            marginBottom: "0.3rem",
            letterSpacing: "0.02em",
          }}
        >
          {competition.name}
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: `${C.white}66`,
            marginBottom: "1.75rem",
          }}
        >
          {competition.description}
        </div>

        {/* Countdown strip */}
        <div
          style={{
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(8px)",
            borderTop: `1px solid ${C.cyan}33`,
            marginLeft: "-1.5rem",
            marginRight: "-1.5rem",
            padding: "0.85rem 1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.6rem",
                color: "#666",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginBottom: 3,
              }}
            >
              NEXT LOCK
            </div>
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 900,
                color: C.cyan,
                letterSpacing: "-0.01em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCountdown(stats.roundDeadline)}
            </div>
          </div>
          <div
            style={{ width: 1, height: 36, background: "#333" }}
          />
          <div>
            <div
              style={{
                fontSize: "0.6rem",
                color: "#666",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginBottom: 3,
              }}
            >
              MEMBERS
            </div>
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 900,
                color: C.white,
                letterSpacing: "-0.01em",
              }}
            >
              {competition.memberCount}
            </div>
          </div>
          <div
            style={{ width: 1, height: 36, background: "#333" }}
          />
          <div>
            <div
              style={{
                fontSize: "0.6rem",
                color: "#666",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginBottom: 3,
              }}
            >
              ROUND
            </div>
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 900,
                color: C.white,
                letterSpacing: "-0.01em",
              }}
            >
              {competition.round.number}/{competition.totalRounds}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <LiveBadge />
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* ── UPCOMING EVENTS ─────────────────────────────────────────── */}
        <section style={{ marginBottom: "2.5rem" }}>
          <SectionLabel>Upcoming Events</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>

        {/* ── RESULTED EVENTS ─────────────────────────────────────────── */}
        <section style={{ marginBottom: "2.5rem" }}>
          <SectionLabel>Results</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {resultedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>

        {/* ── LEADERBOARD ─────────────────────────────────────────────── */}
        <section style={{ marginBottom: "2.5rem" }}>
          <SectionLabel>Leaderboard</SectionLabel>

          {/* Callout banner */}
          <div
            style={{
              background: `linear-gradient(135deg, ${C.purple}cc 0%, #1a001c 100%)`,
              border: `1px solid ${C.cyan}33`,
              borderRadius: 8,
              padding: "0.8rem 1.1rem",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>⚡</span>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: C.cyan,
              }}
            >
              {stats.closestRace}
            </span>
          </div>

          {/* Table */}
          <div
            style={{
              background: "#111",
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid #222",
            }}
          >
            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "32px 40px 1fr 80px 90px 32px",
                gap: "0 10px",
                padding: "0.5rem 1rem",
                background: C.darker,
                borderBottom: "1px solid #222",
              }}
            >
              {["#", "", "PLAYER", "ACC", "PTS", "±"].map((h, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "#444",
                    textAlign:
                      i === 3
                        ? "center"
                        : i === 4
                          ? "right"
                          : i === 5
                            ? "center"
                            : "left",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {leaderboard.map((entry) => (
              <LeaderboardRow
                key={entry.rank}
                entry={entry}
                isMe={entry.name === "Ger"}
              />
            ))}
          </div>

          {/* Fun fact on top player */}
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.7rem 1rem",
              background: "#0f0f0f",
              borderRadius: 8,
              border: "1px solid #1e1e1e",
              fontSize: "0.78rem",
              color: "#888",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <span
              style={{
                background: C.gold,
                color: C.black,
                fontSize: "0.6rem",
                fontWeight: 900,
                padding: "2px 6px",
                borderRadius: 3,
                letterSpacing: "0.08em",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              LEADER
            </span>
            <span>
              <strong style={{ color: C.white }}>{leaderboard[0].name}:</strong>{" "}
              {leaderboard[0].funFact}
            </span>
          </div>
        </section>

        {/* ── STATS & DATA VIZ ────────────────────────────────────────── */}
        <section style={{ marginBottom: "2.5rem" }}>
          <SectionLabel>Stats &amp; Data</SectionLabel>

          {/* Top stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "0.75rem",
              marginBottom: "1.5rem",
            }}
          >
            {[
              {
                label: "TOTAL PREDICTIONS",
                value: stats.totalPredictions,
                sub: "across all events",
                color: C.cyan,
              },
              {
                label: "GROUP ACCURACY",
                value: `${stats.avgAccuracy}%`,
                sub: "average across group",
                color: C.amber,
              },
              {
                label: "EVENTS RESULTED",
                value: `${stats.eventsResulted}/${stats.totalEvents}`,
                sub: "this competition",
                color: C.green,
              },
              {
                label: "BEST STREAK",
                value: `${stats.bestStreak.count}`,
                sub: `${stats.bestStreak.name}'s winning run 🔥`,
                color: "#ff9a00",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: "#111",
                  border: "1px solid #1e1e1e",
                  borderTop: `3px solid ${card.color}`,
                  borderRadius: 8,
                  padding: "1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.6rem",
                    color: "#555",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    marginBottom: 6,
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 900,
                    color: card.color,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {card.value}
                </div>
                <div style={{ fontSize: "0.7rem", color: "#555" }}>
                  {card.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Round progress bar */}
          <div
            style={{
              background: "#111",
              border: "1px solid #1e1e1e",
              borderRadius: 8,
              padding: "1rem 1.25rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: "#555",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                }}
              >
                Round completion
              </span>
              <span
                style={{ fontSize: "0.85rem", fontWeight: 800, color: C.cyan }}
              >
                {roundProgress}%
              </span>
            </div>
            <div
              style={{
                height: 10,
                background: "#1e1e1e",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${roundProgress}%`,
                  background: `linear-gradient(to right, ${C.purple}, ${C.cyan})`,
                  borderRadius: 99,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
                fontSize: "0.65rem",
                color: "#444",
              }}
            >
              <span>0 events</span>
              <span>{stats.eventsResulted} resulted</span>
              <span>{stats.totalEvents} total</span>
            </div>
          </div>

          {/* Two columns: accuracy chart + points race */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            {/* Accuracy chart */}
            <div
              style={{
                background: "#111",
                border: "1px solid #1e1e1e",
                borderRadius: 8,
                padding: "1.1rem 1.25rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: "#555",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  marginBottom: 14,
                }}
              >
                Accuracy %
              </div>
              <AccuracyChart />
            </div>

            {/* Points race */}
            <div
              style={{
                background: "#111",
                border: "1px solid #1e1e1e",
                borderRadius: 8,
                padding: "1.1rem 1.25rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: "#555",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  marginBottom: 14,
                }}
              >
                Points Race (Top 3)
              </div>
              <PointsRace />
            </div>
          </div>
        </section>

        {/* ── PERSONALITY ELEMENTS ────────────────────────────────────── */}
        <section style={{ marginBottom: "3rem" }}>
          <SectionLabel>Highlights</SectionLabel>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Best predictor spotlight */}
            <div
              style={{
                background: `linear-gradient(135deg, #1a0d00 0%, #2a1400 100%)`,
                border: "1px solid #ffd70033",
                borderTop: `3px solid ${C.gold}`,
                borderRadius: 8,
                padding: "1.1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  color: C.gold,
                  textTransform: "uppercase" as const,
                  marginBottom: 10,
                }}
              >
                Best Predictor — Round 3
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${C.purple}, ${C.purpleMid})`,
                    border: `2px solid ${C.gold}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.3rem",
                    fontWeight: 900,
                  }}
                >
                  D
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: 900,
                      color: C.white,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Davo
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#aaa" }}>
                    58% accuracy · 5-game streak
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: "0.75rem",
                  color: "#888",
                  lineHeight: 1.5,
                }}
              >
                {leaderboard[0].funFact}
              </div>
            </div>

            {/* Surprise of the round */}
            <div
              style={{
                background: `linear-gradient(135deg, #001a10 0%, #002016 100%)`,
                border: `1px solid ${C.green}33`,
                borderTop: `3px solid ${C.green}`,
                borderRadius: 8,
                padding: "1.1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  color: C.green,
                  textTransform: "uppercase" as const,
                  marginBottom: 10,
                }}
              >
                Surprise of the Round
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  marginBottom: 8,
                }}
              >
                😱
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: C.white,
                  lineHeight: 1.4,
                  marginBottom: 6,
                }}
              >
                {stats.surpriseOfTheRound}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#555" }}>
                0 from 12 got this one right
              </div>
            </div>

            {/* Confidence meters */}
            <div
              style={{
                background: "#111",
                border: "1px solid #1e1e1e",
                borderRadius: 8,
                padding: "1.1rem",
                display: "flex",
                flexDirection: "column" as const,
                gap: 16,
              }}
            >
              <div
                style={{
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  color: "#555",
                  textTransform: "uppercase" as const,
                }}
              >
                Prediction Confidence
              </div>
              <ConfidenceMeter value={72} label="Liverpool vs Arsenal" />
              <ConfidenceMeter value={41} label="Monaco Grand Prix" />
              <ConfidenceMeter value={58} label="Wexford vs Kilkenny" />
            </div>
          </div>

          {/* Streak badges strip */}
          <div
            style={{
              marginTop: "1rem",
              background: "#111",
              border: "1px solid #1e1e1e",
              borderRadius: 8,
              padding: "1rem 1.25rem",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                color: "#555",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginBottom: 12,
              }}
            >
              Form &amp; Streaks
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                flexWrap: "wrap" as const,
              }}
            >
              {leaderboard.map((entry) => (
                <div
                  key={entry.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#1a1a1a",
                    borderRadius: 6,
                    padding: "0.45rem 0.75rem",
                    border: "1px solid #2a2a2a",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${C.purple}, ${C.purpleMid})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      color: C.white,
                      flexShrink: 0,
                    }}
                  >
                    {entry.avatar}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: C.white,
                        marginBottom: 3,
                      }}
                    >
                      {entry.name}
                    </div>
                    <div style={{ display: "flex", gap: 3 }}>
                      {entry.form.map((f, i) => (
                        <div
                          key={i}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: formDotColor(f),
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {entry.streak >= 3 && entry.streakType === "W" && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        background: "rgba(255,100,0,0.15)",
                        border: "1px solid #ff640044",
                        color: "#ff9a00",
                        borderRadius: 3,
                        padding: "1px 5px",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        marginLeft: 4,
                      }}
                    >
                      🔥 {entry.streak}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom fun facts row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            <DidYouKnow fact={leaderboard[1].funFact} />
            <DidYouKnow fact={leaderboard[2].funFact} />
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div
          style={{
            borderTop: "1px solid #1e1e1e",
            paddingTop: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 900,
                letterSpacing: "0.16em",
                color: C.purple,
                textTransform: "uppercase" as const,
              }}
            >
              PredictSport
            </div>
            <div style={{ fontSize: "0.65rem", color: "#444", marginTop: 2 }}>
              Design 1 — Matchday concept
            </div>
          </div>
          <Link
            href="/designs"
            style={{
              fontSize: "0.75rem",
              color: C.cyan,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            View all designs →
          </Link>
        </div>
      </div>
    </div>
  );
}
