import Link from "next/link";
import {
  competition,
  leaderboard,
  events,
  stats,
  sportEmoji,
} from "../mock-data";

// ─── Colour tokens ───────────────────────────────────────────────────────────
const C = {
  navy: "#0f172a",
  navyMid: "#1e293b",
  purple: "#1e1b4b",
  blue: "#3b82f6",
  blueLight: "#60a5fa",
  violet: "#8b5cf6",
  violetLight: "#a78bfa",
  sky: "#e0f2fe",
  skyMid: "#bae6fd",
  amber: "#f59e0b",
  amberLight: "#fbbf24",
  rose: "#f43f5e",
  emerald: "#10b981",
  white: "#ffffff",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate800: "#1e293b",
};

const sportColor: Record<string, { from: string; to: string; pill: string }> = {
  Soccer: { from: "#3b82f6", to: "#8b5cf6", pill: "#dbeafe" },
  "Formula 1": { from: "#ef4444", to: "#f97316", pill: "#fee2e2" },
  GAA: { from: "#10b981", to: "#059669", pill: "#d1fae5" },
  NBA: { from: "#f59e0b", to: "#ef4444", pill: "#fef3c7" },
  Golf: { from: "#6366f1", to: "#8b5cf6", pill: "#ede9fe" },
};

