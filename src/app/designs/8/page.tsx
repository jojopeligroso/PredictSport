"use client";

import Link from "next/link";
import {
  competition,
  leaderboard,
  events,
  stats,
  sportEmoji,
} from "../mock-data";

// ── Colour tokens ──────────────────────────────────────────────────────────
// WhatsApp dark mode vibes (#0b141a is WA dark bg, #111b21 is WA dark surface)
const C = {
  bg: "#0b141a",
  // Sports equipment pattern in light gold
  bgPattern: `url("data:image/svg+xml,%3Csvg width='220' height='220' xmlns='http://www.w3.org/2000/svg'%3E%3C!-- football --%3E%3Ccircle cx='30' cy='30' r='9' fill='none' stroke='%23c9a84c' stroke-width='0.6' opacity='0.07'/%3E%3Cpath d='M25,25 L35,35 M35,25 L25,35' stroke='%23c9a84c' stroke-width='0.4' opacity='0.07'/%3E%3C!-- chequered flag --%3E%3Crect x='110' y='18' width='4' height='4' fill='%23c9a84c' opacity='0.06'/%3E%3Crect x='118' y='18' width='4' height='4' fill='%23c9a84c' opacity='0.06'/%3E%3Crect x='114' y='22' width='4' height='4' fill='%23c9a84c' opacity='0.06'/%3E%3Crect x='110' y='26' width='4' height='4' fill='%23c9a84c' opacity='0.06'/%3E%3Crect x='118' y='26' width='4' height='4' fill='%23c9a84c' opacity='0.06'/%3E%3C!-- hurley + sliotar --%3E%3Cpath d='M170,20 L170,42 Q170,48 177,48' fill='none' stroke='%23c9a84c' stroke-width='0.6' opacity='0.07'/%3E%3Ccircle cx='178' cy='18' r='3' fill='none' stroke='%23c9a84c' stroke-width='0.5' opacity='0.07'/%3E%3C!-- basketball --%3E%3Ccircle cx='50' cy='120' r='9' fill='none' stroke='%23c9a84c' stroke-width='0.6' opacity='0.07'/%3E%3Cpath d='M41,120 L59,120 M50,111 L50,129' stroke='%23c9a84c' stroke-width='0.4' opacity='0.07'/%3E%3Cpath d='M42,114 Q50,120 42,126' fill='none' stroke='%23c9a84c' stroke-width='0.4' opacity='0.07'/%3E%3C!-- golf flag --%3E%3Cpath d='M130,105 L130,130' stroke='%23c9a84c' stroke-width='0.6' opacity='0.07'/%3E%3Cpath d='M130,105 L142,110 L130,115' fill='%23c9a84c' opacity='0.04'/%3E%3C!-- rugby ball --%3E%3Cellipse cx='185' cy='125' rx='11' ry='6.5' fill='none' stroke='%23c9a84c' stroke-width='0.6' opacity='0.07'/%3E%3Cpath d='M179,119 L191,131 M185,118.5 L185,131.5' stroke='%23c9a84c' stroke-width='0.4' opacity='0.05'/%3E%3C!-- trophy --%3E%3Cpath d='M88,160 L88,175 L98,175 L98,160 M83,160 Q83,154 88,152 L98,152 Q103,154 103,160' fill='none' stroke='%23c9a84c' stroke-width='0.6' opacity='0.07'/%3E%3Cline x1='88' y1='175' x2='98' y2='175' stroke='%23c9a84c' stroke-width='0.8' opacity='0.07'/%3E%3C!-- tennis racket --%3E%3Cellipse cx='165' cy='178' rx='7' ry='9' fill='none' stroke='%23c9a84c' stroke-width='0.6' opacity='0.07'/%3E%3Cline x1='165' y1='187' x2='165' y2='200' stroke='%23c9a84c' stroke-width='0.7' opacity='0.07'/%3E%3C!-- F1 helmet --%3E%3Cpath d='M25,180 Q25,170 35,170 Q45,170 45,180 L42,185 L28,185 Z' fill='none' stroke='%23c9a84c' stroke-width='0.5' opacity='0.06'/%3E%3C/svg%3E")`,
  surface: "#111b21",
  card: "#1b2830",
  border: "#233138",
  borderLight: "#2a3942",

  // Primary accent — warm gold
  amber: "#f5b731",
  amberLight: "#fcc843",
  amberDim: "rgba(245,183,49,0.1)",

  // Secondary — blue
  blue: "#3b82f6",
  blueLight: "#60a5fa",
  blueDim: "rgba(59,130,246,0.1)",

  // Tertiary — violet
  violet: "#8b5cf6",
  violetDim: "rgba(139,92,246,0.08)",

  // Semantic
  green: "#00a884",
  greenDim: "rgba(0,168,132,0.12)",
  red: "#f43f5e",
  redDim: "rgba(244,63,94,0.1)",

  // Text
  text: "#e9edef",
  textSecondary: "#8696a0",
  textMuted: "#667781",
  white: "#ffffff",
};

