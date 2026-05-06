"use client";

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
  bg: "#010409",
  surface: "#0d1117",
  panel: "#161b22",
  border: "#21262d",
  borderStrong: "#30363d",
  green: "#00e673",
  greenDim: "#00e67322",
  greenGlow: "0 0 12px #00e67388, 0 0 24px #00e67333",
  greenGlowStrong: "0 0 16px #00e673bb, 0 0 40px #00e67355",
  cyan: "#00d4ff",
  cyanDim: "#00d4ff22",
  cyanGlow: "0 0 12px #00d4ff88",
  red: "#ff4757",
  redDim: "#ff475722",
  yellow: "#ffd700",
  muted: "#8b949e",
  subtle: "#484f58",
  text: "#e6edf3",
  textDim: "#c9d1d9",
  mono: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
  sans: '"Inter", "Segoe UI", system-ui, sans-serif',
};

// ─── Utility components ───────────────────────────────────────────────────────

function GlowDot({ active = true }: { active?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: active ? C.green : C.subtle,
        boxShadow: active ? C.greenGlow : "none",
        animation: active ? "pulse 2s ease-in-out infinite" : "none",
        flexShrink: 0,
      }}
    />
  );
}

function StatusPill({ status }: { status: "open" | "locked" | "scored" }) {
  const config = {
    open: { label: "OPEN", bg: C.greenDim, color: C.green, shadow: C.greenGlow, anim: "pulse 1.8s ease-in-out infinite" },
    locked: { label: "LOCKED", bg: "#ffffff11", color: C.muted, shadow: "none", anim: "none" },
    scored: { label: "SCORED", bg: C.cyanDim, color: C.cyan, shadow: C.cyanGlow, anim: "none" },
  }[status];

  return (
    <span
      style={{
        fontFamily: C.mono,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        padding: "3px 10px",
        borderRadius: 4,
        background: config.bg,
        color: config.color,
        boxShadow: config.shadow,
        animation: config.anim,
        border: `1px solid ${config.color}44`,
      }}
    >
      {config.label}
    </span>
  );
}

function HexBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  const color = rank === 1 ? C.yellow : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : C.muted;
  return (
    <div
      style={{
        position: "relative",
        width: 36,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {/* CSS hexagon via clip-path */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isTop3 ? `${color}22` : C.panel,
          border: `2px solid ${isTop3 ? color : C.border}`,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          boxShadow: isTop3 ? `0 0 12px ${color}55` : "none",
        }}
      />
      <span
        style={{
          position: "relative",
          fontFamily: C.mono,
          fontSize: 13,
          fontWeight: 800,
          color: isTop3 ? color : C.muted,
          zIndex: 1,
        }}
      >
        {rank}
      </span>
    </div>
  );
}

