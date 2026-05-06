// Design 3: "The Bookie" — Paddy Power swagger, coupon aesthetic, betting shop personality
// Usage: visit /designs/3 to preview

import Link from "next/link";
import { competition, leaderboard, events, stats } from "../mock-data";

// ─── Colour tokens ────────────────────────────────────────────────────────────
const G = {
  green: "#004833",
  greenLight: "#005a3d",
  greenDark: "#003527",
  gold: "#ffd700",
  goldDark: "#e6c200",
  goldLight: "#fff3a0",
  white: "#ffffff",
  cream: "#f5f0e0",
  creamDark: "#ede5cc",
  black: "#1a1a1a",
  red: "#cc2200",
  grey: "#888880",
  slipBg: "#fffdf5",
};

// ─── Felt texture background (CSS radial gradient noise) ─────────────────────
const feltBg = {
  background: `
    radial-gradient(ellipse at 20% 50%, rgba(0,80,50,0.15) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba(0,60,35,0.1) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, #004833 0%, #003a2b 60%, #002e22 100%)
  `,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatCountdown(isoTime: string): string {
  const ms = new Date(isoTime).getTime() - Date.now();
  if (ms <= 0) return "CLOSED";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function impliedOdds(n: number): string {
  if (!n || n <= 0) return "-";
  return `${Math.round((1 / n) * 100)}%`;
}

function groupTotal(preds: Record<string, number>): number {
  return Object.values(preds).reduce((a, b) => a + b, 0);
}

function groupPct(val: number, total: number): number {
  return total === 0 ? 0 : Math.round((val / total) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PaddySays({ text }: { text: string }) {
  return (
    <div
      style={{
        background: G.gold,
        color: G.black,
        borderRadius: 4,
        padding: "0.5rem 0.75rem",
        fontSize: "0.78rem",
        fontFamily: "Georgia, serif",
        fontStyle: "italic",
        lineHeight: 1.4,
        margin: "0.5rem 0",
        borderLeft: `4px solid ${G.goldDark}`,
        position: "relative",
      }}
    >
      <span
        style={{
          fontWeight: 800,
          fontStyle: "normal",
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.65rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          display: "block",
          marginBottom: 2,
        }}
      >
        PADDY SAYS...
      </span>
      {text}
    </div>
  );
}

function OddsBox({
  label,
  odds,
  pct,
  highlight,
  isValuePick,
}: {
  label: string;
  odds: number;
  pct: number;
  highlight?: boolean;
  isValuePick?: boolean;
}) {
  return (
    <div style={{ flex: 1, position: "relative" }}>
      {isValuePick && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            background: G.gold,
            color: G.black,
            fontSize: "0.6rem",
            fontWeight: 800,
            fontFamily: "system-ui, sans-serif",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "2px 6px",
            borderRadius: 2,
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          VALUE PICK
        </div>
      )}
      <div
        style={{
          background: highlight ? G.gold : G.white,
          color: highlight ? G.black : G.black,
          border: `2px solid ${highlight ? G.goldDark : "#ccc8b8"}`,
          borderRadius: 4,
          padding: "0.6rem 0.4rem",
          textAlign: "center",
          cursor: "pointer",
          transition: "transform 0.1s",
        }}
      >
        <div
          style={{
            fontSize: "0.65rem",
            fontFamily: "system-ui, sans-serif",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: highlight ? G.black : "#555",
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "1.35rem",
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            lineHeight: 1,
            color: G.black,
          }}
        >
          {odds > 0 ? odds.toFixed(2) : "—"}
        </div>
        <div
          style={{
            fontSize: "0.6rem",
            color: "#777",
            marginTop: 2,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {impliedOdds(odds)} implied
        </div>
        {pct > 0 && (
          <div
            style={{
              marginTop: 4,
              fontSize: "0.6rem",
              fontWeight: 700,
              color: highlight ? G.black : G.green,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {pct}% of group
          </div>
        )}
      </div>
    </div>
  );
}

function GroupMoneyBar({
  preds,
}: {
  preds: Record<string, number>;
}) {
  const total = groupTotal(preds);
  const entries = Object.entries(preds);
  const colours = [G.green, G.gold, "#cc2200", "#0055aa", "#7700cc"];
  return (
    <div>
      <div
        style={{
          fontSize: "0.65rem",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "#777",
          marginBottom: 4,
        }}
      >
        THE GROUP&apos;S MONEY
      </div>
      <div
        style={{
          display: "flex",
          height: 14,
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid #ccc8b8",
        }}
      >
        {entries.map(([key, val], i) => {
          const pct = groupPct(val, total);
          return (
            <div
              key={key}
              title={`${key}: ${pct}%`}
              style={{
                width: `${pct}%`,
                background: colours[i % colours.length],
                transition: "width 0.3s",
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginTop: 4,
          flexWrap: "wrap",
        }}
      >
        {entries.map(([key, val], i) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: "0.62rem",
              fontFamily: "system-ui, sans-serif",
              color: "#555",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                background: colours[i % colours.length],
                borderRadius: 1,
                flexShrink: 0,
              }}
            />
            {key}: {groupPct(val, total)}% ({val})
          </div>
        ))}
      </div>
    </div>
  );
}

function CashOutButton() {
  return (
    <button
      style={{
        background: `linear-gradient(135deg, ${G.gold} 0%, ${G.goldDark} 100%)`,
        color: G.black,
        border: "none",
        borderRadius: 4,
        padding: "0.45rem 1rem",
        fontSize: "0.75rem",
        fontWeight: 800,
        fontFamily: "system-ui, sans-serif",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        cursor: "pointer",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}
    >
      CASH OUT
    </button>
  );
}

function ResultStamp({ correct }: { correct: boolean }) {
  return (
    <div
      style={{
        display: "inline-block",
        border: `3px solid ${correct ? G.gold : G.red}`,
        color: correct ? G.gold : G.red,
        padding: "0.2rem 0.7rem",
        borderRadius: 4,
        fontSize: "1.1rem",
        fontFamily: "Georgia, serif",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        transform: "rotate(-3deg)",
        opacity: 0.92,
        whiteSpace: "nowrap",
      }}
    >
      {correct ? "WINNER!" : "HARD LUCK"}
    </div>
  );
}

function FormPip({ result }: { result: "W" | "P" | "L" }) {
  const colours = { W: G.green, P: G.gold, L: G.red };
  const labels = { W: "W", P: "P", L: "L" };
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 3,
        background: colours[result],
        color: result === "P" ? G.black : G.white,
        fontSize: "0.6rem",
        fontWeight: 800,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {labels[result]}
    </div>
  );
}

function MovementArrow({ movement }: { movement: number }) {
  if (movement === 0)
    return (
      <span
        style={{
          color: "#666",
          fontSize: "0.75rem",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        —
      </span>
    );
  return (
    <span
      style={{
        color: movement > 0 ? G.gold : G.red,
        fontSize: "0.8rem",
        fontWeight: 700,
      }}
    >
      {movement > 0 ? "▲" : "▼"} {Math.abs(movement)}
    </span>
  );
}

// ─── Section header in coupon style ──────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: G.black,
        color: G.gold,
        padding: "0.6rem 1.5rem",
        fontFamily: "Georgia, serif",
        fontSize: "1.1rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        marginBottom: "1.25rem",
      }}
    >
      <div
        style={{
          width: 4,
          height: 20,
          background: G.gold,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      {children}
    </div>
  );
}

// ─── Perforated divider (like a betting slip) ─────────────────────────────────
function PerforationLine() {
  return (
    <div
      style={{
        margin: "1rem 0",
        borderTop: "2px dashed #d4cba8",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -12,
          top: -7,
          width: 13,
          height: 13,
          borderRadius: "50%",
          background: G.cream,
          border: "2px dashed #d4cba8",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -12,
          top: -7,
          width: 13,
          height: 13,
          borderRadius: "50%",
          background: G.cream,
          border: "2px dashed #d4cba8",
        }}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BookiePage() {
  const upcomingEvents = events.filter((e) => e.status === "upcoming");
  const resultedEvents = events.filter((e) => e.status === "resulted");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: G.cream,
        color: G.black,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── 1. HERO HEADER ─────────────────────────────────────────────────── */}
      <header
        style={{
          background: G.green,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gold accent strip at very top */}
        <div
          style={{
            height: 6,
            background: `linear-gradient(90deg, ${G.gold} 0%, ${G.goldDark} 50%, ${G.gold} 100%)`,
          }}
        />

        {/* Felt texture overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(circle at 10% 90%, rgba(255,255,255,0.04) 0%, transparent 40%),
              radial-gradient(circle at 90% 10%, rgba(255,255,255,0.03) 0%, transparent 40%)
            `,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "1.5rem 1.5rem 1rem",
            position: "relative",
          }}
        >
          {/* Back link */}
          <Link
            href="/designs"
            style={{
              color: G.goldLight,
              fontSize: "0.75rem",
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "system-ui, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              display: "inline-block",
              marginBottom: "1rem",
              opacity: 0.85,
            }}
          >
            ← Back to Designs
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              {/* Wordmark */}
              <div
                style={{
                  fontSize: "0.65rem",
                  color: G.gold,
                  fontFamily: "system-ui, sans-serif",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  marginBottom: 4,
                }}
              >
                Est. 2026 &bull; Licensed &amp; Regulated
              </div>
              <h1
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "clamp(2.5rem, 7vw, 4rem)",
                  fontWeight: 700,
                  color: G.white,
                  lineHeight: 1,
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                THE <span style={{ color: G.gold }}>BOOKIE</span>
              </h1>
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "1rem",
                  color: G.goldLight,
                  fontStyle: "italic",
                  marginTop: 4,
                }}
              >
                {competition.name}
              </div>
            </div>

            {/* Coupon header panel */}
            <div
              style={{
                background: G.slipBg,
                border: `2px solid ${G.gold}`,
                borderRadius: 4,
                padding: "0.75rem 1.25rem",
                minWidth: 200,
              }}
            >
              <div
                style={{
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#888",
                  marginBottom: 2,
                }}
              >
                BEST BANTER GUARANTEED
              </div>
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: G.green,
                }}
              >
                {competition.round.name}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#555",
                  marginTop: 2,
                }}
              >
                {competition.memberCount} punters &bull; {stats.totalEvents} markets
              </div>
              <div
                style={{
                  marginTop: 6,
                  padding: "3px 8px",
                  background: G.green,
                  color: G.gold,
                  display: "inline-block",
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  borderRadius: 2,
                }}
              >
                ROUND {competition.round.number} OF {competition.totalRounds}
              </div>
            </div>
          </div>

          {/* Tagline strip */}
          <div
            style={{
              marginTop: "1rem",
              padding: "0.5rem 0",
              borderTop: "1px solid rgba(255,215,0,0.3)",
              display: "flex",
              gap: "2rem",
              flexWrap: "wrap",
            }}
          >
            {[
              `${stats.totalPredictions} bets placed`,
              `${stats.eventsResulted} results in`,
              `Group average: ${stats.avgAccuracy}% accuracy`,
              `${stats.closestRace}`,
            ].map((item, i) => (
              <span
                key={i}
                style={{
                  fontSize: "0.72rem",
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom gold strip */}
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${G.goldDark} 0%, ${G.gold} 50%, ${G.goldDark} 100%)`,
          }}
        />
      </header>

      {/* ── MONEY BACK BANNER ─────────────────────────────────────────────── */}
      <div
        style={{
          background: G.gold,
          color: G.black,
          textAlign: "center",
          padding: "0.55rem 1rem",
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.78rem",
          fontWeight: 800,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        MONEY BACK IF... Nidge somehow wins this — we&apos;ll all retire anyway &nbsp;|&nbsp;
        ODDS BOOST active on GAA markets &nbsp;|&nbsp; ACCA INSURANCE: 4/5 correct = partial points
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>

        {/* ── 2. THE COUPON — Upcoming Events ───────────────────────────── */}
        <SectionHeader>The Coupon — Open Markets</SectionHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {upcomingEvents.map((event) => {
            const total = groupTotal(event.groupPredictions as unknown as Record<string, number>);
            const oddsEntries = Object.entries(event.odds ?? {}) as [string, number][];
            // Find the underdog: highest odds value
            const maxOddsKey = oddsEntries.reduce(
              (best, curr) => (curr[1] > best[1] ? curr : best),
              oddsEntries[0] ?? ["", 0]
            )[0];
            const countdown = formatCountdown(event.lockTime);

            return (
              <div
                key={event.id}
                style={{
                  background: G.slipBg,
                  border: `1px solid #d4cba8`,
                  borderRadius: 6,
                  overflow: "hidden",
                  boxShadow: "0 3px 12px rgba(0,72,51,0.08)",
                }}
              >
                {/* Coupon top bar */}
                <div
                  style={{
                    background: G.green,
                    padding: "0.6rem 1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: G.white,
                        margin: 0,
                        lineHeight: 1.2,
                      }}
                    >
                      {event.name}
                    </h3>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: G.goldLight,
                        marginTop: 2,
                        fontFamily: "system-ui, sans-serif",
                      }}
                    >
                      {event.sport} &bull; {event.league}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        color: "rgba(255,255,255,0.6)",
                        fontFamily: "system-ui, sans-serif",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                      }}
                    >
                      MARKET CLOSES IN
                    </div>
                    <div
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        color: countdown === "CLOSED" ? G.red : G.gold,
                      }}
                    >
                      {countdown}
                    </div>
                  </div>
                </div>

                {/* Coupon body */}
                <div style={{ padding: "1rem" }}>
                  {/* Odds boxes */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem" }}>
                    {oddsEntries.slice(0, 3).map(([key, val]) => {
                      const pct = groupPct(
                        event.groupPredictions[key as keyof typeof event.groupPredictions] ?? 0,
                        total
                      );
                      return (
                        <OddsBox
                          key={key}
                          label={key.charAt(0).toUpperCase() + key.slice(1)}
                          odds={val}
                          pct={pct}
                          highlight={
                            (event.groupPredictions[key as keyof typeof event.groupPredictions] ?? 0) ===
                            Math.max(...Object.values(event.groupPredictions))
                          }
                          isValuePick={key === maxOddsKey}
                        />
                      );
                    })}
                  </div>

                  <PerforationLine />

                  {/* Group money bar */}
                  <div style={{ marginBottom: "0.85rem" }}>
                    <GroupMoneyBar preds={event.groupPredictions as unknown as Record<string, number>} />
                  </div>

                  {/* Fun facts */}
                  {event.funFacts.slice(0, 2).map((fact, i) => (
                    <PaddySays key={i} text={fact} />
                  ))}

                  <PerforationLine />

                  {/* Footer row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span
                        style={{
                          background: G.green,
                          color: G.gold,
                          padding: "3px 8px",
                          borderRadius: 2,
                          fontSize: "0.6rem",
                          fontWeight: 800,
                          fontFamily: "system-ui, sans-serif",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        ODDS BOOST
                      </span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: "#666",
                          fontFamily: "system-ui, sans-serif",
                        }}
                      >
                        {total} predictions in so far
                      </span>
                    </div>
                    <CashOutButton />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Resulted Events ───────────────────────────────────────────── */}
        <div style={{ marginTop: "2rem" }}>
          <SectionHeader>Settled Markets</SectionHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {resultedEvents.map((event) => {
              const isCorrect = event.userPrediction?.isCorrect ?? false;
              const cheekySummary = isCorrect
                ? "Bang on the money. Don't act surprised."
                : "Could've told you that. Did you even watch the build-up?";

              return (
                <div
                  key={event.id}
                  style={{
                    background: G.slipBg,
                    border: `1px solid ${isCorrect ? "#b8a830" : "#c4b89a"}`,
                    borderRadius: 6,
                    overflow: "hidden",
                    boxShadow: isCorrect
                      ? "0 2px 12px rgba(255,215,0,0.15)"
                      : "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      background: isCorrect ? "#003a27" : "#2a2218",
                      padding: "0.6rem 1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontFamily: "Georgia, serif",
                          fontSize: "1rem",
                          fontWeight: 700,
                          color: G.white,
                          margin: 0,
                        }}
                      >
                        {event.name}
                      </h3>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "rgba(255,255,255,0.5)",
                          fontFamily: "system-ui, sans-serif",
                          marginTop: 2,
                        }}
                      >
                        {event.sport} &bull; {event.league}
                      </div>
                    </div>
                    <ResultStamp correct={isCorrect} />
                  </div>

                  <div style={{ padding: "1rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "0.65rem",
                            color: "#888",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            fontFamily: "system-ui, sans-serif",
                            marginBottom: 2,
                          }}
                        >
                          RESULT
                        </div>
                        <div
                          style={{
                            fontFamily: "Georgia, serif",
                            fontSize: "1.15rem",
                            fontWeight: 700,
                            color: G.green,
                          }}
                        >
                          {event.result}
                        </div>
                      </div>
                      {event.userPrediction && (
                        <div
                          style={{
                            background: isCorrect ? "#e8f7e0" : "#fdecea",
                            border: `1px solid ${isCorrect ? "#a8d8a0" : "#f0b8b0"}`,
                            borderRadius: 4,
                            padding: "0.4rem 0.75rem",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.6rem",
                              color: "#888",
                              textTransform: "uppercase",
                              fontFamily: "system-ui, sans-serif",
                              letterSpacing: "0.07em",
                            }}
                          >
                            YOUR PICK
                          </div>
                          <div
                            style={{
                              fontFamily: "Georgia, serif",
                              fontWeight: 700,
                              fontSize: "0.9rem",
                              color: isCorrect ? G.green : G.red,
                            }}
                          >
                            {event.userPrediction.pick}
                          </div>
                          <div
                            style={{
                              fontSize: "0.65rem",
                              color: isCorrect ? G.green : G.red,
                              fontWeight: 700,
                              fontFamily: "system-ui, sans-serif",
                            }}
                          >
                            {isCorrect ? `+${event.userPrediction.pointsAwarded} pts` : "0 pts"}
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: "0.75rem",
                        padding: "0.5rem 0.75rem",
                        background: isCorrect ? G.goldLight : "#f5e8e5",
                        borderRadius: 3,
                        fontFamily: "Georgia, serif",
                        fontStyle: "italic",
                        fontSize: "0.8rem",
                        color: G.black,
                        borderLeft: `3px solid ${isCorrect ? G.gold : G.red}`,
                      }}
                    >
                      {cheekySummary}
                    </div>

                    {event.funFacts?.[0] && (
                      <PaddySays text={event.funFacts[0]} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 3. THE TABLE — Leaderboard ───────────────────────────────── */}
        <div style={{ marginTop: "2.5rem" }}>
          <SectionHeader>The Table</SectionHeader>

          <div
            style={{
              borderRadius: 8,
              overflow: "hidden",
              border: "2px solid #002d1e",
              boxShadow: "0 6px 24px rgba(0,72,51,0.25)",
            }}
          >
            {/* Felt header */}
            <div
              style={{
                ...feltBg,
                padding: "0.75rem 1rem",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 70px 50px 50px 50px 80px 80px",
                  gap: "0.5rem",
                  color: "rgba(255,215,0,0.7)",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                <div>POS</div>
                <div>PUNTER</div>
                <div style={{ textAlign: "center" }}>PTS</div>
                <div style={{ textAlign: "center" }}>W</div>
                <div style={{ textAlign: "center" }}>P</div>
                <div style={{ textAlign: "center" }}>L</div>
                <div style={{ textAlign: "center" }}>STRIKE RATE</div>
                <div style={{ textAlign: "center" }}>MOVE</div>
              </div>
            </div>

            {/* Rows */}
            {leaderboard.map((entry, idx) => {
              const isLeader = entry.rank === 1;
              const isOnRun = entry.streak >= 3 && entry.streakType === "W";
              const isOnSlide = entry.streak >= 3 && entry.streakType === "L";

              return (
                <div
                  key={entry.name}
                  style={{
                    background: isLeader
                      ? `linear-gradient(90deg, ${G.green} 0%, #005a3d 100%)`
                      : idx % 2 === 0
                      ? "#002c1c"
                      : "#003322",
                    padding: "0.75rem 1rem",
                    borderTop: isLeader ? `2px solid ${G.gold}` : "1px solid rgba(255,255,255,0.05)",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 70px 50px 50px 50px 80px 80px",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    {/* Position */}
                    <div
                      style={{
                        fontFamily: "Georgia, serif",
                        fontWeight: 700,
                        fontSize: isLeader ? "1.2rem" : "1rem",
                        color: isLeader ? G.gold : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {entry.rank}
                    </div>

                    {/* Name + badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: isLeader ? G.gold : "rgba(255,255,255,0.12)",
                          color: isLeader ? G.black : G.gold,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "Georgia, serif",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          flexShrink: 0,
                        }}
                      >
                        {entry.avatar}
                      </div>
                      <span
                        style={{
                          fontFamily: "Georgia, serif",
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          color: isLeader ? G.gold : G.white,
                        }}
                      >
                        {entry.name}
                      </span>
                      {isOnRun && (
                        <span
                          style={{
                            background: G.gold,
                            color: G.black,
                            padding: "1px 5px",
                            borderRadius: 2,
                            fontSize: "0.55rem",
                            fontWeight: 800,
                            fontFamily: "system-ui, sans-serif",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          ON A RUN
                        </span>
                      )}
                      {isOnSlide && (
                        <span
                          style={{
                            background: G.red,
                            color: G.white,
                            padding: "1px 5px",
                            borderRadius: 2,
                            fontSize: "0.55rem",
                            fontWeight: 800,
                            fontFamily: "system-ui, sans-serif",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          ON THE SLIDE
                        </span>
                      )}
                    </div>

                    {/* Points */}
                    <div
                      style={{
                        textAlign: "center",
                        fontFamily: "Georgia, serif",
                        fontWeight: 700,
                        fontSize: "1.2rem",
                        color: isLeader ? G.gold : G.white,
                      }}
                    >
                      {entry.points}
                    </div>

                    {/* W P L */}
                    <div style={{ textAlign: "center", color: G.green === "#004833" ? "#88d4a8" : G.white, fontSize: "0.85rem", fontFamily: "Georgia, serif" }}>
                      {entry.correct}
                    </div>
                    <div style={{ textAlign: "center", color: "#c8b860", fontSize: "0.85rem", fontFamily: "Georgia, serif" }}>
                      {entry.partial}
                    </div>
                    <div style={{ textAlign: "center", color: "#e08080", fontSize: "0.85rem", fontFamily: "Georgia, serif" }}>
                      {entry.wrong}
                    </div>

                    {/* Strike rate bar */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <div
                        style={{
                          width: "100%",
                          height: 6,
                          background: "rgba(255,255,255,0.1)",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${entry.accuracy}%`,
                            height: "100%",
                            background: isLeader
                              ? G.gold
                              : entry.accuracy >= 50
                              ? "#66cc88"
                              : "#cc6666",
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "0.62rem",
                          color: "rgba(255,255,255,0.5)",
                          fontFamily: "system-ui, sans-serif",
                        }}
                      >
                        {entry.accuracy}%
                      </div>
                    </div>

                    {/* Movement */}
                    <div style={{ textAlign: "center" }}>
                      <MovementArrow movement={entry.movement} />
                    </div>
                  </div>

                  {/* Form pips */}
                  <div
                    style={{
                      display: "flex",
                      gap: 3,
                      marginTop: 6,
                      paddingLeft: 88,
                    }}
                  >
                    {entry.form.map((f, i) => (
                      <FormPip key={i} result={f} />
                    ))}
                    <span
                      style={{
                        fontSize: "0.6rem",
                        color: "rgba(255,255,255,0.35)",
                        fontFamily: "system-ui, sans-serif",
                        alignSelf: "center",
                        marginLeft: 4,
                      }}
                    >
                      last 5
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Bottom banner */}
            <div
              style={{
                background: G.black,
                padding: "0.65rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  width: 3,
                  alignSelf: "stretch",
                  background: G.red,
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontStyle: "italic",
                  fontSize: "0.8rem",
                  color: G.gold,
                }}
              >
                {stats.closestRace} — we&apos;ve seen bigger comebacks. Barely.
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. THE STATS SHOP ──────────────────────────────────────────── */}
        <div style={{ marginTop: "2.5rem" }}>
          <SectionHeader>The Stats Shop</SectionHeader>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Form Guide */}
            <div
              style={{
                background: G.slipBg,
                border: "1px solid #d4cba8",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: G.green,
                  padding: "0.5rem 0.75rem",
                  fontFamily: "Georgia, serif",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: G.gold,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                Form Guide
              </div>
              <div style={{ padding: "0.75rem" }}>
                {leaderboard.map((entry) => (
                  <div
                    key={entry.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: 50,
                        fontFamily: "system-ui, sans-serif",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: G.black,
                      }}
                    >
                      {entry.name}
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      {entry.form.map((f, i) => (
                        <FormPip key={i} result={f} />
                      ))}
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    gap: "0.75rem",
                    fontSize: "0.6rem",
                    color: "#888",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 10, height: 10, background: G.green, borderRadius: 2 }} /> Win
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 10, height: 10, background: G.gold, borderRadius: 2 }} /> Partial
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 10, height: 10, background: G.red, borderRadius: 2 }} /> Loss
                  </span>
                </div>
              </div>
            </div>

            {/* Strike Rate bars */}
            <div
              style={{
                background: G.slipBg,
                border: "1px solid #d4cba8",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: G.green,
                  padding: "0.5rem 0.75rem",
                  fontFamily: "Georgia, serif",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: G.gold,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                Strike Rate
              </div>
              <div style={{ padding: "0.75rem" }}>
                {leaderboard.map((entry) => (
                  <div key={entry.name} style={{ marginBottom: "0.6rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 3,
                        fontSize: "0.72rem",
                        fontFamily: "system-ui, sans-serif",
                      }}
                    >
                      <span style={{ fontWeight: 700, color: G.black }}>{entry.name}</span>
                      <span style={{ color: "#666" }}>{entry.accuracy}%</span>
                    </div>
                    <div
                      style={{
                        height: 10,
                        background: "#e0d8c0",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${entry.accuracy}%`,
                          height: "100%",
                          background:
                            entry.accuracy >= 55
                              ? G.green
                              : entry.accuracy >= 45
                              ? G.gold
                              : G.red,
                          borderRadius: 3,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accumulator of the Day + Worst Bet */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Accumulator of the Day */}
              <div
                style={{
                  background: G.slipBg,
                  border: `2px solid ${G.gold}`,
                  borderRadius: 6,
                  overflow: "hidden",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    background: G.gold,
                    padding: "0.5rem 0.75rem",
                    fontFamily: "Georgia, serif",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: G.black,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}
                >
                  Accumulator of the Day
                </div>
                <div style={{ padding: "0.75rem" }}>
                  <div
                    style={{
                      fontFamily: "Georgia, serif",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      color: G.green,
                      marginBottom: 4,
                    }}
                  >
                    Davo &mdash; 4/4 correct
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#555",
                      fontFamily: "system-ui, sans-serif",
                      lineHeight: 1.5,
                    }}
                  >
                    Liverpool &bull; Verstappen &bull; Celtics &bull; Scheffler
                  </div>
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.35rem 0.6rem",
                      background: G.green,
                      color: G.gold,
                      display: "inline-block",
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      fontFamily: "system-ui, sans-serif",
                      borderRadius: 2,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    +24 pts
                  </div>
                </div>
              </div>

              {/* Worst Bet of the Week */}
              <div
                style={{
                  background: "#fef5f4",
                  border: `2px solid ${G.red}`,
                  borderRadius: 6,
                  overflow: "hidden",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    background: G.red,
                    padding: "0.5rem 0.75rem",
                    fontFamily: "Georgia, serif",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: G.white,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}
                >
                  Worst Bet of the Week
                </div>
                <div style={{ padding: "0.75rem" }}>
                  <div
                    style={{
                      fontFamily: "Georgia, serif",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      color: G.red,
                      marginBottom: 4,
                    }}
                  >
                    Robbo &mdash; McIlroy at The Masters
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#555",
                      fontFamily: "Georgia, serif",
                      fontStyle: "italic",
                      lineHeight: 1.5,
                    }}
                  >
                    &ldquo;He had the jacket measured. We all saw it.&rdquo;
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sport breakdown pie (CSS only) */}
          <div
            style={{
              marginTop: "1.25rem",
              background: G.slipBg,
              border: "1px solid #d4cba8",
              borderRadius: 6,
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "2rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: G.green,
                  marginBottom: "0.5rem",
                }}
              >
                Sport Mix
              </div>
              {/* CSS conic-gradient pie */}
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  background: `conic-gradient(
                    ${G.green} 0% 33%,
                    ${G.gold} 33% 54%,
                    #cc2200 54% 71%,
                    #0055aa 71% 83%,
                    #7700cc 83% 100%
                  )`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              {[
                { label: "Soccer", pct: 33, colour: G.green },
                { label: "Formula 1", pct: 21, colour: G.gold },
                { label: "GAA", pct: 17, colour: "#cc2200" },
                { label: "NBA", pct: 12, colour: "#0055aa" },
                { label: "Other", pct: 17, colour: "#7700cc" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.72rem",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      background: item.colour,
                      borderRadius: 2,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: G.black, fontWeight: 600 }}>{item.label}</span>
                  <span style={{ color: "#888" }}>{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 5. YOUR SLIP — Active Predictions ─────────────────────────── */}
        <div style={{ marginTop: "2.5rem" }}>
          <SectionHeader>Your Slip</SectionHeader>

          <div
            style={{
              background: G.slipBg,
              border: "1px solid #d4cba8",
              borderRadius: 6,
              maxWidth: 400,
              overflow: "hidden",
              fontFamily: "system-ui, sans-serif",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            }}
          >
            {/* Slip header */}
            <div
              style={{
                background: G.green,
                padding: "0.65rem 1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontWeight: 700,
                  color: G.white,
                  fontSize: "0.9rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Betting Slip
              </div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: G.gold,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Round {competition.round.number}
              </div>
            </div>

            {/* Perforated top edge */}
            <div
              style={{
                height: 10,
                background: `
                  radial-gradient(circle at 5px 0px, ${G.cream} 5px, transparent 5px) repeat-x,
                  ${G.slipBg}
                `,
                backgroundSize: "12px 10px, 100% 100%",
                backgroundPosition: "0 0, 0 0",
              }}
            />

            {/* Slip selections */}
            <div style={{ padding: "0.75rem 1rem" }}>
              {upcomingEvents.map((event, i) => (
                <div key={event.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      padding: "0.4rem 0",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: G.black,
                          lineHeight: 1.2,
                        }}
                      >
                        {event.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.62rem",
                          color: "#888",
                          marginTop: 1,
                        }}
                      >
                        {event.sport}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "Georgia, serif",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        color: G.green,
                        textAlign: "right",
                        flexShrink: 0,
                        marginLeft: "0.5rem",
                      }}
                    >
                      {(() => {
                        const k = Object.keys(event.odds)[0];
                        return k ? k.charAt(0).toUpperCase() + k.slice(1) : "—";
                      })()}
                    </div>
                  </div>
                  {i < upcomingEvents.length - 1 && (
                    <div style={{ borderTop: "1px dashed #d4cba8" }} />
                  )}
                </div>
              ))}
            </div>

            <PerforationLine />

            {/* ACCA Insurance notice */}
            <div
              style={{
                padding: "0.5rem 1rem",
                background: G.goldLight,
                fontSize: "0.65rem",
                fontFamily: "system-ui, sans-serif",
                color: G.black,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              ACCA INSURANCE: Get 4/5 correct and you still pocket partial points. We&apos;re not
              animals.
            </div>

            {/* Slip footer */}
            <div
              style={{
                background: G.green,
                padding: "0.5rem 1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "system-ui, sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                {upcomingEvents.length} selections
              </div>
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  color: G.gold,
                }}
              >
                UP TO 24 PTS
              </div>
            </div>
          </div>
        </div>

        {/* ── Announcements / Fun facts grid ────────────────────────────── */}
        <div style={{ marginTop: "2.5rem" }}>
          <SectionHeader>Notice Board</SectionHeader>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "1rem",
            }}
          >
            {[
              {
                label: "SURPRISE OF THE ROUND",
                text: stats.surpriseOfTheRound,
                bg: "#fff8e8",
                border: G.gold,
                colour: G.black,
              },
              {
                label: "HOT STREAK",
                text: `${stats.bestStreak.name} is on fire — ${stats.bestStreak.count} correct on the bounce. Don't make eye contact.`,
                bg: "#e8f5ee",
                border: G.green,
                colour: G.black,
              },
              {
                label: "PADDY SAYS...",
                text: "Robbo hasn't picked a winner since April 12th. The form guide doesn't lie. Neither does the mirror.",
                bg: G.gold,
                border: G.goldDark,
                colour: G.black,
              },
              {
                label: "DID YOU KNOW",
                text: "Nidge is the group's top GAA predictor. Too bad GAA is only 12% of the markets.",
                bg: G.slipBg,
                border: "#d4cba8",
                colour: G.black,
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: card.bg,
                  border: `2px solid ${card.border}`,
                  borderRadius: 6,
                  padding: "0.85rem 1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontFamily: "system-ui, sans-serif",
                    color: card.border === G.gold ? G.black : card.border,
                    marginBottom: 6,
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontFamily: "Georgia, serif",
                    fontStyle: "italic",
                    fontSize: "0.82rem",
                    lineHeight: 1.5,
                    color: card.colour,
                  }}
                >
                  {card.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer
          style={{
            marginTop: "3rem",
            borderTop: "2px solid #d4cba8",
            paddingTop: "1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "1.2rem",
              fontWeight: 700,
              color: G.green,
              marginBottom: 6,
            }}
          >
            THE BOOKIE
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "#999",
              fontFamily: "system-ui, sans-serif",
              lineHeight: 1.6,
              maxWidth: 500,
              margin: "0 auto",
            }}
          >
            No real money. No real bets. Just banter, bragging rights, and the eternal shame of
            picking McIlroy at Augusta.
            <br />
            18+. Please gamble responsibly. Just kidding — there&apos;s no gambling here. Only
            suffering.
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Link
              href="/designs"
              style={{
                color: G.green,
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.75rem",
                fontWeight: 700,
                textDecoration: "none",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              ← Back to All Designs
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