// Sport gradients
const sportGrad: Record<string, { from: string; to: string; pill: string; pillText: string }> = {
  Soccer: { from: "#2563eb", to: "#7c3aed", pill: "rgba(37,99,235,0.1)", pillText: "#2563eb" },
  "Formula 1": { from: "#dc2626", to: "#ea580c", pill: "rgba(220,38,38,0.1)", pillText: "#dc2626" },
  GAA: { from: "#059669", to: "#047857", pill: "rgba(5,150,105,0.1)", pillText: "#059669" },
  NBA: { from: "#d97706", to: "#dc2626", pill: "rgba(217,119,6,0.1)", pillText: "#b45309" },
  Golf: { from: "#4f46e5", to: "#7c3aed", pill: "rgba(79,70,229,0.1)", pillText: "#4f46e5" },
};

// Pick a participant's callout for each event (deterministic by event id)
function eventCallout(eventId: string): string {
  const idx = eventId.charCodeAt(0) % leaderboard.length;
  return leaderboard[idx].callout ?? `${leaderboard[idx].name} reckons...`;
}

// ── Utility components ─────────────────────────────────────────────────────

function SportPill({ sport }: { sport: string }) {
  const sg = sportGrad[sport] ?? { pill: C.blueDim, pillText: C.blue };
  return (
    <span
      style={{
        background: sg.pill,
        color: sg.pillText,
        fontSize: "0.68rem",
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 20,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      {sportEmoji[sport]} {sport}
    </span>
  );
}

function FormBadge({ result }: { result: "W" | "L" | "P" }) {
  const cfg = {
    W: { bg: C.greenDim, color: C.green },
    L: { bg: C.redDim, color: C.red },
    P: { bg: C.amberDim, color: C.amber },
  }[result];
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        background: cfg.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.62rem",
        fontWeight: 800,
        color: cfg.color,
      }}
    >
      {result}
    </div>
  );
}

function MovementBadge({ n }: { n: number }) {
  if (n === 0) return <span style={{ fontSize: "0.72rem", color: C.textMuted }}>--</span>;
  const up = n > 0;
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 700,
        color: up ? C.green : C.red,
        background: up ? C.greenDim : C.redDim,
        padding: "2px 8px",
        borderRadius: 20,
      }}
    >
      {up ? "+" : ""}{n}
    </span>
  );
}