const sportTextColor: Record<string, string> = {
  Soccer: "#1d4ed8",
  "Formula 1": "#dc2626",
  GAA: "#065f46",
  NBA: "#92400e",
  Golf: "#4338ca",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "Resulted";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h === 0) return `In ${m}m`;
  if (h < 24) return `In ${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `In ${d}d ${h % 24}h`;
}

function groupTotal(gp: Record<string, number>): number {
  return Object.values(gp).reduce((a, b) => a + b, 0);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function GlassStatBar() {
  const items = [
    { label: "Players", value: competition.memberCount },
    { label: "Events", value: stats.totalEvents },
    { label: "Round", value: competition.round.number },
    { label: "Leader", value: leaderboard[0].name },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        justifyContent: "center",
        marginTop: 32,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 14,
            padding: "14px 24px",
            textAlign: "center",
            minWidth: 90,
          }}
        >
          <div
            style={{
              fontSize: "1.6rem",
              fontWeight: 700,
              color: C.white,
              lineHeight: 1,
            }}
          >
            {item.value}
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.55)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginTop: 4,
            }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoundProgress() {
  const total = 5;
  const done = 3;
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === done - 1 ? 32 : 10,
            height: 10,
            borderRadius: 5,
            background:
              i < done
                ? `linear-gradient(90deg, ${C.blue}, ${C.violet})`
                : "rgba(255,255,255,0.2)",
            transition: "all 0.3s ease",
          }}
        />
      ))}
      <span
        style={{
          fontSize: "0.75rem",
          color: "rgba(255,255,255,0.5)",
          marginLeft: 8,
          alignSelf: "center",
        }}
      >
        3 of 10 rounds
      </span>
    </div>
  );
}

function SportPill({ sport }: { sport: string }) {
  const sc = sportColor[sport] ?? { pill: "#f1f5f9" };
  const tc = sportTextColor[sport] ?? "#334155";
  return (
    <span
      style={{
        background: sc.pill,
        color: tc,
        fontSize: "0.7rem",
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 20,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}
    >
      {sportEmoji[sport]} {sport}
    </span>
  );
}

function DonutChart({
  home,
  draw,
  away,
  labels,
  total,
}: {
  home: number;
  draw: number;
  away: number;
  labels: [string, string, string];
  total: number;
}) {
  const pHome = Math.round((home / total) * 100);
  const pDraw = Math.round((draw / total) * 100);
  const pAway = 100 - pHome - pDraw;
  const conicGrad = `conic-gradient(
    ${C.blue} 0% ${pHome}%,
    ${C.violet} ${pHome}% ${pHome + pDraw}%,
    ${C.slate200} ${pHome + pDraw}% 100%
  )`;
  const legend = [
    { label: labels[0], pct: pHome, color: C.blue },
    { label: labels[1], pct: pDraw, color: C.violet },
    { label: labels[2], pct: pAway, color: C.slate400 },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: conicGrad,
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 10,
            borderRadius: "50%",
            background: C.white,
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {legend.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: l.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "0.75rem", color: C.slate600 }}>
              {l.label}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: C.slate800,
                marginLeft: "auto",
              }}
            >
              {l.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunFactCallout({ fact }: { fact: string }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #eff6ff, #f5f3ff)",
        border: "none",
        borderLeft: `3px solid ${C.blue}`,
        borderRadius: "0 10px 10px 0",
        padding: "10px 14px",
        marginTop: 12,
        fontSize: "0.8rem",
        color: C.slate600,
        lineHeight: 1.5,
        fontStyle: "italic",
      }}
    >
      <span style={{ color: C.blue, fontWeight: 700, fontStyle: "normal" }}>
        Did you know?{" "}
      </span>
      {fact}
    </div>
  );
}

function UpcomingEventCard({ event }: { event: (typeof events)[0] }) {
  const sc = sportColor[event.sport] ?? { from: C.blue, to: C.violet };
  const gp = event.groupPredictions as Record<string, number>;
  const total = groupTotal(gp);
  const keys = Object.keys(gp);
  const countdown = formatCountdown(event.startTime);
  const isUrgent = new Date(event.lockTime).getTime() - Date.now() < 2 * 3_600_000;

  return (
    <div
      style={{
        background: C.white,
        borderRadius: 16,
        boxShadow:
          "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
        overflow: "hidden",
        border: `1px solid ${C.slate200}`,
      }}
    >
      {/* Gradient accent bar */}
      <div
        style={{
          height: 5,
          background: `linear-gradient(90deg, ${sc.from}, ${sc.to})`,
        }}
      />

      <div style={{ padding: "20px 20px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <SportPill sport={event.sport} />
            <h3
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: C.navy,
                marginTop: 8,
                marginBottom: 2,
                lineHeight: 1.3,
              }}
            >
              {event.name}
            </h3>
            <p style={{ fontSize: "0.78rem", color: C.slate400 }}>
              {event.league}
            </p>
          </div>
          <div
            style={{
              flexShrink: 0,
              background: isUrgent
                ? "linear-gradient(135deg, #fef3c7, #fde68a)"
                : `linear-gradient(135deg, ${C.sky}, ${C.skyMid})`,
              borderRadius: 10,
              padding: "6px 12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: isUrgent ? "#92400e" : "#0369a1",
                whiteSpace: "nowrap",
              }}
            >
              {countdown}
            </div>
            <div
              style={{
                fontSize: "0.65rem",
                color: isUrgent ? "#b45309" : "#0284c7",
                marginTop: 1,
              }}
            >
              locks soon
            </div>
          </div>
        </div>

        {/* Fun fact */}
        {event.funFacts && event.funFacts[0] && (
          <FunFactCallout fact={event.funFacts[0]} />
        )}

        {/* Group predictions */}
        {total > 0 && (
          <div style={{ marginTop: 16 }}>
            <p
              style={{
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: C.slate400,
                marginBottom: 4,
                fontWeight: 600,
              }}
            >
              How the group sees it
            </p>
            <DonutChart
              home={gp[keys[0]] ?? 0}
              draw={gp[keys[1]] ?? 0}
              away={gp[keys[2]] ?? 0}
              labels={[
                keys[0].charAt(0).toUpperCase() + keys[0].slice(1),
                keys[1]?.charAt(0).toUpperCase() + (keys[1]?.slice(1) ?? ""),
                keys[2]?.charAt(0).toUpperCase() + (keys[2]?.slice(1) ?? ""),
              ]}
              total={total}
            />
          </div>
        )}
      </div>

      {/* Prediction buttons */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "16px 20px",
          borderTop: `1px solid ${C.slate100}`,
          marginTop: 16,
        }}
      >
        {keys.slice(0, 3).map((key, i) => (
          <button
            key={key}
            style={{
              flex: 1,
              padding: "9px 6px",
              borderRadius: 10,
              border:
                i === 0
                  ? `2px solid ${C.blue}`
                  : `2px solid ${C.slate200}`,
              background:
                i === 0
                  ? `linear-gradient(135deg, ${C.blue}, ${C.violet})`
                  : C.white,
              color: i === 0 ? C.white : C.slate500,
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultedEventCard({ event }: { event: (typeof events)[0] }) {
  const up = event.userPrediction as
    | { pick: string; margin?: string; isCorrect: boolean; pointsAwarded: number }
    | undefined;
  if (!up) return null;

  const bannerGrad = up.isCorrect
    ? "linear-gradient(135deg, #059669, #10b981)"
    : "linear-gradient(135deg, #dc2626, #f43f5e)";
  const sc = sportColor[event.sport] ?? { from: C.blue, to: C.violet };

  return (
    <div
      style={{
        background: C.white,
        borderRadius: 16,
        boxShadow:
          "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
        overflow: "hidden",
        border: `1px solid ${C.slate200}`,
      }}
    >
      <div
        style={{
          height: 5,
          background: `linear-gradient(90deg, ${sc.from}, ${sc.to})`,
        }}
      />

      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
          <div>
            <SportPill sport={event.sport} />
            <h3
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: C.navy,
                marginTop: 8,
                marginBottom: 2,
              }}
            >
              {event.name}
            </h3>
          </div>
          <div
            style={{
              background: bannerGrad,
              borderRadius: 12,
              padding: "8px 14px",
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: C.white }}>
              +{up.pointsAwarded}
            </div>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.8)" }}>
              pts
            </div>
          </div>
        </div>

        {/* Result display */}
        <div
          style={{
            background: C.slate100,
            borderRadius: 12,
            padding: "14px 16px",
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "0.65rem", color: C.slate400, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Result
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: C.navy, marginTop: 2 }}>
              {event.result}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.65rem", color: C.slate400, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Your pick
            </div>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: up.isCorrect ? C.emerald : C.rose,
                marginTop: 2,
              }}
            >
              {up.pick}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 0 20px",
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: bannerGrad,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              flexShrink: 0,
            }}
          >
            {up.isCorrect ? "✓" : "✗"}
          </div>
          <span style={{ fontSize: "0.82rem", color: C.slate500 }}>
            {up.isCorrect
              ? "Nailed it — good call"
              : "Bad luck — better next time"}
          </span>
        </div>
      </div>
    </div>
  );
}

function AccuracyRing({ pct }: { pct: number }) {
  const conicGrad = `conic-gradient(
    ${C.blue} 0% ${pct}%,
    rgba(226,232,240,0.4) ${pct}% 100%
  )`;
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: conicGrad,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 5,
          borderRadius: "50%",
          background: C.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.6rem",
          fontWeight: 700,
          color: C.navy,
        }}
      >
        {pct}%
      </div>
    </div>
  );
}

function FormDots({ form }: { form: readonly string[] }) {
  const colorMap: Record<string, string> = {
    W: C.emerald,
    L: C.rose,
    P: C.amber,
  };
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {form.map((f, i) => (
        <div
          key={i}
          title={f === "W" ? "Win" : f === "L" ? "Loss" : "Partial"}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: colorMap[f] ?? C.slate400,
          }}
        />
      ))}
    </div>
  );
}

function MovementBadge({ movement }: { movement: number }) {
  if (movement === 0) {
    return (
      <span
        style={{
          fontSize: "0.7rem",
          color: C.slate400,
          fontWeight: 700,
        }}
      >
        —
      </span>
    );
  }
  const up = movement > 0;
  return (
    <span
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        color: up ? C.emerald : C.rose,
        background: up ? "#d1fae5" : "#fee2e2",
        borderRadius: 20,
        padding: "2px 7px",
      }}
    >
      {up ? "+" : ""}
      {movement}
    </span>
  );
}

function PodiumCard({
  entry,
  rank,
}: {
  entry: (typeof leaderboard)[0];
  rank: 1 | 2 | 3;
}) {
  const configs = {
    1: {
      grad: `linear-gradient(135deg, ${C.blue}, ${C.violet})`,
      accent: "#fbbf24",
      accentLabel: "GOLD",
      emoji: "🥇",
      size: "1.1",
    },
    2: {
      grad: "linear-gradient(135deg, #334155, #475569)",
      accent: "#cbd5e1",
      accentLabel: "SILVER",
      emoji: "🥈",
      size: "1",
    },
    3: {
      grad: "linear-gradient(135deg, #78350f, #a16207)",
      accent: "#fcd34d",
      accentLabel: "BRONZE",
      emoji: "🥉",
      size: "1",
    },
  };
  const cfg = configs[rank];

  return (
    <div
      style={{
        background: cfg.grad,
        borderRadius: 20,
        padding: "24px 20px",
        color: C.white,
        position: "relative",
        overflow: "hidden",
        transform: rank === 1 ? "scale(1.03)" : "scale(1)",
        boxShadow:
          rank === 1
            ? `0 20px 40px rgba(59,130,246,0.35)`
            : "0 8px 20px rgba(0,0,0,0.2)",
      }}
    >
      {/* Decorative glow */}
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${cfg.accent}33, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>{cfg.emoji}</div>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.3rem",
          fontWeight: 800,
          marginBottom: 10,
          border: `2px solid ${cfg.accent}`,
        }}
      >
        {entry.avatar}
      </div>

      <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{entry.name}</div>
      <div
        style={{
          fontSize: "2.5rem",
          fontWeight: 800,
          lineHeight: 1.1,
          marginTop: 4,
          color: cfg.accent,
        }}
      >
        {entry.points}
        <span style={{ fontSize: "1rem", fontWeight: 500, color: "rgba(255,255,255,0.6)", marginLeft: 4 }}>
          pts
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <AccuracyRing pct={entry.accuracy} />
        <FormDots form={entry.form} />
      </div>

      <div
        style={{
          fontSize: "0.72rem",
          color: "rgba(255,255,255,0.6)",
          marginTop: 10,
          fontStyle: "italic",
          lineHeight: 1.4,
        }}
      >
        {entry.funFact}
      </div>
    </div>
  );
}

function GradientText({ children, from, to }: { children: React.ReactNode; from: string; to: string }) {
  return (
    <span
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      {children}
    </span>
  );
}

function SectionHeader({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            width: 4,
            height: 22,
            borderRadius: 2,
            background: `linear-gradient(180deg, ${from}, ${to})`,
          }}
        />
        <h2
          style={{
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: C.slate400,
            fontWeight: 700,
          }}
        >
          {label}
        </h2>
      </div>
    </div>
  );
}

function HorizontalBar({ label, pct, from, to }: { label: string; pct: number; from: string; to: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: "0.82rem", color: C.slate600, fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: C.navy }}>
          {pct}%
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: C.slate100,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${from}, ${to})`,
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  );
}

