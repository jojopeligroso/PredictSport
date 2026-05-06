import Link from "next/link";
import { competition, leaderboard, events, stats } from "../mock-data";

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  carbon: "#15151e",
  graphite: "#1e1e2e",
  graphiteLight: "#2a2a3e",
  red: "#e10600",
  redDark: "#a00400",
  teal: "#00d2be",
  tealDim: "#007a70",
  white: "#ffffff",
  silver: "#c0c0c0",
  grey: "#888899",
  greyDim: "#44445a",
  gold: "#ffd700",
  amber: "#f59e0b",
  green: "#22c55e",
  greenDim: "#16a34a",
  border: "#2d2d45",
};

// ─── CSS-in-JSX helpers ──────────────────────────────────────────────────────
const carbonFiber: React.CSSProperties = {
  backgroundImage: `
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 4px,
      rgba(255,255,255,0.015) 4px,
      rgba(255,255,255,0.015) 8px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 4px,
      rgba(255,255,255,0.015) 4px,
      rgba(255,255,255,0.015) 8px
    ),
    linear-gradient(180deg, #15151e 0%, #1a1a28 100%)
  `,
};

const checkeredAccent: React.CSSProperties = {
  backgroundImage: `
    repeating-conic-gradient(${C.white} 0% 25%, ${C.carbon} 0% 50%)
  `,
  backgroundSize: "8px 8px",
};

// ─── Small utilities ─────────────────────────────────────────────────────────
function mono(val: string | number) {
  return (
    <span style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}>
      {val}
    </span>
  );
}

function formatCountdown(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "00:00:00";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function formColor(result: "W" | "L" | "P"): string {
  if (result === "W") return C.green;
  if (result === "L") return C.red;
  return C.amber;
}

function rankBg(rank: number): string {
  if (rank === 1) return C.gold;
  if (rank === 2) return C.silver;
  if (rank === 3) return "#cd7f32";
  return C.graphiteLight;
}

function rankColor(rank: number): string {
  if (rank <= 3) return C.carbon;
  return C.white;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RedLine() {
  return (
    <div
      style={{
        height: 3,
        background: `linear-gradient(90deg, ${C.red} 0%, ${C.redDark} 60%, transparent 100%)`,
        margin: "0.5rem 0",
      }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        marginBottom: "1.5rem",
      }}
    >
      <div style={{ width: 4, height: 24, background: C.red, flexShrink: 0 }} />
      <span
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: C.grey,
          fontFamily: "monospace",
        }}
      >
        {children}
      </span>
      <div
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(90deg, ${C.border} 0%, transparent 100%)`,
        }}
      />
    </div>
  );
}

function SportBadge({ sport }: { sport: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    "Formula 1": { bg: C.red, color: C.white },
    Soccer: { bg: "#1a6634", color: C.white },
    GAA: { bg: "#003580", color: C.white },
    NBA: { bg: "#c9082a", color: C.white },
    Golf: { bg: "#2d6a10", color: C.white },
  };
  const scheme = colors[sport] ?? { bg: C.graphiteLight, color: C.silver };
  return (
    <span
      style={{
        ...scheme,
        fontSize: "0.6rem",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        padding: "2px 8px",
        fontFamily: "monospace",
        fontWeight: 700,
        borderRadius: 2,
        whiteSpace: "nowrap",
      }}
    >
      {sport}
    </span>
  );
}

function TelemetryBox({
  label,
  value,
  accent = C.teal,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: C.carbon,
        border: `1px solid ${C.border}`,
        borderTop: `2px solid ${accent}`,
        padding: "0.5rem 0.75rem",
        minWidth: 80,
      }}
    >
      <div
        style={{
          fontSize: "0.55rem",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: C.grey,
          marginBottom: 4,
          fontFamily: "monospace",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1rem",
          fontFamily: "monospace",
          fontWeight: 700,
          color: accent,
          letterSpacing: "0.05em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TeamRadio({ message, from }: { message: string; from?: string }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, #0d1117 0%, ${C.graphite} 100%)`,
        border: `1px solid ${C.tealDim}`,
        borderLeft: `3px solid ${C.teal}`,
        padding: "0.6rem 0.9rem",
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-start",
        fontSize: "0.78rem",
      }}
    >
      <span
        style={{
          fontFamily: "monospace",
          color: C.teal,
          fontSize: "0.65rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          marginTop: 1,
        }}
      >
        RADIO
      </span>
      <span style={{ color: C.silver, lineHeight: 1.5, fontStyle: "italic" }}>
        &ldquo;{message}&rdquo;
        {from && (
          <span
            style={{ color: C.grey, fontStyle: "normal", marginLeft: 8 }}
          >
            — {from}
          </span>
        )}
      </span>
    </div>
  );
}