function AccuracyRing({ pct, size = 40 }: { pct: number; size?: number }) {
  const color = pct >= 55 ? C.green : pct >= 45 ? C.blue : C.red;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `conic-gradient(${color} ${(pct / 100) * 360}deg, ${C.border} 0deg)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 5,
          borderRadius: "50%",
          background: C.card,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.58rem",
          fontWeight: 700,
          color: C.text,
        }}
      >
        {pct}%
      </div>
    </div>
  );
}

function DonutChart({ segments, total }: { segments: { label: string; count: number; color: string }[]; total: number }) {
  let cumDeg = 0;
  const arcs = segments.map((s) => {
    const deg = Math.round((s.count / total) * 360);
    const start = cumDeg;
    cumDeg += deg;
    return { ...s, start, deg };
  });
  const conicStr = arcs.map((a) => `${a.color} ${a.start}deg ${a.start + a.deg}deg`).join(", ");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: `conic-gradient(${conicStr})` }} />
        <div
          style={{
            position: "absolute",
            inset: 10,
            borderRadius: "50%",
            background: C.card,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.62rem",
            fontWeight: 700,
            color: C.textMuted,
          }}
        >
          {total}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.72rem", color: C.textSecondary }}>{s.label}</span>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: C.text, marginLeft: "auto" }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonaCallout({ label, text }: { label: string; text: string }) {
  return (
    <div
      style={{
        background: C.amberDim,
        borderLeft: `3px solid ${C.amberLight}`,
        borderRadius: "0 10px 10px 0",
        padding: "10px 14px",
        marginTop: 12,
      }}
    >
      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: C.amber, letterSpacing: "0.03em", marginBottom: 3 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: "0.78rem", color: C.textSecondary, fontStyle: "italic", lineHeight: 1.5 }}>
        {text}
      </div>
    </div>
  );
}

function SectionHeader({ label, accent = C.blue }: { label: string; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 4, height: 20, borderRadius: 2, background: accent }} />
      <h2
        style={{
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: C.textMuted,
          fontWeight: 700,
          margin: 0,
        }}
      >
        {label}
      </h2>
    </div>
  );
}

function ProgressBar({ pct, from, to }: { pct: number; from: string; to: string }) {
  return (
    <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${from}, ${to})`,
          borderRadius: 3,
        }}
      />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function HybridDesign() {
  const roundPct = Math.round((competition.round.number / competition.totalRounds) * 100);
  const upcoming = events.filter((e) => e.status === "upcoming");
  const resulted = events.filter((e) => e.status === "resulted");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `${C.bg}`,
        backgroundImage: C.bgPattern,
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: C.text,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header
        style={{
          background: C.surface,
          padding: "20px 16px 24px",
          borderBottom: `1px solid ${C.border}`,
          backgroundImage: C.bgPattern,
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          {/* Back nav */}
          <Link
            href="/designs"
            style={{
              fontSize: "0.72rem",
              color: C.textMuted,
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-block",
              marginBottom: 16,
            }}
          >
            &larr; Back to designs
          </Link>

          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 300,
                color: C.text,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Predict<span style={{ fontWeight: 700, color: C.amber }}>Sport</span>
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: C.greenDim,
                borderRadius: 20,
                padding: "4px 12px 4px 8px",
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} />
              <span style={{ fontSize: "0.68rem", color: C.green, fontWeight: 600 }}>Live</span>
            </div>
          </div>

          <p style={{ fontSize: "0.82rem", color: C.textSecondary, margin: "0 0 2px" }}>
            {competition.name}
          </p>
          <p style={{ fontSize: "0.72rem", color: C.textMuted, fontStyle: "italic", margin: "0 0 16px" }}>
            {competition.description}
          </p>

          {/* Round progress */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: "0.68rem", color: C.textMuted, fontWeight: 600 }}>
                {competition.round.name}
              </span>
              <span style={{ fontSize: "0.68rem", color: C.amber, fontWeight: 700 }}>
                {competition.round.number}/{competition.totalRounds}
              </span>
            </div>
            <ProgressBar pct={roundPct} from={C.amber} to={C.amberLight} />
          </div>

          {/* Stat row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { label: "Players", value: competition.memberCount },
              { label: "Events", value: stats.totalEvents },
              { label: "Picks", value: stats.totalPredictions },
              { label: "Leader", value: leaderboard[0].name },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: C.bg,
                  borderRadius: 12,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: C.text, lineHeight: 1 }}>
                  {item.value}
                </div>
                <div style={{ fontSize: "0.58rem", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 48px" }}>

        {/* ── UPCOMING EVENTS ── */}
        <section style={{ marginBottom: 36 }}>
          <SectionHeader label="Make Your Picks" accent={C.amber} />

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {upcoming.map((event) => {
              const sg = sportGrad[event.sport] ?? { from: C.blue, to: C.violet };
              const gp = event.groupPredictions as Record<string, number>;
              const total = Object.values(gp).reduce((a, b) => a + b, 0);
              const keys = Object.keys(gp);

              const segments = keys.map((k, i) => ({
                label: k.charAt(0).toUpperCase() + k.slice(1),
                count: gp[k],
                color: [C.blue, C.violet, C.textMuted][i] ?? C.textMuted,
              }));

              return (
                <div
                  key={event.id}
                  style={{
                    background: C.card,
                    borderRadius: 14,
                    overflow: "hidden",
                    border: `1px solid ${C.border}`,
                  }}
                >
                  {/* Gradient accent bar */}
                  <div style={{ height: 3, background: `linear-gradient(90deg, ${sg.from}, ${sg.to})` }} />

                  <div style={{ padding: "16px" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <SportPill sport={event.sport} />
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: C.text, marginTop: 8, marginBottom: 2, lineHeight: 1.3 }}>
                          {event.name}
                        </h3>
                        <p style={{ fontSize: "0.72rem", color: C.textMuted, margin: 0 }}>{event.league}</p>
                      </div>
                      <div
                        style={{
                          background: C.amberDim,
                          borderRadius: 10,
                          padding: "6px 10px",
                          textAlign: "center",
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: C.amber }}>
                          {(() => {
                            const diff = new Date(event.lockTime).getTime() - Date.now();
                            if (diff <= 0) return "Locked";
                            const h = Math.floor(diff / 3_600_000);
                            const m = Math.floor((diff % 3_600_000) / 60_000);
                            if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
                            if (h > 0) return `${h}h ${m}m`;
                            return `${m}m`;
                          })()}
                        </div>
                        <div style={{ fontSize: "0.58rem", color: C.textMuted, marginTop: 1 }}>to lock</div>
                      </div>
                    </div>

                    {/* Fun fact — per-participant persona callout */}
                    {event.funFacts?.[0] && (
                      <PersonaCallout label={eventCallout(event.id)} text={event.funFacts[0]} />
                    )}

                    {/* Community predictions */}
                    {total > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <p style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.textMuted, marginBottom: 8 }}>
                          What the lads picked
                        </p>
                        <DonutChart segments={segments} total={total} />
                      </div>
                    )}

                    {/* Pick buttons */}
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      {keys.slice(0, 3).map((key, i) => (
                        <button
                          key={key}
                          style={{
                            flex: 1,
                            padding: "12px 6px",
                            borderRadius: 10,
                            border: i === 0 ? `2px solid ${C.amber}` : `1px solid ${C.border}`,
                            background: i === 0 ? C.amberDim : C.bg,
                            color: i === 0 ? C.amber : C.textSecondary,
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── RESULTS ── */}
        <section style={{ marginBottom: 36 }}>
          <SectionHeader label="Results" accent={C.green} />

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {resulted.map((event) => {
              const sg = sportGrad[event.sport] ?? { from: C.blue, to: C.violet };
              const pred = event.userPrediction as { pick: string; isCorrect: boolean; pointsAwarded: number } | undefined;
              if (!pred) return null;
              const correct = pred.isCorrect;

              return (
                <div
                  key={event.id}
                  style={{
                    background: C.card,
                    borderRadius: 14,
                    overflow: "hidden",
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ height: 3, background: `linear-gradient(90deg, ${sg.from}, ${sg.to})` }} />

                  <div style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <SportPill sport={event.sport} />
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: C.text, marginTop: 8, marginBottom: 0, lineHeight: 1.3 }}>
                          {event.name}
                        </h3>
                      </div>
                      <div
                        style={{
                          background: correct
                            ? `linear-gradient(135deg, #059669, ${C.green})`
                            : `linear-gradient(135deg, #dc2626, #ef4444)`,
                          borderRadius: 12,
                          padding: "8px 14px",
                          textAlign: "center",
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: C.white }}>+{pred.pointsAwarded}</div>
                        <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.75)" }}>pts</div>
                      </div>
                    </div>

                    {/* Result row */}
                    <div
                      style={{
                        background: C.bg,
                        borderRadius: 10,
                        padding: "12px 14px",
                        marginTop: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.6rem", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Result</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: C.text, marginTop: 2 }}>
                          {(event as { result?: string }).result ?? "Completed"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.6rem", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your pick</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: correct ? C.green : C.red, marginTop: 2 }}>
                          {pred.pick}
                        </div>
                      </div>
                    </div>

                    {/* Verdict */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: correct ? C.greenDim : C.redDim,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.65rem",
                          color: correct ? C.green : C.red,
                        }}
                      >
                        {correct ? "\u2713" : "\u2717"}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: C.textMuted, fontStyle: "italic" }}>
                        {correct ? "Well played \u2014 the gaffer would be proud" : "Ah sure look... there\u2019s always next week"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── LEADERBOARD ── */}
        <section style={{ marginBottom: 36 }}>
          <SectionHeader label="The Table" accent={C.amberLight} />

          {/* Race callout */}
          <div
            style={{
              background: C.amberDim,
              borderLeft: `3px solid ${C.amberLight}`,
              borderRadius: "0 10px 10px 0",
              padding: "10px 14px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: "1rem" }}>&#9876;&#65039;</span>
            <p style={{ fontSize: "0.78rem", color: C.textSecondary, margin: 0, lineHeight: 1.4 }}>
              <strong style={{ color: C.amber }}>Going to the wire</strong> &mdash; {stats.closestRace}
            </p>
          </div>

          {/* Podium top 3 — stacked on mobile for readability */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            {leaderboard.slice(0, 3).map((entry) => {
              const cfgs: Record<number, { grad: string; accent: string; emoji: string }> = {
                1: { grad: `linear-gradient(135deg, ${C.blue}, ${C.violet})`, accent: "#fbbf24", emoji: "\uD83E\uDD47" },
                2: { grad: "linear-gradient(135deg, #475569, #64748b)", accent: "#e2e8f0", emoji: "\uD83E\uDD48" },
                3: { grad: "linear-gradient(135deg, #92400e, #b45309)", accent: "#fcd34d", emoji: "\uD83E\uDD49" },
              };
              const cfg = cfgs[entry.rank] ?? cfgs[3];

              return (
                <div
                  key={entry.rank}
                  style={{
                    background: cfg.grad,
                    borderRadius: 14,
                    padding: "16px",
                    color: C.white,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    boxShadow: entry.rank === 1 ? "0 4px 20px rgba(59,130,246,0.25)" : "0 2px 10px rgba(0,0,0,0.3)",
                  }}
                >
                  <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{cfg.emoji}</span>

                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.15)",
                      border: `2px solid ${cfg.accent}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {entry.avatar}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.92rem", fontWeight: 700 }}>{entry.name}</div>
                    <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                      {entry.form.map((f, i) => <FormBadge key={i} result={f} />)}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.55)", marginTop: 4, fontStyle: "italic" }}>
                      {entry.funFact}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, color: cfg.accent, lineHeight: 1 }}>
                      {entry.points}
                    </div>
                    <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.5)" }}>pts</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rest of table */}
          <div
            style={{
              background: C.card,
              borderRadius: 14,
              overflow: "hidden",
              border: `1px solid ${C.border}`,
            }}
          >
            {leaderboard.slice(3).map((entry, i, arr) => (
              <div
                key={entry.rank}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < arr.length - 1 ? `1px solid ${C.borderLight}` : "none",
                }}
              >
                <span style={{ width: 20, textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: C.textMuted, flexShrink: 0 }}>
                  {entry.rank}
                </span>

                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: C.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: C.textSecondary,
                    flexShrink: 0,
                  }}
                >
                  {entry.avatar}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: C.text }}>{entry.name}</div>
                  <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
                    {entry.form.map((f, fi) => <FormBadge key={fi} result={f} />)}
                  </div>
                </div>

                <AccuracyRing pct={entry.accuracy} size={36} />

                <div style={{ textAlign: "right", minWidth: 36 }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 800, color: C.text }}>{entry.points}</div>
                  <div style={{ fontSize: "0.55rem", color: C.textMuted }}>pts</div>
                </div>

                <MovementBadge n={entry.movement} />
              </div>
            ))}
          </div>
        </section>

        {/* ── INSIGHTS ── */}
        <section style={{ marginBottom: 36 }}>
          <SectionHeader label="The Back Page" accent={C.violet} />

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Accuracy by sport */}
            <div style={{ background: C.card, borderRadius: 14, padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted, marginBottom: 14, marginTop: 0 }}>
                Accuracy by Sport
              </h3>
              {[
                { label: "\u26BD Soccer", pct: 54, from: "#2563eb", to: "#7c3aed" },
                { label: "\uD83C\uDFCE\uFE0F Formula 1", pct: 48, from: "#dc2626", to: "#ea580c" },
                { label: "\uD83E\uDD4E GAA", pct: 61, from: "#059669", to: "#047857" },
                { label: "\uD83C\uDFC0 NBA", pct: 38, from: "#d97706", to: "#dc2626" },
                { label: "\u26F3 Golf", pct: 29, from: "#4f46e5", to: "#7c3aed" },
              ].map((sport) => (
                <div key={sport.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.75rem", color: C.textSecondary }}>{sport.label}</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C.text }}>{sport.pct}%</span>
                  </div>
                  <ProgressBar pct={sport.pct} from={sport.from} to={sport.to} />
                </div>
              ))}
            </div>

            {/* Supporter of the Round */}
            <div
              style={{
                background: `linear-gradient(135deg, ${C.blue}, ${C.violet})`,
                borderRadius: 14,
                padding: "16px",
                color: C.white,
                boxShadow: "0 4px 16px rgba(59,130,246,0.2)",
              }}
            >
              <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>
                Supporter of the Round
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    border: "2px solid rgba(255,255,255,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {leaderboard[0].avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{leaderboard[0].name}</div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                    {leaderboard[0].streak} win streak &middot; {leaderboard[0].accuracy}% accuracy
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: "0.72rem",
                  color: "rgba(255,255,255,0.7)",
                  fontStyle: "italic",
                  lineHeight: 1.4,
                }}
              >
                {leaderboard[0].funFact}
              </div>
            </div>

            {/* Surprise of the Round */}
            <div
              style={{
                background: C.amberDim,
                borderRadius: 14,
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", color: C.amber, fontWeight: 700, marginBottom: 8 }}>
                Surprise of the Round
              </div>
              <div style={{ fontSize: "0.82rem", color: C.textSecondary, lineHeight: 1.5 }}>
                {stats.surpriseOfTheRound}
              </div>
            </div>

            {/* Player accuracy */}
            <div style={{ background: C.card, borderRadius: 14, padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted, marginBottom: 14, marginTop: 0 }}>
                Accuracy &mdash; All Players
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {leaderboard.map((p) => (
                  <div key={p.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                    <AccuracyRing pct={p.accuracy} size={44} />
                    <span style={{ fontSize: "0.68rem", color: C.textMuted }}>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Best in class */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Best Soccer", winner: "Davo", pct: 78, icon: "\u26BD" },
                { label: "Best F1", winner: "Davo", pct: 100, icon: "\uD83C\uDFCE\uFE0F" },
                { label: "Best GAA", winner: "Nidge", pct: 83, icon: "\uD83E\uDD4E" },
                { label: "Upset King", winner: "Sully", pct: 3, icon: "\uD83C\uDFAF" },
              ].map((cat) => (
                <div
                  key={cat.label}
                  style={{
                    background: C.card,
                    borderRadius: 12,
                    padding: "14px",
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ fontSize: "1.2rem", marginBottom: 6 }}>{cat.icon}</div>
                  <div style={{ fontSize: "0.6rem", fontWeight: 700, color: C.amber, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 800, color: C.text }}>{cat.winner}</div>
                  <div style={{ fontSize: "0.68rem", color: C.textMuted, marginTop: 3 }}>{cat.pct}% accuracy</div>
                </div>
              ))}
            </div>

            {/* Intel report */}
            <div
              style={{
                background: C.blueDim,
                borderLeft: `3px solid ${C.blueLight}`,
                borderRadius: "0 12px 12px 0",
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: C.blue, letterSpacing: "0.06em", marginBottom: 10 }}>
                INTEL REPORT &mdash; ROUND {competition.round.number}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: "\uD83D\uDCCA", text: stats.surpriseOfTheRound },
                  { icon: "\uD83D\uDD25", text: `${stats.bestStreak.name} is on a ${stats.bestStreak.count}-win streak` },
                  { icon: "\uD83C\uDFAF", text: `Group average accuracy: ${stats.avgAccuracy}%` },
                  { icon: "\u2694\uFE0F", text: stats.closestRace },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ fontSize: "0.88rem", flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: "0.75rem", color: C.textSecondary, lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER STATS ── */}
        <div
          style={{
            background: C.card,
            borderRadius: 14,
            padding: "14px 16px",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
            border: `1px solid ${C.border}`,
          }}
        >
          {[
            { label: "Predictions", val: stats.totalPredictions },
            { label: "Resulted", val: `${stats.eventsResulted}/${stats.totalEvents}` },
            { label: "Accuracy", val: `${stats.avgAccuracy}%` },
            { label: "Streak", val: `${stats.bestStreak.count}` },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: C.amber }}>{s.val}</div>
              <div style={{ fontSize: "0.55rem", color: C.textMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── FOOTER ── */}
        <footer style={{ marginTop: 32, textAlign: "center" }}>
          <div style={{ fontSize: "0.68rem", color: C.textMuted, fontStyle: "italic" }}>
            All predictions final. No refunds. The craic is always free.
          </div>
          <Link
            href="/designs"
            style={{
              display: "inline-block",
              marginTop: 10,
              fontSize: "0.68rem",
              color: C.textMuted,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            &larr; All Designs
          </Link>
        </footer>
      </main>
    </div>
  );
}