function SparkBar({ pts, max, label }: { pts: number; max: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div
        style={{
          width: 28,
          height: 60,
          background: C.slate100,
          borderRadius: 6,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <div
          style={{
            width: "100%",
            height: `${Math.round((pts / max) * 100)}%`,
            background: `linear-gradient(180deg, ${C.blue}, ${C.violet})`,
            borderRadius: "4px 4px 0 0",
          }}
        />
      </div>
      <span style={{ fontSize: "0.65rem", color: C.slate400, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: "0.7rem", color: C.navy, fontWeight: 700 }}>{pts}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StadiumDesign() {
  const upcoming = events.filter((e) => e.status === "upcoming");
  const resulted = events.filter((e) => e.status === "resulted");
  const rest = leaderboard.slice(3);

  // Mock sparkline data (pts per round)
  const sparkData = [
    { round: "R1", pts: 12 },
    { round: "R2", pts: 18 },
    { round: "R3", pts: 17 },
    { round: "R4", pts: 9 },
    { round: "R5", pts: 14 },
  ];
  const maxSpark = Math.max(...sparkData.map((d) => d.pts));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.navy,
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: C.navy,
        overflowX: "hidden",
      }}
    >
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 10%, rgba(59,130,246,0.25) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 80%, rgba(139,92,246,0.2) 0%, transparent 60%),
            linear-gradient(160deg, ${C.navy} 0%, ${C.purple} 100%)
          `,
          padding: "40px 24px 52px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative mesh circles */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 280,
            height: 280,
            borderRadius: "50%",
            border: "1px solid rgba(139,92,246,0.12)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: "50%",
            border: "1px solid rgba(59,130,246,0.12)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
          {/* Back link */}
          <Link
            href="/designs"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.45)",
              textDecoration: "none",
              marginBottom: 32,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 600,
            }}
          >
            ← Back to designs
          </Link>

          {/* Competition badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 30,
              padding: "6px 14px 6px 8px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: C.emerald,
                boxShadow: `0 0 8px ${C.emerald}`,
              }}
            />
            <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
              Wexford FC Quiz 2026
            </span>
          </div>

          {/* Wordmark */}
          <div style={{ marginBottom: 8 }}>
            <h1
              style={{
                fontSize: "clamp(3rem, 10vw, 5rem)",
                fontWeight: 300,
                color: C.white,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                lineHeight: 1,
                margin: 0,
              }}
            >
              STADIUM
            </h1>
          </div>

          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: "0.9rem",
              marginBottom: 0,
            }}
          >
            {competition.description}
          </p>

          {/* Round progress */}
          <RoundProgress />

          {/* Glassmorphism stat bar */}
          <GlassStatBar />
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main
        style={{
          background: C.slate100,
          padding: "36px 24px 60px",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto" }}>

          {/* ── UPCOMING EVENTS ── */}
          <section style={{ marginBottom: 56 }}>
            <SectionHeader label="Upcoming Events" from={C.blue} to={C.violet} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {upcoming.map((event) => (
                <UpcomingEventCard key={event.id} event={event} />
              ))}
            </div>
          </section>

          {/* ── RESULTED EVENTS ── */}
          <section style={{ marginBottom: 56 }}>
            <SectionHeader label="Results" from={C.emerald} to={C.blue} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {resulted.map((event) => (
                <ResultedEventCard key={event.id} event={event} />
              ))}
            </div>
          </section>

          {/* ── LEADERBOARD ── */}
          <section style={{ marginBottom: 56 }}>
            <SectionHeader label="Leaderboard" from={C.amber} to={C.violet} />

            {/* Race banner */}
            <div
              style={{
                background: `linear-gradient(135deg, ${C.navy}, ${C.purple})`,
                borderRadius: 14,
                padding: "14px 20px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>🏁</span>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.9)", margin: 0, lineHeight: 1.4 }}>
                <strong style={{ color: C.amberLight }}>Just 3 points</strong> separate 1st and 2nd.{" "}
                <span style={{ color: "rgba(255,255,255,0.55)" }}>
                  {stats.closestRace}
                </span>
              </p>
            </div>

            {/* Podium top 3 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {leaderboard.slice(0, 3).map((entry) => (
                <PodiumCard key={entry.rank} entry={entry} rank={entry.rank as 1 | 2 | 3} />
              ))}
            </div>

            {/* Rest of table */}
            <div
              style={{
                background: C.white,
                borderRadius: 16,
                overflow: "hidden",
                boxShadow:
                  "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
                border: `1px solid ${C.slate200}`,
              }}
            >
              {rest.map((entry, i) => (
                <div
                  key={entry.rank}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 18px",
                    borderBottom:
                      i < rest.length - 1 ? `1px solid ${C.slate100}` : "none",
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      textAlign: "center",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: C.slate400,
                      flexShrink: 0,
                    }}
                  >
                    {entry.rank}
                  </span>

                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${C.slate200}, ${C.slate100})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: C.slate600,
                      flexShrink: 0,
                    }}
                  >
                    {entry.avatar}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: C.navy }}>
                      {entry.name}
                    </div>
                    <FormDots form={entry.form} />
                  </div>

                  <AccuracyRing pct={entry.accuracy} />

                  <div style={{ textAlign: "right", minWidth: 52 }}>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: C.navy }}>
                      {entry.points}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: C.slate400 }}>pts</div>
                  </div>

                  <MovementBadge movement={entry.movement} />
                </div>
              ))}
            </div>
          </section>

          {/* ── INSIGHTS ── */}
          <section style={{ marginBottom: 56 }}>
            <SectionHeader label="Insights" from={C.violet} to={C.blue} />

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Prediction outcomes donut */}
              <div
                style={{
                  background: C.white,
                  borderRadius: 16,
                  padding: "22px 22px",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
                  border: `1px solid ${C.slate200}`,
                }}
              >
                <h3
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: C.slate400,
                    marginBottom: 16,
                  }}
                >
                  Prediction Outcomes
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                  {/* Big donut */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: "50%",
                        background: `conic-gradient(
                          ${C.emerald} 0% 48%,
                          ${C.amber} 48% 67%,
                          ${C.rose} 67% 100%
                        )`,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 14,
                        borderRadius: "50%",
                        background: C.white,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                      }}
                    >
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: C.navy, lineHeight: 1 }}>
                        48%
                      </div>
                      <div style={{ fontSize: "0.55rem", color: C.slate400, marginTop: 1 }}>
                        accuracy
                      </div>
                    </div>
                  </div>
                  {/* Legend */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "Correct", count: stats.totalPredictions * 0.48 | 0, color: C.emerald, pct: 48 },
                      { label: "Partial", count: stats.totalPredictions * 0.19 | 0, color: C.amber, pct: 19 },
                      { label: "Wrong", count: stats.totalPredictions * 0.33 | 0, color: C.rose, pct: 33 },
                    ].map((item) => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: item.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: "0.82rem", color: C.slate600 }}>{item.label}</span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: C.navy, marginLeft: 4 }}>
                          {item.count}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: C.slate400 }}>({item.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Accuracy by sport */}
              <div
                style={{
                  background: C.white,
                  borderRadius: 16,
                  padding: "22px",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
                  border: `1px solid ${C.slate200}`,
                }}
              >
                <h3
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: C.slate400,
                    marginBottom: 18,
                  }}
                >
                  Accuracy by Sport
                </h3>
                <HorizontalBar label="⚽ Soccer" pct={54} from={C.blue} to={C.violet} />
                <HorizontalBar label="🏎️ Formula 1" pct={48} from="#ef4444" to="#f97316" />
                <HorizontalBar label="🏐 GAA" pct={61} from="#10b981" to="#059669" />
                <HorizontalBar label="🏀 NBA" pct={38} from="#f59e0b" to="#ef4444" />
                <HorizontalBar label="⛳ Golf" pct={29} from="#6366f1" to="#8b5cf6" />
              </div>

              {/* Sparkline + round MVP side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                {/* Round MVP */}
                <div
                  style={{
                    background: `linear-gradient(135deg, ${C.blue}, ${C.violet})`,
                    borderRadius: 16,
                    padding: "22px 18px",
                    color: C.white,
                    boxShadow: "0 8px 20px rgba(59,130,246,0.3)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.65rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "rgba(255,255,255,0.6)",
                      marginBottom: 10,
                    }}
                  >
                    Round MVP
                  </div>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.2rem",
                      fontWeight: 800,
                      marginBottom: 10,
                      border: "2px solid rgba(255,255,255,0.4)",
                    }}
                  >
                    {leaderboard[0].avatar}
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                    {leaderboard[0].name}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.65)", marginTop: 4, lineHeight: 1.4 }}>
                    {leaderboard[0].streak} win streak
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      background: "rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: "0.72rem",
                      color: "rgba(255,255,255,0.8)",
                      fontStyle: "italic",
                      lineHeight: 1.4,
                    }}
                  >
                    {leaderboard[0].funFact}
                  </div>
                </div>

                {/* Hot Take */}
                <div
                  style={{
                    background: `linear-gradient(135deg, #fef3c7, #fff7ed)`,
                    borderRadius: 16,
                    padding: "22px 18px",
                    border: `1px solid #fde68a`,
                    boxShadow: "0 4px 6px -1px rgba(245,158,11,0.12)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.65rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "#92400e",
                      marginBottom: 10,
                      fontWeight: 700,
                    }}
                  >
                    Hot Take
                  </div>
                  <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>🔥</div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e", lineHeight: 1.4 }}>
                    Most Controversial Pick
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#a16207",
                      marginTop: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    {stats.surpriseOfTheRound}
                  </div>
                </div>
              </div>

              {/* Points sparkline */}
              <div
                style={{
                  background: C.white,
                  borderRadius: 16,
                  padding: "22px",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
                  border: `1px solid ${C.slate200}`,
                }}
              >
                <h3
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: C.slate400,
                    marginBottom: 20,
                  }}
                >
                  Points Per Round — {leaderboard[0].name}
                </h3>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                  {sparkData.map((d) => (
                    <SparkBar key={d.round} pts={d.pts} max={maxSpark} label={d.round} />
                  ))}
                </div>
              </div>

            </div>
          </section>

          {/* ── COMING UP ── */}
          <section style={{ marginBottom: 56 }}>
            <SectionHeader label="Coming Up" from={C.emerald} to={C.blue} />
            <div
              style={{
                background: C.white,
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
                border: `1px solid ${C.slate200}`,
              }}
            >
              <div
                style={{
                  background: `linear-gradient(90deg, ${C.navy}, ${C.purple})`,
                  padding: "12px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: "1rem" }}>📅</span>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: C.white }}>
                  Next deadline
                </span>
                <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.55)", marginLeft: "auto" }}>
                  {formatCountdown(stats.roundDeadline)}
                </span>
              </div>
              {upcoming.map((event, i) => (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 20px",
                    borderBottom: i < upcoming.length - 1 ? `1px solid ${C.slate100}` : "none",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `linear-gradient(135deg, ${(sportColor[event.sport] ?? { from: C.blue, to: C.violet }).from}, ${(sportColor[event.sport] ?? { from: C.blue, to: C.violet }).to})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                      flexShrink: 0,
                    }}
                  >
                    {sportEmoji[event.sport]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.navy }}>
                      {event.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: C.slate400 }}>
                      {event.league}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: C.blue,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCountdown(event.startTime)}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer
        style={{
          background: C.navy,
          padding: "32px 24px",
          position: "relative",
        }}
      >
        {/* Gradient divider */}
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${C.blue}, ${C.violet}, transparent)`,
            marginBottom: 24,
          }}
        />
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 300,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: C.white,
              }}
            >
              STADIUM
            </div>
            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
              PredictSport · Design 7
            </div>
          </div>
          <Link
            href="/designs"
            style={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.4)",
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 600,
            }}
          >
            ← All Designs
          </Link>
        </div>
      </footer>
    </div>
  );
}