function PitWallBar({
  predictions,
  total,
}: {
  predictions: Record<string, number>;
  total: number;
}) {
  const segColors = [C.teal, C.red, C.amber, C.green, C.silver];
  const entries = Object.entries(predictions);
  if (!entries.length || total === 0) return null;
  return (
    <div>
      <div
        style={{
          fontSize: "0.55rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: C.grey,
          fontFamily: "monospace",
          marginBottom: 4,
        }}
      >
        Pit Wall — Group Predictions
      </div>
      <div
        style={{
          display: "flex",
          height: 12,
          borderRadius: 2,
          overflow: "hidden",
          border: `1px solid ${C.border}`,
        }}
      >
        {entries.map(([key, count], i) => (
          <div
            key={key}
            title={`${key}: ${count}`}
            style={{
              flex: count / total,
              background: segColors[i % segColors.length],
              opacity: 0.85,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginTop: 4,
        }}
      >
        {entries.map(([key, count], i) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.65rem",
              fontFamily: "monospace",
              color: C.grey,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                background: segColors[i % segColors.length],
                borderRadius: 1,
              }}
            />
            <span style={{ textTransform: "capitalize" }}>{key}</span>
            <span style={{ color: C.white }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GridSlotCard({ event, index }: { event: (typeof events)[number]; index: number }) {
  const isResulted = event.status === "resulted";
  const isOpen = event.status === "upcoming";
  const total = Object.values(event.groupPredictions).reduce(
    (a: number, b) => a + (b as number),
    0
  );
  const countdown = isOpen ? formatCountdown(event.lockTime) : null;

  return (
    <div
      style={{
        background: C.graphite,
        border: `1px solid ${C.border}`,
        borderLeft: "none",
        position: "relative",
        overflow: "hidden",
        marginBottom: "1.25rem",
      }}
    >
      {/* Checkered accent on resulted events */}
      {isResulted && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 40,
            height: 40,
            ...checkeredAccent,
            opacity: 0.15,
          }}
        />
      )}

      {/* Red left stripe + grid position number */}
      <div style={{ display: "flex" }}>
        <div
          style={{
            width: 52,
            background: isResulted
              ? C.greyDim
              : `linear-gradient(180deg, ${C.red} 0%, ${C.redDark} 100%)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem 0",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "0.55rem",
              letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.6)",
              textTransform: "uppercase",
            }}
          >
            P{index + 1}
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "1.75rem",
              fontWeight: 900,
              color: C.white,
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            {index + 1}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: "1rem 1.25rem" }}>
          {/* Top row: badges + DRS/Checkered status */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "0.5rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <SportBadge sport={event.sport} />
              <span
                style={{
                  fontSize: "0.6rem",
                  color: C.grey,
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                }}
              >
                {event.league}
              </span>
            </div>
            {isOpen && (
              <div
                style={{
                  background: `linear-gradient(90deg, ${C.teal}22, ${C.teal}44)`,
                  border: `1px solid ${C.teal}`,
                  padding: "2px 10px",
                  fontSize: "0.6rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.15em",
                  color: C.teal,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                DRS ENABLED
              </div>
            )}
            {isResulted && (
              <div
                style={{
                  background: C.greyDim,
                  padding: "2px 10px",
                  fontSize: "0.6rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.15em",
                  color: C.silver,
                  textTransform: "uppercase",
                }}
              >
                RESULTED
              </div>
            )}
          </div>

          {/* Event name */}
          <h3
            style={{
              fontSize: "1.15rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: C.white,
              textTransform: "uppercase",
              marginBottom: "0.75rem",
            }}
          >
            {event.name}
          </h3>

          {/* Result or Countdown */}
          {isResulted ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "1rem",
                  color: C.gold,
                  letterSpacing: "0.05em",
                }}
              >
                RESULT: {event.result}
              </div>
              {"userPrediction" in event && event.userPrediction && (
                <div
                  style={{
                    background: event.userPrediction.isCorrect
                      ? `${C.green}22`
                      : `${C.red}22`,
                    border: `1px solid ${event.userPrediction.isCorrect ? C.green : C.red}`,
                    padding: "2px 10px",
                    fontSize: "0.65rem",
                    fontFamily: "monospace",
                    color: event.userPrediction.isCorrect ? C.green : C.red,
                  }}
                >
                  {event.userPrediction.isCorrect ? "+" : ""}
                  {event.userPrediction.pointsAwarded} PTS
                </div>
              )}
            </div>
          ) : (
            countdown && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  marginBottom: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: "0.55rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: C.grey,
                    fontFamily: "monospace",
                  }}
                >
                  Lock In
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {countdown.split(":").map((seg, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "1.35rem",
                          fontWeight: 700,
                          color:
                            i === 0
                              ? C.teal
                              : i === 1
                              ? C.amber
                              : C.red,
                          letterSpacing: "0.05em",
                          background: C.carbon,
                          padding: "2px 6px",
                          border: `1px solid ${C.border}`,
                        }}
                      >
                        {seg}
                      </span>
                      {i < 2 && (
                        <span
                          style={{
                            fontFamily: "monospace",
                            color: C.greyDim,
                            fontSize: "1rem",
                          }}
                        >
                          :
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Telemetry row */}
          {"funFacts" in event && event.funFacts && event.funFacts.length > 0 && (
            <div style={{ marginBottom: "0.75rem" }}>
              <div
                style={{
                  fontSize: "0.55rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: C.greyDim,
                  fontFamily: "monospace",
                  marginBottom: "0.4rem",
                }}
              >
                Telemetry
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {event.funFacts.slice(0, 2).map((fact, i) => (
                  <div
                    key={i}
                    style={{
                      background: C.carbon,
                      border: `1px solid ${C.border}`,
                      borderTop: `2px solid ${i === 0 ? C.teal : C.amber}`,
                      padding: "0.4rem 0.6rem",
                      fontSize: "0.72rem",
                      color: C.silver,
                      maxWidth: 280,
                      lineHeight: 1.4,
                    }}
                  >
                    {fact}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pit Wall */}
          <PitWallBar
            predictions={event.groupPredictions as Record<string, number>}
            total={total}
          />
        </div>
      </div>
    </div>
  );
}

function StandingsRow({
  entry,
  leaderPoints,
}: {
  entry: (typeof leaderboard)[number];
  leaderPoints: number;
}) {
  const gapToLeader = entry.points - leaderPoints;
  const barWidth = (entry.points / leaderPoints) * 100;
  const isOnStreak = entry.streakType === "L" && entry.streak >= 3;

  return (
    <div
      style={{
        background: C.graphite,
        border: `1px solid ${C.border}`,
        borderLeft: "none",
        marginBottom: "0.75rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Safety Car warning stripe for bad streak */}
      {isOnStreak && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `repeating-linear-gradient(90deg, ${C.amber} 0px, ${C.amber} 8px, ${C.carbon} 8px, ${C.carbon} 16px)`,
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Rank badge */}
        <div
          style={{
            width: 52,
            background: rankBg(entry.rank),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "1.4rem",
              fontWeight: 900,
              color: rankColor(entry.rank),
            }}
          >
            {entry.rank}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "0.75rem 1.25rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "0.5rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            {/* Name + movement */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: C.white,
                }}
              >
                {entry.name}
              </span>
              {entry.movement !== 0 && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontFamily: "monospace",
                    color: entry.movement > 0 ? C.green : C.red,
                    background:
                      entry.movement > 0 ? `${C.green}22` : `${C.red}22`,
                    padding: "1px 6px",
                    border: `1px solid ${entry.movement > 0 ? C.green : C.red}`,
                  }}
                >
                  {entry.movement > 0 ? "▲" : "▼"} {Math.abs(entry.movement)}
                </span>
              )}
              {isOnStreak && (
                <span
                  style={{
                    fontSize: "0.55rem",
                    fontFamily: "monospace",
                    letterSpacing: "0.12em",
                    color: C.amber,
                    border: `1px solid ${C.amber}`,
                    padding: "1px 6px",
                    textTransform: "uppercase",
                  }}
                >
                  SAFETY CAR
                </span>
              )}
            </div>

            {/* Points */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "1.6rem",
                  fontWeight: 900,
                  color:
                    entry.rank === 1
                      ? C.gold
                      : entry.rank === 2
                      ? C.silver
                      : entry.rank === 3
                      ? "#cd7f32"
                      : C.white,
                  letterSpacing: "0.02em",
                }}
              >
                {entry.points}
              </span>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                  color: C.grey,
                  letterSpacing: "0.1em",
                }}
              >
                PTS
              </span>
              {gapToLeader < 0 && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontFamily: "monospace",
                    color: C.red,
                    letterSpacing: "0.05em",
                  }}
                >
                  {gapToLeader}
                </span>
              )}
            </div>
          </div>

          {/* Points bar */}
          <div
            style={{
              height: 4,
              background: C.carbon,
              borderRadius: 2,
              marginBottom: "0.6rem",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${barWidth}%`,
                background:
                  entry.rank === 1
                    ? `linear-gradient(90deg, ${C.gold}, ${C.amber})`
                    : entry.rank <= 3
                    ? `linear-gradient(90deg, ${C.teal}, ${C.tealDim})`
                    : `linear-gradient(90deg, ${C.red}, ${C.redDark})`,
                borderRadius: 2,
              }}
            />
          </div>

          {/* Form guide + stats */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 3 }}>
              {entry.form.map((f, i) => (
                <div
                  key={i}
                  style={{
                    width: 16,
                    height: 10,
                    background: formColor(f),
                    borderRadius: 1,
                    opacity: 0.85,
                  }}
                  title={f}
                />
              ))}
            </div>
            <span
              style={{
                fontSize: "0.6rem",
                fontFamily: "monospace",
                color: C.grey,
                letterSpacing: "0.1em",
              }}
            >
              ACC: {entry.accuracy}%
            </span>
            <span
              style={{
                fontSize: "0.6rem",
                fontFamily: "monospace",
                color: C.grey,
                letterSpacing: "0.1em",
              }}
            >
              {entry.correct}W / {entry.partial}P / {entry.wrong}L
            </span>
            {entry.streak > 0 && (
              <span
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "monospace",
                  color: entry.streakType === "W" ? C.green : C.red,
                  letterSpacing: "0.1em",
                }}
              >
                {entry.streak} RACE STREAK {entry.streakType === "W" ? "HOT" : "COLD"}
              </span>
            )}
          </div>

          {/* Team Radio fun fact */}
          {entry.funFact && (
            <div style={{ marginTop: "0.6rem" }}>
              <TeamRadio message={entry.funFact} from={entry.name} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LapChart() {
  // Simulate position history over rounds for top 4
  const rounds = [1, 2, 3];
  const drivers = leaderboard.slice(0, 4);
  // Fictional previous positions (reverse-engineered from movement data)
  const posHistory: Record<string, number[]> = {
    Davo: [1, 1, 1],
    Ger: [3, 2, 2],
    Tommo: [2, 3, 3],
    Sully: [6, 5, 4],
  };
  const driverColors = [C.red, C.teal, C.amber, C.green];

  return (
    <div
      style={{
        background: C.graphite,
        border: `1px solid ${C.border}`,
        padding: "1.25rem",
        marginBottom: "1.25rem",
      }}
    >
      <div
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: C.grey,
          fontFamily: "monospace",
          marginBottom: "1rem",
        }}
      >
        LAP CHART — Position History
      </div>
      <div style={{ position: "relative", height: 120 }}>
        {/* Y axis labels */}
        {[1, 2, 3, 4].map((pos) => (
          <div
            key={pos}
            style={{
              position: "absolute",
              left: 0,
              top: `${((pos - 1) / 3) * 100}%`,
              fontSize: "0.6rem",
              fontFamily: "monospace",
              color: C.greyDim,
              transform: "translateY(-50%)",
              width: 20,
              textAlign: "right",
            }}
          >
            P{pos}
          </div>
        ))}
        {/* Lines */}
        <svg
          viewBox="0 0 300 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: 28,
            right: 0,
            top: 0,
            bottom: 0,
            width: "calc(100% - 28px)",
            height: "100%",
          }}
        >
          {/* Grid lines */}
          {[1, 2, 3, 4].map((pos) => (
            <line
              key={pos}
              x1="0"
              y1={((pos - 1) / 3) * 100}
              x2="300"
              y2={((pos - 1) / 3) * 100}
              stroke={C.border}
              strokeWidth="0.5"
              strokeDasharray="4,4"
            />
          ))}
          {/* Driver lines */}
          {drivers.map((driver, di) => {
            const history = posHistory[driver.name] ?? [di + 1, di + 1, di + 1];
            const points = rounds.map((r, ri) => ({
              x: (ri / (rounds.length - 1)) * 280 + 10,
              y: ((history[ri] - 1) / 3) * 90 + 5,
            }));
            const d = points
              .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
              .join(" ");
            return (
              <g key={driver.name}>
                <path
                  d={d}
                  fill="none"
                  stroke={driverColors[di]}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {points.map((p, pi) => (
                  <circle
                    key={pi}
                    cx={p.x}
                    cy={p.y}
                    r="3"
                    fill={driverColors[di]}
                  />
                ))}
              </g>
            );
          })}
        </svg>
        {/* Round labels */}
        <div
          style={{
            position: "absolute",
            bottom: -20,
            left: 28,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {rounds.map((r) => (
            <span
              key={r}
              style={{
                fontFamily: "monospace",
                fontSize: "0.6rem",
                color: C.greyDim,
                letterSpacing: "0.1em",
              }}
            >
              LAP {r}
            </span>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1.25rem",
          marginTop: "1.75rem",
          flexWrap: "wrap",
        }}
      >
        {drivers.map((driver, di) => (
          <div
            key={driver.name}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                width: 20,
                height: 3,
                background: driverColors[di],
                borderRadius: 2,
              }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.65rem",
                color: C.silver,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {driver.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectorAccuracy() {
  const sportStats = [
    { sport: "Soccer", accuracy: 62, color: C.green },
    { sport: "Formula 1", accuracy: 55, color: C.red },
    { sport: "GAA", accuracy: 48, color: "#003580" },
    { sport: "NBA", accuracy: 71, color: "#c9082a" },
    { sport: "Golf", accuracy: 30, color: C.amber },
  ];

  return (
    <div
      style={{
        background: C.graphite,
        border: `1px solid ${C.border}`,
        padding: "1.25rem",
        marginBottom: "1.25rem",
      }}
    >
      <div
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: C.grey,
          fontFamily: "monospace",
          marginBottom: "1rem",
        }}
      >
        SECTOR TIMES — Accuracy by Sport
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {sportStats.map((s) => (
          <div key={s.sport}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                  color: C.silver,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {s.sport}
              </span>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                  color: s.color,
                  letterSpacing: "0.08em",
                }}
              >
                {s.accuracy}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: C.carbon,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${s.accuracy}%`,
                  background: `linear-gradient(90deg, ${s.color}, ${s.color}88)`,
                  borderRadius: 2,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Top3Gap() {
  const top3 = leaderboard.slice(0, 3);
  const max = top3[0].points;
  return (
    <div
      style={{
        background: C.graphite,
        border: `1px solid ${C.border}`,
        padding: "1.25rem",
        marginBottom: "1.25rem",
      }}
    >
      <div
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: C.grey,
          fontFamily: "monospace",
          marginBottom: "1rem",
        }}
      >
        POINTS GAP — Top 3 Constructors
      </div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", height: 80 }}>
        {top3.map((entry, i) => {
          const barH = (entry.points / max) * 70;
          const colors = [C.gold, C.silver, "#cd7f32"];
          return (
            <div
              key={entry.name}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.7rem",
                  color: colors[i],
                }}
              >
                {entry.points}
              </span>
              <div
                style={{
                  width: "100%",
                  height: barH,
                  background: `linear-gradient(180deg, ${colors[i]}, ${colors[i]}66)`,
                  borderRadius: "2px 2px 0 0",
                  border: `1px solid ${colors[i]}44`,
                  borderBottom: "none",
                }}
              />
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.6rem",
                  color: C.silver,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {entry.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PaddockDesign() {
  const leaderPoints = leaderboard[0].points;
  const upcomingEvents = events.filter((e) => e.status === "upcoming");
  const resultedEvents = events.filter((e) => e.status === "resulted");
  const allEvents = [...upcomingEvents, ...resultedEvents];

  const fastestLap = leaderboard.reduce((a, b) =>
    a.correct > b.correct ? a : b
  );
  const dnfCount = events.filter(
    (e) =>
      "userPrediction" in e &&
      e.userPrediction &&
      e.userPrediction.pointsAwarded === 0
  ).length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.carbon,
        color: C.white,
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
      <header
        style={{
          ...carbonFiber,
          borderBottom: `3px solid ${C.red}`,
          padding: "0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top nav bar */}
        <div
          style={{
            background: "rgba(0,0,0,0.4)",
            borderBottom: `1px solid ${C.border}`,
            padding: "0.5rem 2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href="/designs"
            style={{
              color: C.grey,
              textDecoration: "none",
              fontSize: "0.65rem",
              fontFamily: "monospace",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← BACK TO DESIGNS
          </Link>
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              fontSize: "0.6rem",
              fontFamily: "monospace",
              letterSpacing: "0.12em",
              color: C.grey,
              textTransform: "uppercase",
            }}
          >
            <span>
              {mono(stats.totalPredictions)} PREDICTIONS
            </span>
            <span style={{ color: C.teal }}>LIVE</span>
          </div>
        </div>

        {/* Main hero */}
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "3rem 2rem 2.5rem",
          }}
        >
          {/* PADDOCK wordmark */}
          <div style={{ marginBottom: "1rem" }}>
            <div
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: C.grey,
                fontFamily: "monospace",
                marginBottom: "0.4rem",
              }}
            >
              PredictSport — Design 2
            </div>
            <h1
              style={{
                fontSize: "clamp(2.5rem, 8vw, 5rem)",
                fontWeight: 900,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: C.white,
                lineHeight: 0.9,
                margin: 0,
              }}
            >
              PADDOCK
            </h1>
            <RedLine />
          </div>

          {/* Competition name + lap counter */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: C.white,
                  marginBottom: "0.25rem",
                }}
              >
                {competition.name}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: C.grey,
                  letterSpacing: "0.1em",
                  fontFamily: "monospace",
                }}
              >
                {competition.description}
              </div>
            </div>

            {/* Lap / round indicator */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "0.25rem",
              }}
            >
              <div
                style={{
                  background: C.red,
                  padding: "0.3rem 1rem",
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                LAP {competition.round.number} OF {competition.totalRounds}
              </div>
              <div
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "monospace",
                  color: C.grey,
                  letterSpacing: "0.1em",
                }}
              >
                {competition.memberCount} DRIVERS ON GRID
              </div>
            </div>
          </div>

          {/* Countdown */}
          <div
            style={{
              marginTop: "1.75rem",
              background: "rgba(0,0,0,0.4)",
              border: `1px solid ${C.border}`,
              borderTop: `2px solid ${C.red}`,
              padding: "1rem 1.5rem",
              display: "inline-flex",
              flexDirection: "column",
              gap: "0.3rem",
            }}
          >
            <div
              style={{
                fontSize: "0.55rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: C.grey,
                fontFamily: "monospace",
              }}
            >
              Lights Out In
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "2rem",
                fontWeight: 900,
                letterSpacing: "0.1em",
                color: C.red,
              }}
            >
              {mono(formatCountdown(stats.roundDeadline))}
            </div>
          </div>

          {/* Quick stats row */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginTop: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <TelemetryBox label="Leader" value={leaderboard[0].name} accent={C.gold} />
            <TelemetryBox label="Leader Pts" value={leaderboard[0].points} accent={C.gold} />
            <TelemetryBox label="Gap" value={`${leaderboard[1].points - leaderboard[0].points}`} accent={C.red} />
            <TelemetryBox label="Avg Acc" value={`${stats.avgAccuracy}%`} accent={C.teal} />
            <TelemetryBox label="Events" value={`${stats.eventsResulted}/${stats.totalEvents}`} accent={C.silver} />
            <TelemetryBox label="Best Streak" value={`${stats.bestStreak.name} ×${stats.bestStreak.count}`} accent={C.green} />
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 2rem" }}>

        {/* ── ROUND RADIO ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "2.5rem" }}>
          <TeamRadio
            message={stats.closestRace}
            from="Race Director"
          />
          <div style={{ marginTop: "0.5rem" }}>
            <TeamRadio
              message={`Surprise of the round: ${stats.surpriseOfTheRound}`}
              from="Pit Wall"
            />
          </div>
        </div>

        {/* ── GRID SLOTS (Events) ─────────────────────────────────────────── */}
        <section style={{ marginBottom: "3rem" }}>
          <SectionLabel>Grid Slots — Round {competition.round.number} Events</SectionLabel>
          {allEvents.map((event, i) => (
            <GridSlotCard key={event.id} event={event} index={i} />
          ))}
        </section>

        {/* ── CHAMPIONSHIP STANDINGS ──────────────────────────────────────── */}
        <section style={{ marginBottom: "3rem" }}>
          <SectionLabel>Championship Standings</SectionLabel>

          {/* Top 3 visual gap */}
          <div style={{ marginBottom: "1.5rem" }}>
            <Top3Gap />
          </div>

          {leaderboard.map((entry) => (
            <StandingsRow
              key={entry.rank}
              entry={entry}
              leaderPoints={leaderPoints}
            />
          ))}

          {/* Penalty board */}
          <div
            style={{
              background: `${C.red}11`,
              border: `1px solid ${C.red}44`,
              padding: "0.75rem 1.25rem",
              marginTop: "1rem",
              display: "flex",
              gap: "1.5rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "0.6rem",
                fontFamily: "monospace",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: C.red,
              }}
            >
              GRID PENALTIES
            </span>
            {leaderboard
              .filter((e) => e.wrong >= 10)
              .map((e) => (
                <span
                  key={e.name}
                  style={{
                    fontSize: "0.65rem",
                    fontFamily: "monospace",
                    color: C.silver,
                  }}
                >
                  {e.name}: {e.wrong} wrong picks — 5 place penalty risk
                </span>
              ))}
          </div>
        </section>

        {/* ── RACE DATA ───────────────────────────────────────────────────── */}
        <section style={{ marginBottom: "3rem" }}>
          <SectionLabel>Race Data</SectionLabel>

          {/* Highlight stats row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            {/* Fastest Lap */}
            <div
              style={{
                background: C.graphite,
                border: `1px solid ${C.teal}`,
                padding: "1rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 32,
                  height: 32,
                  background: C.teal,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                }}
              >
                ⚡
              </div>
              <div
                style={{
                  fontSize: "0.55rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: C.teal,
                  fontFamily: "monospace",
                  marginBottom: 6,
                }}
              >
                FASTEST LAP
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "1.3rem",
                  fontWeight: 900,
                  color: C.teal,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {fastestLap.name}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: C.grey,
                  fontFamily: "monospace",
                  marginTop: 4,
                }}
              >
                {fastestLap.correct} correct picks
              </div>
            </div>

            {/* DNF Counter */}
            <div
              style={{
                background: C.graphite,
                border: `1px solid ${C.red}`,
                padding: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.55rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: C.red,
                  fontFamily: "monospace",
                  marginBottom: 6,
                }}
              >
                DNF — Zero-Point Picks
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "2rem",
                  fontWeight: 900,
                  color: C.red,
                  letterSpacing: "0.05em",
                }}
              >
                {dnfCount}
              </div>
              <div
                style={{ fontSize: "0.7rem", color: C.grey, fontFamily: "monospace" }}
              >
                predictions scored 0
              </div>
            </div>

            {/* DRS Zone */}
            <div
              style={{
                background: `linear-gradient(135deg, ${C.graphite}, ${C.teal}22)`,
                border: `1px solid ${C.teal}`,
                padding: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.55rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: C.teal,
                  fontFamily: "monospace",
                  marginBottom: 6,
                }}
              >
                DRS ZONE — Open Events
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "2rem",
                  fontWeight: 900,
                  color: C.teal,
                }}
              >
                {upcomingEvents.length}
              </div>
              <div
                style={{ fontSize: "0.7rem", color: C.grey, fontFamily: "monospace" }}
              >
                predictions still open
              </div>
            </div>

            {/* Group size */}
            <div
              style={{
                background: C.graphite,
                border: `1px solid ${C.border}`,
                padding: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.55rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: C.grey,
                  fontFamily: "monospace",
                  marginBottom: 6,
                }}
              >
                CONSTRUCTORS
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "2rem",
                  fontWeight: 900,
                  color: C.white,
                }}
              >
                {competition.memberCount}
              </div>
              <div
                style={{ fontSize: "0.7rem", color: C.grey, fontFamily: "monospace" }}
              >
                drivers on grid
              </div>
            </div>
          </div>

          {/* Lap Chart */}
          <LapChart />

          {/* Sector Accuracy */}
          <SectorAccuracy />
        </section>

        {/* ── TEAM RADIO BOARD ────────────────────────────────────────────── */}
        <section style={{ marginBottom: "3rem" }}>
          <SectionLabel>Team Radio — Round Bulletin</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <TeamRadio
              message="Davo is on a 5-race win streak. Statistically, a blowout is incoming."
              from="Data Analyst"
            />
            <TeamRadio
              message="Robbo hasn't picked a winner since April 12th. We've deployed the safety car."
              from="Race Control"
            />
            <TeamRadio
              message={`${stats.surpriseOfTheRound} — absolute scenes.`}
              from="Commentator"
            />
            <TeamRadio
              message="Ger is closing fast on Davo. Just 3 points between them. Next round is crucial."
              from="Pit Wall"
            />
            <div
              style={{
                background: `${C.amber}11`,
                border: `1px solid ${C.amber}44`,
                borderLeft: `3px solid ${C.amber}`,
                padding: "0.75rem 1.25rem",
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: C.amber,
                  whiteSpace: "nowrap",
                }}
              >
                SAFETY CAR
              </span>
              <span
                style={{
                  fontSize: "0.78rem",
                  color: C.silver,
                  fontStyle: "italic",
                }}
              >
                Robbo and Tommo on a losing streak — caution period deployed. Points gap may close.
              </span>
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer
          style={{
            borderTop: `1px solid ${C.border}`,
            paddingTop: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "0.6rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: C.greyDim,
            }}
          >
            PADDOCK — PredictSport Design 2 —{" "}
            <span style={{ color: C.red }}>F1 TELEMETRY</span> CONCEPT
          </div>
          <Link
            href="/designs"
            style={{
              color: C.teal,
              textDecoration: "none",
              fontSize: "0.65rem",
              fontFamily: "monospace",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              border: `1px solid ${C.teal}`,
              padding: "0.35rem 0.85rem",
            }}
          >
            ← ALL DESIGNS
          </Link>
        </footer>
      </main>
    </div>
  );
}