function AccuracyRing({ pct, size = 44, color = C.green }: { pct: number; size?: number; color?: string }) {
  const deg = Math.round((pct / 100) * 360);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `conic-gradient(${color} ${deg}deg, ${C.border} ${deg}deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: size - 10,
            height: size - 10,
            borderRadius: "50%",
            background: C.panel,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: C.text }}>
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}

function DonutChart({ home, draw, away, total }: { home: number; draw: number; away: number; total: number }) {
  const homeDeg = Math.round((home / total) * 360);
  const drawDeg = Math.round((draw / total) * 360);
  const awayDeg = 360 - homeDeg - drawDeg;
  return (
    <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: `conic-gradient(
            ${C.green} 0deg ${homeDeg}deg,
            ${C.cyan} ${homeDeg}deg ${homeDeg + drawDeg}deg,
            ${C.red} ${homeDeg + drawDeg}deg 360deg
          )`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: C.panel,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontFamily: C.mono, fontSize: 9, fontWeight: 700, color: C.muted }}>
            {total}
          </span>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBars({ count, max = 12 }: { count: number; max?: number }) {
  const filled = Math.round((count / max) * 5);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: i < filled ? 14 + i * 2 : 10,
            borderRadius: 2,
            background: i < filled ? C.green : C.border,
            boxShadow: i < filled ? `0 0 6px ${C.green}66` : "none",
            transition: "all 0.3s",
          }}
        />
      ))}
    </div>
  );
}

function FormBadge({ result }: { result: "W" | "L" | "P" }) {
  const cfg = {
    W: { bg: C.greenDim, color: C.green, border: `${C.green}44` },
    L: { bg: C.redDim, color: C.red, border: `${C.red}44` },
    P: { bg: "#ffd70022", color: C.yellow, border: `${C.yellow}44` },
  }[result];
  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: C.mono,
        fontSize: 9,
        fontWeight: 800,
        color: cfg.color,
      }}
    >
      {result}
    </div>
  );
}

function MovementBadge({ n }: { n: number }) {
  if (n === 0) return <span style={{ fontFamily: C.mono, fontSize: 10, color: C.subtle }}>—</span>;
  const up = n > 0;
  return (
    <span
      style={{
        fontFamily: C.mono,
        fontSize: 11,
        fontWeight: 700,
        color: up ? C.green : C.red,
        background: up ? C.greenDim : C.redDim,
        padding: "2px 6px",
        borderRadius: 4,
        border: `1px solid ${up ? C.green : C.red}33`,
      }}
    >
      {up ? "▲" : "▼"}{Math.abs(n)}
    </span>
  );
}

function XpBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.green }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${C.green}, #00ffaa)`,
            borderRadius: 3,
            boxShadow: `0 0 8px ${C.green}88`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArenaDesign() {
  const roundPct = Math.round((competition.round.number / competition.totalRounds) * 100);
  const upcomingEvents = events.filter((e) => e.status === "upcoming");
  const resultedEvents = events.filter((e) => e.status === "resulted");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; }

        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #00e67388, 0 0 20px #00e67333; }
          50%       { opacity: 0.65; box-shadow: 0 0 4px #00e67344; }
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }

        @keyframes scanline {
          0%   { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }

        @keyframes slideIn {
          from { transform: translateX(-8px); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }

        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px #00e67333; }
          50%       { box-shadow: 0 0 40px #00e67366, 0 0 80px #00e67322; }
        }

        .event-card:hover {
          border-color: #00e67366 !important;
          box-shadow: 0 0 20px #00e67322 !important;
        }

        .pick-btn:hover {
          background: #00e67322 !important;
          border-color: #00e673 !important;
          color: #00e673 !important;
          box-shadow: 0 0 10px #00e67344 !important;
        }

        .leader-row {
          animation: glow-pulse 3s ease-in-out infinite;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #010409; }
        ::-webkit-scrollbar-thumb { background: #21262d; border-radius: 2px; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          fontFamily: C.sans,
          color: C.text,
          // Subtle grid background
          backgroundImage: `
            linear-gradient(${C.border}22 1px, transparent 1px),
            linear-gradient(90deg, ${C.border}22 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      >
        {/* ── Back nav ──────────────────────────────────────────────────────── */}
        <div
          style={{
            borderBottom: `1px solid ${C.border}`,
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: C.surface,
          }}
        >
          <Link
            href="/designs"
            style={{
              fontFamily: C.mono,
              fontSize: 11,
              color: C.muted,
              textDecoration: "none",
              letterSpacing: "0.1em",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "color 0.2s",
            }}
          >
            ← BACK TO DESIGNS
          </Link>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.subtle, letterSpacing: "0.1em" }}>
            CONCEPT 5 — ARENA
          </span>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 1: HERO / HEADER
        ══════════════════════════════════════════════════════════════════════ */}
        <header
          style={{
            background: `linear-gradient(180deg, #0d1117 0%, ${C.bg} 100%)`,
            borderBottom: `1px solid ${C.green}`,
            boxShadow: `0 4px 40px ${C.green}22`,
            padding: "32px 24px 24px",
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
              {/* Left: branding */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
                  <h1
                    style={{
                      fontFamily: C.sans,
                      fontSize: 48,
                      fontWeight: 900,
                      letterSpacing: "-0.04em",
                      color: C.green,
                      textShadow: `0 0 30px ${C.green}88, 0 0 60px ${C.green}33`,
                      margin: 0,
                      lineHeight: 1,
                    }}
                  >
                    ARENA
                  </h1>
                  <div
                    style={{
                      background: C.greenDim,
                      border: `1px solid ${C.green}55`,
                      borderRadius: 6,
                      padding: "4px 12px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontFamily: C.mono, fontSize: 9, color: C.green, letterSpacing: "0.15em" }}>ROUND</span>
                    <span style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.green, lineHeight: 1.1 }}>
                      {competition.round.number}/{competition.totalRounds}
                    </span>
                  </div>
                </div>
                <p style={{ fontFamily: C.sans, fontSize: 15, color: C.muted, margin: "0 0 16px", fontWeight: 400 }}>
                  {competition.name}
                </p>
                {/* XP progress bar */}
                <div style={{ maxWidth: 420 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em" }}>
                      ROUND PROGRESS
                    </span>
                    <span style={{ fontFamily: C.mono, fontSize: 10, color: C.green }}>
                      {roundPct}% COMPLETE
                    </span>
                  </div>
                  <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${roundPct}%`,
                        background: `linear-gradient(90deg, ${C.green} 0%, #00ffaa 100%)`,
                        borderRadius: 4,
                        boxShadow: `0 0 12px ${C.green}99`,
                        position: "relative",
                      }}
                    />
                    {/* Segment ticks */}
                    {Array.from({ length: 9 }, (_, i) => (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: `${(i + 1) * 10}%`,
                          width: 1,
                          background: C.bg,
                          opacity: 0.6,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    {Array.from({ length: 11 }, (_, i) => (
                      <span key={i} style={{ fontFamily: C.mono, fontSize: 8, color: C.subtle }}>{i}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: live stats */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {/* Competitors */}
                <div
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: "16px 20px",
                    minWidth: 140,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <GlowDot />
                    <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em" }}>COMPETITORS</span>
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 32, fontWeight: 800, color: C.text, lineHeight: 1 }}>
                    {competition.memberCount}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <GlowDot key={i} active={i < 9} />
                    ))}
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginTop: 4, letterSpacing: "0.08em" }}>
                    9 ONLINE NOW
                  </div>
                </div>

                {/* My points */}
                <div
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.green}44`,
                    borderRadius: 12,
                    padding: "16px 20px",
                    minWidth: 140,
                    boxShadow: `0 0 20px ${C.green}11`,
                  }}
                >
                  <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
                    YOUR POINTS
                  </span>
                  <div
                    style={{
                      fontFamily: C.mono,
                      fontSize: 36,
                      fontWeight: 800,
                      color: C.green,
                      textShadow: C.greenGlow,
                      lineHeight: 1,
                    }}
                  >
                    47
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, marginTop: 6 }}>
                    <span style={{ color: C.green }}>+8</span> THIS ROUND
                  </div>
                </div>

                {/* Level */}
                <div
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.cyan}33`,
                    borderRadius: 12,
                    padding: "16px 20px",
                    minWidth: 140,
                  }}
                >
                  <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em", display: "block", marginBottom: 4 }}>
                    RANK
                  </span>
                  <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.cyan, letterSpacing: "0.1em" }}>
                    LEVEL 3
                  </div>
                  <div style={{ fontFamily: C.sans, fontSize: 16, fontWeight: 700, color: C.text, margin: "4px 0 8px" }}>
                    ANALYST
                  </div>
                  <XpBar pct={72} label="XP TO LVL 4" />
                </div>
              </div>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 64px" }}>

          {/* ═════════════════════════════════════════════════════════════════
              DAILY CHALLENGE callout
          ══════════════════════════════════════════════════════════════════ */}
          <div
            style={{
              margin: "20px 0",
              background: `linear-gradient(135deg, #ffd70011, #00e67311)`,
              border: `1px solid #ffd70033`,
              borderRadius: 12,
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>⚡</span>
              <div>
                <div style={{ fontFamily: C.mono, fontSize: 11, color: C.yellow, letterSpacing: "0.12em", fontWeight: 700 }}>
                  DAILY CHALLENGE ACTIVE
                </div>
                <div style={{ fontFamily: C.sans, fontSize: 13, color: C.textDim, marginTop: 2 }}>
                  Predict the exact scoreline in Liverpool vs Arsenal — earn <strong style={{ color: C.yellow }}>+5 BONUS XP</strong>
                </div>
              </div>
            </div>
            <button
              style={{
                fontFamily: C.mono,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: C.yellow,
                background: "#ffd70022",
                border: `1px solid #ffd70055`,
                borderRadius: 8,
                padding: "8px 18px",
                cursor: "pointer",
              }}
            >
              ACCEPT →
            </button>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              SECTION 2: UPCOMING EVENT CARDS
          ══════════════════════════════════════════════════════════════════ */}
          <section style={{ marginTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 3, height: 22, background: C.green, borderRadius: 2, boxShadow: C.greenGlow }} />
              <h2 style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: C.text, margin: 0 }}>
                ACTIVE CONTESTS
              </h2>
              <StatusPill status="open" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
              {upcomingEvents.map((event) => {
                const preds = event.groupPredictions as unknown as Record<string, number>;
                const total = preds ? Object.values(preds).reduce((a, b) => a + b, 0) : 0;
                const home = preds.home ?? preds.verstappen ?? 0;
                const draw = preds.draw ?? preds.leclerc ?? 0;
                const away = preds.away ?? preds.norris ?? 0;

                return (
                  <div
                    key={event.id}
                    className="event-card"
                    style={{
                      background: C.panel,
                      border: `1px solid ${C.border}`,
                      borderRadius: 14,
                      overflow: "hidden",
                      transition: "border-color 0.25s, box-shadow 0.25s",
                      animation: "slideIn 0.4s ease-out",
                    }}
                  >
                    {/* Card header */}
                    <div
                      style={{
                        padding: "14px 16px",
                        borderBottom: `1px solid ${C.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 18 }}>{sportEmoji[event.sport] ?? "🏆"}</span>
                          <div>
                            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em" }}>
                              {event.league.toUpperCase()}
                            </div>
                            <div style={{ fontFamily: C.sans, fontSize: 14, fontWeight: 700, color: C.text }}>
                              {event.name}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <StatusPill status="open" />
                        {/* Countdown */}
                        <div style={{ fontFamily: C.mono, fontSize: 12, color: C.yellow, letterSpacing: "0.05em" }}>
                          01:47
                          <span style={{ animation: "blink 1s step-start infinite" }}>:</span>
                          32
                        </div>
                      </div>
                    </div>

                    {/* Prediction zone */}
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em", marginBottom: 8 }}>
                        YOUR PREDICTION
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        {event.sport === "Soccer" || event.sport === "GAA" ? (
                          <>
                            {["HOME", "DRAW", "AWAY"].map((opt) => (
                              <button
                                key={opt}
                                className="pick-btn"
                                style={{
                                  flex: 1,
                                  padding: "10px 6px",
                                  background: opt === "HOME" ? C.greenDim : "transparent",
                                  border: `1px solid ${opt === "HOME" ? C.green : C.border}`,
                                  borderRadius: 8,
                                  color: opt === "HOME" ? C.green : C.muted,
                                  fontFamily: C.mono,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  cursor: "pointer",
                                  transition: "all 0.2s",
                                  boxShadow: opt === "HOME" ? `0 0 10px ${C.green}33` : "none",
                                }}
                              >
                                {opt}
                              </button>
                            ))}
                          </>
                        ) : (
                          <>
                            {Object.keys(event.groupPredictions).map((key) => (
                              <button
                                key={key}
                                className="pick-btn"
                                style={{
                                  flex: 1,
                                  padding: "10px 6px",
                                  background: "transparent",
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 8,
                                  color: C.muted,
                                  fontFamily: C.mono,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                  cursor: "pointer",
                                  transition: "all 0.2s",
                                  textTransform: "capitalize",
                                }}
                              >
                                {key.toUpperCase()}
                              </button>
                            ))}
                          </>
                        )}
                      </div>

                      {/* Community pick + confidence */}
                      <div
                        style={{
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: 10,
                          padding: "12px 14px",
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          marginBottom: 12,
                        }}
                      >
                        <DonutChart home={home} draw={draw} away={away} total={total} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em", marginBottom: 6 }}>
                            COMMUNITY PICK
                          </div>
                          {[
                            { label: event.sport === "Formula 1" ? "VER" : "HOME", val: home, color: C.green },
                            { label: event.sport === "Formula 1" ? "LEC" : "DRAW", val: draw, color: C.cyan },
                            { label: event.sport === "Formula 1" ? "NOR" : "AWAY", val: away, color: C.red },
                          ].map((r) => (
                            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.subtle, width: 28 }}>{r.label}</span>
                              <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: total > 0 ? `${(r.val / total) * 100}%` : "0%",
                                    background: r.color,
                                    borderRadius: 2,
                                    boxShadow: `0 0 4px ${r.color}77`,
                                  }}
                                />
                              </div>
                              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, width: 16, textAlign: "right" }}>{r.val}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <ConfidenceBars count={home} max={12} />
                          <span style={{ fontFamily: C.mono, fontSize: 8, color: C.muted }}>CONF</span>
                        </div>
                      </div>

                      {/* Intel panel */}
                      <div
                        style={{
                          background: `linear-gradient(135deg, ${C.cyanDim}, transparent)`,
                          border: `1px solid ${C.cyan}33`,
                          borderRadius: 8,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.cyan, letterSpacing: "0.15em", fontWeight: 700, marginBottom: 6 }}>
                          ▸ INTEL
                        </div>
                        {(event.funFacts ?? []).slice(0, 2).map((fact, i) => (
                          <div
                            key={i}
                            style={{
                              fontFamily: C.sans,
                              fontSize: 11,
                              color: C.textDim,
                              marginBottom: 4,
                              paddingLeft: 10,
                              borderLeft: `2px solid ${C.cyan}44`,
                            }}
                          >
                            {fact}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═════════════════════════════════════════════════════════════════
              RESULTED EVENTS
          ══════════════════════════════════════════════════════════════════ */}
          <section style={{ marginTop: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 3, height: 22, background: C.cyan, borderRadius: 2, boxShadow: C.cyanGlow }} />
              <h2 style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: C.text, margin: 0 }}>
                RESULTS
              </h2>
              <StatusPill status="scored" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
              {resultedEvents.map((event) => {
                const pred = (event as { userPrediction?: { pick: string; isCorrect: boolean; pointsAwarded: number } }).userPrediction;
                const correct = pred?.isCorrect ?? false;

                return (
                  <div
                    key={event.id}
                    style={{
                      background: C.panel,
                      border: `1px solid ${correct ? C.green + "44" : C.red + "33"}`,
                      borderRadius: 14,
                      overflow: "hidden",
                      boxShadow: correct ? `0 0 20px ${C.green}11` : "none",
                    }}
                  >
                    <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{sportEmoji[event.sport] ?? "🏆"}</span>
                        <div>
                          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em" }}>{event.league.toUpperCase()}</div>
                          <div style={{ fontFamily: C.sans, fontSize: 14, fontWeight: 700, color: C.text }}>{event.name}</div>
                        </div>
                      </div>
                      <StatusPill status="scored" />
                    </div>
                    <div style={{ padding: "16px" }}>
                      {/* Result */}
                      <div style={{ fontFamily: C.mono, fontSize: 13, color: C.cyan, fontWeight: 700, marginBottom: 12 }}>
                        RESULT: {(event as { result?: string }).result ?? "Completed"}
                      </div>
                      {pred && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background: correct ? C.greenDim : C.redDim,
                                border: `2px solid ${correct ? C.green : C.red}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 18,
                                boxShadow: correct ? C.greenGlow : `0 0 12px ${C.red}88`,
                              }}
                            >
                              {correct ? "✓" : "✗"}
                            </div>
                            <div>
                              <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>YOUR PICK</div>
                              <div style={{ fontFamily: C.sans, fontSize: 13, fontWeight: 600, color: correct ? C.green : C.red }}>
                                {pred.pick}
                              </div>
                            </div>
                          </div>
                          {correct && (
                            <div style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  fontFamily: C.mono,
                                  fontSize: 28,
                                  fontWeight: 800,
                                  color: C.green,
                                  textShadow: C.greenGlow,
                                  lineHeight: 1,
                                }}
                              >
                                +{pred.pointsAwarded}
                              </div>
                              <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>POINTS</div>
                              <div
                                style={{
                                  fontFamily: C.mono,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: C.cyan,
                                  background: C.cyanDim,
                                  border: `1px solid ${C.cyan}33`,
                                  borderRadius: 4,
                                  padding: "2px 8px",
                                  marginTop: 4,
                                  display: "inline-block",
                                }}
                              >
                                +{Math.round(pred.pointsAwarded * 0.8)} XP
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═════════════════════════════════════════════════════════════════
              SECTION 3: POWER RANKINGS LEADERBOARD
          ══════════════════════════════════════════════════════════════════ */}
          <section style={{ marginTop: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 3, height: 22, background: C.yellow, borderRadius: 2, boxShadow: `0 0 12px ${C.yellow}88` }} />
              <h2 style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: C.text, margin: 0 }}>
                POWER RANKINGS
              </h2>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>ROUND {competition.round.number} STANDINGS</span>
            </div>

            {/* Rivalry callout */}
            <div
              style={{
                background: `linear-gradient(135deg, #ffd70011, #00e67311)`,
                border: `1px solid #ffd70033`,
                borderRadius: 10,
                padding: "10px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18 }}>⚔️</span>
              <div>
                <span style={{ fontFamily: C.mono, fontSize: 10, color: C.yellow, fontWeight: 700, letterSpacing: "0.1em" }}>RIVALRY WATCH </span>
                <span style={{ fontFamily: C.sans, fontSize: 12, color: C.textDim }}>{stats.closestRace}</span>
              </div>
            </div>

            <div
              style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "52px 1fr 90px 80px 70px 60px 50px",
                  gap: 8,
                  padding: "10px 16px",
                  borderBottom: `1px solid ${C.border}`,
                  alignItems: "center",
                }}
              >
                {["RNK", "PLAYER", "POINTS", "ACCURACY", "FORM", "STREAK", "MOV"].map((h) => (
                  <span key={h} style={{ fontFamily: C.mono, fontSize: 9, color: C.subtle, letterSpacing: "0.12em" }}>{h}</span>
                ))}
              </div>

              {leaderboard.map((player, idx) => {
                const isLeader = player.rank === 1;
                const isOnFire = player.streakType === "W" && player.streak >= 3;
                const leaderPoints = leaderboard[0].points;
                const gap = leaderPoints - player.points;

                return (
                  <div
                    key={player.name}
                    className={isLeader ? "leader-row" : ""}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "52px 1fr 90px 80px 70px 60px 50px",
                      gap: 8,
                      padding: "14px 16px",
                      borderBottom: idx < leaderboard.length - 1 ? `1px solid ${C.border}` : "none",
                      alignItems: "center",
                      background: isLeader ? `linear-gradient(90deg, ${C.green}08, transparent)` : "transparent",
                      boxShadow: isLeader ? `inset 3px 0 0 ${C.green}` : "none",
                      animation: isLeader ? "slideIn 0.3s ease-out" : undefined,
                      transition: "background 0.2s",
                    }}
                  >
                    {/* Rank hex */}
                    <HexBadge rank={player.rank} />

                    {/* Player */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${C.green}33, ${C.cyan}22)`,
                          border: `2px solid ${player.movement > 0 ? C.green : player.movement < 0 ? C.red : C.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: C.mono,
                          fontSize: 14,
                          fontWeight: 800,
                          color: C.text,
                          flexShrink: 0,
                          boxShadow: isLeader ? `0 0 12px ${C.green}55` : "none",
                        }}
                      >
                        {player.avatar}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: C.sans, fontSize: 14, fontWeight: 700, color: C.text }}>{player.name}</span>
                          {isOnFire && (
                            <span
                              style={{
                                fontFamily: C.mono,
                                fontSize: 9,
                                fontWeight: 700,
                                color: "#ff6b35",
                                background: "#ff6b3522",
                                border: "1px solid #ff6b3544",
                                borderRadius: 4,
                                padding: "1px 6px",
                                letterSpacing: "0.1em",
                              }}
                            >
                              🔥 ON FIRE
                            </span>
                          )}
                        </div>
                        {gap > 0 ? (
                          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.subtle }}>
                            -{gap} FROM LEADER
                          </span>
                        ) : (
                          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.green }}>LEADER</span>
                        )}
                      </div>
                    </div>

                    {/* Points */}
                    <div>
                      <span
                        style={{
                          fontFamily: C.mono,
                          fontSize: 20,
                          fontWeight: 800,
                          color: isLeader ? C.green : C.text,
                          textShadow: isLeader ? C.greenGlow : "none",
                        }}
                      >
                        {player.points}
                      </span>
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginLeft: 4 }}>pts</span>
                    </div>

                    {/* Accuracy ring */}
                    <AccuracyRing pct={player.accuracy} size={40} color={player.accuracy >= 55 ? C.green : player.accuracy >= 45 ? C.cyan : C.red} />

                    {/* Form */}
                    <div style={{ display: "flex", gap: 3 }}>
                      {player.form.map((f, i) => (
                        <FormBadge key={i} result={f as "W" | "L" | "P"} />
                      ))}
                    </div>

                    {/* Streak */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {player.streakType === "W" ? (
                        <span style={{ color: C.green, fontSize: 12 }}>🔥</span>
                      ) : (
                        <span style={{ color: C.red, fontSize: 12 }}>❄️</span>
                      )}
                      <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: player.streakType === "W" ? C.green : C.red }}>
                        {player.streak}
                      </span>
                    </div>

                    {/* Movement */}
                    <MovementBadge n={player.movement} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═════════════════════════════════════════════════════════════════
              SECTION 4: ANALYTICS
          ══════════════════════════════════════════════════════════════════ */}
          <section style={{ marginTop: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 3, height: 22, background: C.cyan, borderRadius: 2, boxShadow: C.cyanGlow }} />
              <h2 style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: C.text, margin: 0 }}>
                ANALYTICS
              </h2>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>PERFORMANCE METRICS</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Accuracy rings per player */}
              <div
                style={{
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "20px",
                }}
              >
                <div style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, letterSpacing: "0.12em", marginBottom: 16 }}>
                  ACCURACY — ALL PLAYERS
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  {leaderboard.map((p) => (
                    <div key={p.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <AccuracyRing pct={p.accuracy} size={52} color={p.accuracy >= 55 ? C.green : p.accuracy >= 45 ? C.cyan : C.red} />
                      <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Points accumulation bar chart */}
              <div
                style={{
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "20px",
                }}
              >
                <div style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, letterSpacing: "0.12em", marginBottom: 16 }}>
                  POINTS ACCUMULATION
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {leaderboard.map((p) => {
                    const maxPts = leaderboard[0].points;
                    const pct = Math.round((p.points / maxPts) * 100);
                    return (
                      <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, width: 44, textAlign: "right", flexShrink: 0 }}>
                          {p.name}
                        </span>
                        <div style={{ flex: 1, height: 20, background: C.border, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: p.rank === 1
                                ? `linear-gradient(90deg, ${C.green}, #00ffaa)`
                                : `linear-gradient(90deg, ${C.cyan}88, ${C.cyan}55)`,
                              borderRadius: 4,
                              boxShadow: p.rank === 1 ? `0 0 8px ${C.green}66` : "none",
                            }}
                          />
                        </div>
                        <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, color: p.rank === 1 ? C.green : C.text, width: 28, flexShrink: 0 }}>
                          {p.points}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Head to Head */}
            <div
              style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: "20px",
                marginBottom: 16,
              }}
            >
              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, letterSpacing: "0.12em", marginBottom: 20 }}>
                HEAD TO HEAD — DAVO vs GER
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "center" }}>
                {/* Player 1 */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: C.sans, fontSize: 18, fontWeight: 800, color: C.green, marginBottom: 4 }}>Davo</div>
                  <div style={{ fontFamily: C.mono, fontSize: 28, fontWeight: 900, color: C.green, textShadow: C.greenGlow }}>47</div>
                  <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, marginBottom: 12 }}>points</div>
                  {[
                    { label: "CORRECT", val: 14, max: 24 },
                    { label: "ACCURACY", val: 58, max: 100 },
                    { label: "STREAK", val: 5, max: 10 },
                  ].map((m) => (
                    <div key={m.label} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{m.label}</span>
                        <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.green }}>{m.val}{m.label === "ACCURACY" ? "%" : ""}</span>
                      </div>
                      <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(m.val / m.max) * 100}%`, background: C.green, borderRadius: 2, float: "right", boxShadow: `0 0 4px ${C.green}88` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* VS */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: C.surface,
                    border: `2px solid ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: C.mono,
                    fontSize: 12,
                    fontWeight: 900,
                    color: C.muted,
                  }}
                >
                  VS
                </div>

                {/* Player 2 */}
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontFamily: C.sans, fontSize: 18, fontWeight: 800, color: C.cyan, marginBottom: 4 }}>Ger</div>
                  <div style={{ fontFamily: C.mono, fontSize: 28, fontWeight: 900, color: C.cyan, textShadow: C.cyanGlow }}>44</div>
                  <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, marginBottom: 12 }}>points</div>
                  {[
                    { label: "CORRECT", val: 13, max: 24 },
                    { label: "ACCURACY", val: 54, max: 100 },
                    { label: "STREAK", val: 2, max: 10 },
                  ].map((m) => (
                    <div key={m.label} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.cyan }}>{m.val}{m.label === "ACCURACY" ? "%" : ""}</span>
                        <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{m.label}</span>
                      </div>
                      <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(m.val / m.max) * 100}%`, background: C.cyan, borderRadius: 2, boxShadow: `0 0 4px ${C.cyan}88` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Best in class */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              {[
                { label: "BEST SOCCER PREDICTOR", winner: "Davo", pct: 78, icon: "⚽" },
                { label: "BEST F1 PREDICTOR", winner: "Davo", pct: 100, icon: "🏎️" },
                { label: "BEST GAA PREDICTOR", winner: "Nidge", pct: 83, icon: "🥍" },
                { label: "UPSET KING", winner: "Sully", pct: 3, icon: "🎯" },
              ].map((cat) => (
                <div
                  key={cat.label}
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.yellow}33`,
                    borderRadius: 12,
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{cat.icon}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.yellow, letterSpacing: "0.12em", fontWeight: 700, marginBottom: 4 }}>
                    {cat.label}
                  </div>
                  <div style={{ fontFamily: C.sans, fontSize: 16, fontWeight: 800, color: C.text }}>{cat.winner}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, marginTop: 4 }}>{cat.pct}% accuracy</div>
                  <div
                    style={{
                      display: "inline-block",
                      fontFamily: C.mono,
                      fontSize: 8,
                      fontWeight: 700,
                      color: C.yellow,
                      background: "#ffd70022",
                      border: "1px solid #ffd70033",
                      borderRadius: 4,
                      padding: "2px 8px",
                      marginTop: 6,
                      letterSpacing: "0.1em",
                    }}
                  >
                    BEST IN CLASS
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═════════════════════════════════════════════════════════════════
              SECTION 5: ACHIEVEMENTS
          ══════════════════════════════════════════════════════════════════ */}
          <section style={{ marginTop: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 3, height: 22, background: C.yellow, borderRadius: 2, boxShadow: `0 0 12px ${C.yellow}88` }} />
              <h2 style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: C.text, margin: 0 }}>
                ACHIEVEMENT UNLOCKED
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                gap: 14,
              }}
            >
              {[
                { id: "first_blood", icon: "🩸", name: "FIRST BLOOD", desc: "First correct pick", unlocked: true, color: C.red },
                { id: "hat_trick", icon: "🎩", name: "HAT TRICK", desc: "3 correct in a row", unlocked: true, color: C.green },
                { id: "underdog", icon: "🐕", name: "UNDERDOG", desc: "Correct upset pick", unlocked: true, color: C.cyan },
                { id: "on_fire", icon: "🔥", name: "ON FIRE", desc: "5-win streak", unlocked: true, color: "#ff6b35" },
                { id: "oracle", icon: "🔮", name: "THE ORACLE", desc: "10 in a row", unlocked: false, color: C.yellow },
                { id: "perfect", icon: "💯", name: "PERFECT ROUND", desc: "100% in a round", unlocked: false, color: C.yellow },
                { id: "comeback", icon: "⚡", name: "COMEBACK KID", desc: "Win after 3 losses", unlocked: false, color: C.cyan },
                { id: "contrarian", icon: "🤡", name: "CONTRARIAN", desc: "Win vs 90% crowd", unlocked: false, color: C.muted },
              ].map((ach) => (
                <div
                  key={ach.id}
                  style={{
                    background: ach.unlocked ? C.panel : C.surface,
                    border: `1px solid ${ach.unlocked ? ach.color + "55" : C.border}`,
                    borderRadius: 12,
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    opacity: ach.unlocked ? 1 : 0.45,
                    boxShadow: ach.unlocked ? `0 0 16px ${ach.color}22` : "none",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {!ach.unlocked && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: `${C.bg}88`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        zIndex: 1,
                      }}
                    >
                      🔒
                    </div>
                  )}
                  <span style={{ fontSize: 28, marginBottom: 8, filter: ach.unlocked ? "none" : "grayscale(100%)" }}>
                    {ach.icon}
                  </span>
                  <div
                    style={{
                      fontFamily: C.mono,
                      fontSize: 10,
                      fontWeight: 800,
                      color: ach.unlocked ? ach.color : C.muted,
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    {ach.name}
                  </div>
                  <div style={{ fontFamily: C.sans, fontSize: 11, color: C.muted }}>{ach.desc}</div>
                  {ach.unlocked && (
                    <div
                      style={{
                        marginTop: 8,
                        fontFamily: C.mono,
                        fontSize: 8,
                        color: ach.color,
                        background: `${ach.color}11`,
                        border: `1px solid ${ach.color}33`,
                        borderRadius: 4,
                        padding: "2px 8px",
                        letterSpacing: "0.1em",
                      }}
                    >
                      UNLOCKED
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Intel Report / Fun Fact */}
            <div
              style={{
                marginTop: 24,
                background: `linear-gradient(135deg, ${C.cyanDim}, ${C.greenDim})`,
                border: `1px solid ${C.cyan}44`,
                borderRadius: 14,
                padding: "20px 24px",
              }}
            >
              <div style={{ fontFamily: C.mono, fontSize: 10, color: C.cyan, letterSpacing: "0.15em", fontWeight: 700, marginBottom: 12 }}>
                ▸ INTEL REPORT — ROUND {competition.round.number}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {[
                  { icon: "📊", text: stats.surpriseOfTheRound },
                  { icon: "🔥", text: `${stats.bestStreak.name} is on a ${stats.bestStreak.count}-win streak — hottest predictor in the group` },
                  { icon: "🎯", text: `Group average accuracy this round: ${stats.avgAccuracy}%` },
                  { icon: "⚔️", text: stats.closestRace },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontFamily: C.sans, fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer stats bar */}
            <div
              style={{
                marginTop: 24,
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "14px 20px",
                display: "flex",
                gap: 32,
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {[
                { label: "TOTAL PREDICTIONS", val: stats.totalPredictions },
                { label: "EVENTS RESULTED", val: `${stats.eventsResulted}/${stats.totalEvents}` },
                { label: "AVG ACCURACY", val: `${stats.avgAccuracy}%` },
                { label: "BEST STREAK", val: `${stats.bestStreak.count} (${stats.bestStreak.name})` },
                { label: "COMPETITORS", val: competition.memberCount },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 800, color: C.green, textShadow: C.greenGlow }}>
                    {s.val}
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.subtle, letterSpacing: "0.1em", marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
