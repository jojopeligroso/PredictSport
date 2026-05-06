// Design 6 — "The Terrace"
// Vibe: Pub quiz night, match day programme, fanzine culture
// Light cream theme — warm, personal, community

import { competition, leaderboard, events, stats, sportEmoji } from "../mock-data";

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  cream: "#fdf6e3",
  creamDark: "#f5e9c8",
  creamShadow: "#e8d5a3",
  amber: "#d97706",
  amberLight: "#fbbf24",
  amberPale: "#fef3c7",
  terracotta: "#c2410c",
  terracottaDark: "#9a3412",
  green: "#1c4a1c",
  greenMid: "#2d6a2d",
  greenLight: "#4a7c4a",
  darkBrown: "#2c1810",
  warmGray: "#4a4540",
  warmGrayLight: "#7a7570",
  ink: "#1a1208",
  redPen: "#b91c1c",
  checkGreen: "#15803d",
  paperLine: "#d4c4a0",
};

// ─── Typography ───────────────────────────────────────────────────────────────
const T = {
  slab: "Rockwell, 'Courier New', Georgia, serif",
  body: "Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, sans-serif",
};

// ─── Helper: tally marks from a count ─────────────────────────────────────────
function tallyMarks(count: number): string {
  const groups = Math.floor(count / 5);
  const remainder = count % 5;
  let marks = "";
  for (let i = 0; i < groups; i++) marks += "𝍷 "; // five-bar tally
  for (let i = 0; i < remainder; i++) marks += "| ";
  return marks.trim() || "–";
}

// ─── Helper: time until lock ───────────────────────────────────────────────────
function timeUntilLock(lockTime: string): string {
  const diff = new Date(lockTime).getTime() - Date.now();
  if (diff <= 0) return "Pencils down!";
  const hrs = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hrs > 24) return `${Math.floor(hrs / 24)} days to go`;
  if (hrs > 0) return `Pencils down in ${hrs}h ${mins}m`;
  return `Pencils down in ${mins} minutes!`;
}

// ─── Helper: form dot ────────────────────────────────────────────────────────
function formColor(f: "W" | "L" | "P"): string {
  if (f === "W") return C.checkGreen;
  if (f === "L") return C.redPen;
  return C.amber;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "2.5rem 0 1.5rem" }}>
      <div style={{ flex: 1, borderTop: `2px dashed ${C.creamShadow}` }} />
      <span
        style={{
          fontFamily: T.slab,
          fontSize: "0.7rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: C.warmGrayLight,
          padding: "0 0.5rem",
          background: C.cream,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, borderTop: `2px dashed ${C.creamShadow}` }} />
    </div>
  );
}

function TornPaperDivider() {
  // SVG zigzag torn paper edge
  return (
    <div style={{ margin: "1.5rem -1.5rem", overflow: "hidden", lineHeight: 0 }}>
      <svg viewBox="0 0 400 16" preserveAspectRatio="none" style={{ width: "100%", height: "16px", display: "block" }}>
        <polyline
          points="0,0 20,14 40,2 60,14 80,2 100,14 120,2 140,14 160,2 180,14 200,2 220,14 240,2 260,14 280,2 300,14 320,2 340,14 360,2 380,14 400,2 400,0"
          fill={C.creamDark}
          stroke={C.creamShadow}
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}

function GafferSays({ text }: { text: string }) {
  return (
    <div style={{ position: "relative", margin: "1rem 0 0.5rem" }}>
      {/* speech bubble body */}
      <div
        style={{
          background: C.amberPale,
          border: `2px solid ${C.amber}`,
          borderRadius: "8px",
          padding: "0.6rem 0.9rem",
          fontFamily: T.body,
          fontSize: "0.82rem",
          color: C.darkBrown,
          fontStyle: "italic",
          lineHeight: 1.4,
        }}
      >
        <span
          style={{
            fontFamily: T.slab,
            fontStyle: "normal",
            fontWeight: "bold",
            color: C.terracotta,
            fontSize: "0.7rem",
            letterSpacing: "0.1em",
            display: "block",
            marginBottom: "0.25rem",
          }}
        >
          THE GAFFER SAYS...
        </span>
        {text}
      </div>
      {/* arrow pointer */}
      <div
        style={{
          position: "absolute",
          bottom: "-10px",
          left: "24px",
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: `10px solid ${C.amber}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-7px",
          left: "26px",
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: `8px solid ${C.amberPale}`,
        }}
      />
    </div>
  );
}

function GroupPredBar({
  label,
  count,
  total,
  tally,
}: {
  label: string;
  count: number;
  total: number;
  tally: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
      <span style={{ fontFamily: T.slab, fontSize: "0.75rem", color: C.warmGray, minWidth: "80px" }}>{label}</span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "0.8rem",
          color: C.darkBrown,
          letterSpacing: "0.05em",
          minWidth: "80px",
        }}
      >
        {tally}
      </span>
      <div
        style={{
          height: "10px",
          width: `${Math.max(pct, 4)}%`,
          maxWidth: "100px",
          background: C.amber,
          borderRadius: "2px",
          opacity: 0.7,
        }}
      />
      <span style={{ fontFamily: T.sans, fontSize: "0.7rem", color: C.warmGrayLight }}>{count}</span>
    </div>
  );
}

function Stamp({ label, color = C.terracotta }: { label: string; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        border: `2px solid ${color}`,
        borderRadius: "4px",
        padding: "2px 6px",
        fontFamily: T.slab,
        fontSize: "0.6rem",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color,
        transform: "rotate(-2deg)",
        opacity: 0.85,
        marginLeft: "0.4rem",
        verticalAlign: "middle",
      }}
    >
      {label}
    </span>
  );
}

function CircledPoints({ points }: { points: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        border: `2px solid ${C.redPen}`,
        fontFamily: T.slab,
        fontSize: "0.85rem",
        fontWeight: "bold",
        color: C.redPen,
        flexShrink: 0,
      }}
    >
      {points}
    </span>
  );
}

function PintGlass({ fillLevel, size = 32 }: { fillLevel: number; size?: number }) {
  // fillLevel: 0–100
  const fill = Math.max(0, Math.min(100, fillLevel));
  const glassHeight = size * 0.85;
  const foamHeight = size * 0.12;
  const beerHeight = ((glassHeight - foamHeight) * fill) / 100;
  const beerY = size - beerHeight - 2;

  return (
    <svg width={size * 0.6} height={size} viewBox={`0 0 24 ${size}`} style={{ display: "inline-block", verticalAlign: "middle" }}>
      {/* glass outline */}
      <path
        d={`M4,4 L6,${size - 2} L18,${size - 2} L20,4 Z`}
        fill="none"
        stroke={C.warmGray}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* beer fill */}
      {fill > 0 && (
        <clipPath id={`pint-clip-${fill}`}>
          <path d={`M4,4 L6,${size - 2} L18,${size - 2} L20,4 Z`} />
        </clipPath>
      )}
      {fill > 0 && (
        <rect
          x="4"
          y={beerY}
          width="16"
          height={beerHeight}
          fill={C.amber}
          opacity="0.75"
          clipPath={`url(#pint-clip-${fill})`}
        />
      )}
      {/* foam */}
      {fill > 0 && (
        <rect
          x="4"
          y={beerY - foamHeight}
          width="16"
          height={foamHeight}
          fill="#fffbeb"
          opacity="0.9"
          clipPath={`url(#pint-clip-${fill})`}
        />
      )}
    </svg>
  );
}

// ─── EVENT CARD ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: (typeof events)[number] }) {
  const emoji = sportEmoji[event.sport] ?? "🏆";
  const isResulted = event.status === "resulted";
  const resulted = event as typeof event & {
    result?: string;
    userPrediction?: { pick: string; isCorrect: boolean; pointsAwarded: number; margin?: string };
  };

  const totalPredictions = Object.values(event.groupPredictions).reduce(
    (a: number, b: unknown) => a + (typeof b === "number" ? b : 0),
    0
  );

  const predEntries = Object.entries(event.groupPredictions) as [string, number][];

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${C.cream} 0%, ${C.creamDark} 100%)`,
        border: `1px solid ${C.creamShadow}`,
        borderRadius: "4px",
        padding: "1.25rem 1.5rem",
        marginBottom: "0",
        position: "relative",
        boxShadow: "2px 3px 8px rgba(44,24,16,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
      }}
    >
      {/* header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "1.4rem" }}>{emoji}</span>
            <span
              style={{
                fontFamily: T.slab,
                fontSize: "1.05rem",
                fontWeight: "bold",
                color: C.darkBrown,
                lineHeight: 1.2,
              }}
            >
              {event.name}
            </span>
            {isResulted && resulted.userPrediction?.isCorrect && (
              <Stamp label="Well played!" color={C.checkGreen} />
            )}
            {isResulted && resulted.userPrediction && !resulted.userPrediction.isCorrect && (
              <Stamp label="Ah sure look..." color={C.redPen} />
            )}
          </div>
          <div
            style={{
              fontFamily: T.body,
              fontSize: "0.75rem",
              fontStyle: "italic",
              color: C.warmGrayLight,
              marginTop: "0.2rem",
            }}
          >
            {event.league}
          </div>
        </div>

        {/* result or countdown */}
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "1rem" }}>
          {isResulted ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", flexDirection: "column" }}>
              <span
                style={{
                  fontFamily: T.slab,
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  color: C.terracotta,
                }}
              >
                {resulted.result}
              </span>
              {resulted.userPrediction && (
                <CircledPoints points={resulted.userPrediction.pointsAwarded} />
              )}
            </div>
          ) : (
            <span
              style={{
                fontFamily: T.body,
                fontSize: "0.78rem",
                fontStyle: "italic",
                color: C.warmGray,
                borderBottom: `2px wavy ${C.amber}`,
                paddingBottom: "1px",
              }}
            >
              {timeUntilLock("lockTime" in event ? (event as { lockTime: string }).lockTime : "")}
            </span>
          )}
        </div>
      </div>

      {/* red/green stamp for resulted */}
      {isResulted && resulted.userPrediction && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: `3px solid ${resulted.userPrediction.isCorrect ? C.checkGreen : C.redPen}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: T.slab,
            fontSize: "1.6rem",
            color: resulted.userPrediction.isCorrect ? C.checkGreen : C.redPen,
            opacity: 0.15,
            pointerEvents: "none",
            transform: "rotate(12deg)",
          }}
        >
          {resulted.userPrediction.isCorrect ? "✓" : "✗"}
        </div>
      )}

      {/* Gaffer says */}
      {event.funFacts && event.funFacts.length > 0 && (
        <GafferSays text={event.funFacts[0]} />
      )}

      <div style={{ marginTop: "1.2rem" }} />

      {/* group predictions tally */}
      <div
        style={{
          fontFamily: T.slab,
          fontSize: "0.65rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.warmGrayLight,
          marginBottom: "0.5rem",
        }}
      >
        What the lads picked:
      </div>
      {predEntries.map(([key, count]) => (
        <GroupPredBar
          key={key}
          label={key.charAt(0).toUpperCase() + key.slice(1)}
          count={count}
          total={totalPredictions}
          tally={tallyMarks(count)}
        />
      ))}

      {/* prediction input area for upcoming */}
      {!isResulted && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "rgba(255,255,255,0.5)",
            border: `1px dashed ${C.creamShadow}`,
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontFamily: T.body, fontStyle: "italic", fontSize: "0.8rem", color: C.warmGrayLight }}>
            Your pick:
          </span>
          {predEntries.map(([key]) => (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                cursor: "pointer",
                fontFamily: T.body,
                fontSize: "0.82rem",
                color: C.darkBrown,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  border: `2px solid ${C.warmGray}`,
                  flexShrink: 0,
                }}
              />
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

function LeaderboardSection() {
  const pintLevels = [100, 75, 50];

  return (
    <section
      style={{
        background: C.green,
        borderRadius: "6px",
        padding: "2rem 2rem 1.5rem",
        border: `3px dashed ${C.greenLight}`,
        boxShadow: "inset 0 2px 12px rgba(0,0,0,0.3), 4px 6px 16px rgba(28,74,28,0.2)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* chalk texture overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(255,255,255,0.015) 31px, rgba(255,255,255,0.015) 32px)",
          pointerEvents: "none",
        }}
      />

      <h2
        style={{
          fontFamily: T.slab,
          fontSize: "1.4rem",
          color: "#f5f0e0",
          textAlign: "center",
          marginBottom: "0.25rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textShadow: "1px 1px 4px rgba(0,0,0,0.4)",
        }}
      >
        The Table Down The Pub
      </h2>
      <p
        style={{
          fontFamily: T.body,
          fontStyle: "italic",
          fontSize: "0.8rem",
          color: C.amberLight,
          textAlign: "center",
          marginBottom: "1.5rem",
        }}
      >
        Round {competition.round.number} standings — {competition.memberCount} in the league
      </p>

      {/* gap callout */}
      <div
        style={{
          background: "rgba(217,119,6,0.15)",
          border: `1px solid ${C.amber}`,
          borderRadius: "4px",
          padding: "0.5rem 1rem",
          marginBottom: "1.5rem",
          textAlign: "center",
          fontFamily: T.body,
          fontStyle: "italic",
          fontSize: "0.82rem",
          color: C.amberLight,
        }}
      >
        <strong style={{ fontFamily: T.slab, fontStyle: "normal" }}>THE GAP —</strong>{" "}
        {stats.closestRace}. It&apos;s going to the wire.
      </div>

      {leaderboard.map((entry, i) => {
        const isTop3 = i < 3;
        const movementText =
          entry.movement > 0
            ? `up ${entry.movement}`
            : entry.movement < 0
            ? `down ${Math.abs(entry.movement)}`
            : "steady";

        return (
          <div
            key={entry.rank}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.75rem 0",
              borderBottom: `1px solid rgba(255,255,255,0.08)`,
              position: "relative",
            }}
          >
            {/* rank + pint */}
            <div
              style={{
                minWidth: "52px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
              }}
            >
              {isTop3 ? (
                <PintGlass fillLevel={pintLevels[i]} size={36} />
              ) : (
                <span
                  style={{
                    fontFamily: T.slab,
                    fontSize: "1.3rem",
                    color: "rgba(255,255,255,0.4)",
                    lineHeight: 1,
                  }}
                >
                  {entry.rank}
                </span>
              )}
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.6rem",
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                {movementText}
              </span>
            </div>

            {/* avatar + name */}
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: isTop3 ? C.amber : "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: T.slab,
                fontWeight: "bold",
                fontSize: "0.95rem",
                color: isTop3 ? C.darkBrown : "#d5cfc0",
                flexShrink: 0,
              }}
            >
              {entry.avatar}
            </div>

            {/* details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontFamily: T.slab,
                    fontSize: "1rem",
                    color: "#f5f0e0",
                    fontWeight: isTop3 ? "bold" : "normal",
                  }}
                >
                  {entry.name}
                </span>
                {/* form dots */}
                <span style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                  {entry.form.map((f, fi) => (
                    <span
                      key={fi}
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: formColor(f),
                        opacity: 0.9,
                      }}
                    />
                  ))}
                </span>
              </div>
              {/* fun fact whisper */}
              <div
                style={{
                  fontFamily: T.body,
                  fontStyle: "italic",
                  fontSize: "0.72rem",
                  color: "rgba(200,190,170,0.7)",
                  marginTop: "0.15rem",
                }}
              >
                (psst... {entry.funFact.toLowerCase()})
              </div>
            </div>

            {/* points */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "2px",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: T.slab,
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: isTop3 ? C.amberLight : "#d5cfc0",
                  lineHeight: 1,
                }}
              >
                {entry.points}
              </span>
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.6rem",
                  color: "rgba(200,190,170,0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                pts
              </span>
            </div>
          </div>
        );
      })}

      {/* accuracy pints legend */}
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          justifyContent: "center",
          marginTop: "1.25rem",
          paddingTop: "1rem",
          borderTop: `1px dashed rgba(255,255,255,0.15)`,
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "1st place", fill: 100 },
          { label: "2nd place", fill: 75 },
          { label: "3rd place", fill: 50 },
        ].map(({ label, fill }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <PintGlass fillLevel={fill} size={24} />
            <span style={{ fontFamily: T.body, fontStyle: "italic", fontSize: "0.7rem", color: "rgba(200,190,170,0.6)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── BACK PAGE / STATS ────────────────────────────────────────────────────────

function AccuracyBar({ name, pct }: { name: string; pct: number }) {
  return (
    <div style={{ marginBottom: "0.6rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "3px",
          fontFamily: T.body,
          fontSize: "0.8rem",
          color: C.darkBrown,
        }}
      >
        <span>{name}</span>
        <span style={{ fontWeight: "bold" }}>{pct}%</span>
      </div>
      <div
        style={{
          height: "10px",
          background: C.creamShadow,
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: pct >= 55 ? C.checkGreen : pct >= 45 ? C.amber : C.terracotta,
            borderRadius: "3px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function PullQuote({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "relative",
        padding: "0.75rem 1.25rem 0.75rem 2.5rem",
        margin: "1rem 0",
        borderLeft: `4px solid ${C.terracotta}`,
        background: C.creamDark,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "-8px",
          left: "8px",
          fontFamily: T.slab,
          fontSize: "3rem",
          color: C.terracotta,
          opacity: 0.3,
          lineHeight: 1,
        }}
      >
        &ldquo;
      </span>
      <span style={{ fontFamily: T.body, fontStyle: "italic", fontSize: "0.88rem", color: C.warmGray }}>
        {text}
      </span>
    </div>
  );
}

function BackPageStats() {
  return (
    <section>
      <div
        style={{
          background: C.darkBrown,
          padding: "0.6rem 1.5rem",
          marginBottom: "1.5rem",
          borderRadius: "4px",
        }}
      >
        <h2
          style={{
            fontFamily: T.slab,
            fontSize: "1.3rem",
            color: C.cream,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          The Back Page
        </h2>
        <p
          style={{
            fontFamily: T.body,
            fontStyle: "italic",
            fontSize: "0.75rem",
            color: C.creamShadow,
            textAlign: "center",
          }}
        >
          Stats, glory, and mild embarrassment — {competition.round.name}
        </p>
      </div>

      {/* two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

        {/* left column */}
        <div>
          {/* Prediction of the round */}
          <div
            style={{
              border: `2px solid ${C.checkGreen}`,
              borderRadius: "4px",
              padding: "1rem",
              marginBottom: "1.25rem",
              background: "rgba(21,128,61,0.04)",
            }}
          >
            <div
              style={{
                fontFamily: T.slab,
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.checkGreen,
                marginBottom: "0.5rem",
              }}
            >
              Prediction of the Round
            </div>
            <div style={{ fontFamily: T.slab, fontSize: "1rem", color: C.darkBrown, marginBottom: "0.25rem" }}>
              Davo — Celtics to win by 10+
            </div>
            <div style={{ fontFamily: T.body, fontStyle: "italic", fontSize: "0.8rem", color: C.warmGray }}>
              Called it when everyone thought the Knicks had it. Brave pick, full marks.
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <Stamp label="Brave Pick" color={C.checkGreen} />
              <Stamp label="Quiz Master" color={C.amber} />
            </div>
          </div>

          {/* Howler of the round */}
          <div
            style={{
              border: `2px solid ${C.redPen}`,
              borderRadius: "4px",
              padding: "1rem",
              marginBottom: "1.25rem",
              background: "rgba(185,28,28,0.04)",
            }}
          >
            <div
              style={{
                fontFamily: T.slab,
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.redPen,
                marginBottom: "0.5rem",
              }}
            >
              Howler of the Round
            </div>
            <div style={{ fontFamily: T.slab, fontSize: "1rem", color: C.darkBrown, marginBottom: "0.25rem" }}>
              Robbo — McIlroy for The Masters
            </div>
            <div style={{ fontFamily: T.body, fontStyle: "italic", fontSize: "0.8rem", color: C.warmGray }}>
              Went with the heart over the head. Scheffler was never losing that one, Robbo.
            </div>
            <PullQuote text="I had a feeling about him this year. The feeling was wrong." />
          </div>

          {/* Supporter of the Month */}
          <div
            style={{
              background: `linear-gradient(135deg, ${C.amberPale}, ${C.creamDark})`,
              border: `2px solid ${C.amber}`,
              borderRadius: "4px",
              padding: "1rem",
            }}
          >
            <div
              style={{
                fontFamily: T.slab,
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.amber,
                marginBottom: "0.5rem",
              }}
            >
              Supporter of the Month
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: C.amber,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: T.slab,
                  fontWeight: "bold",
                  fontSize: "1.25rem",
                  color: C.darkBrown,
                  flexShrink: 0,
                }}
              >
                D
              </div>
              <div>
                <div style={{ fontFamily: T.slab, fontSize: "1.1rem", color: C.darkBrown, fontWeight: "bold" }}>
                  Davo
                </div>
                <div style={{ fontFamily: T.body, fontStyle: "italic", fontSize: "0.75rem", color: C.warmGray }}>
                  5-game winning streak · 58% accuracy · Top of the table
                </div>
                <Stamp label="The Gaffer's Pet" color={C.amber} />
              </div>
            </div>
          </div>
        </div>

        {/* right column */}
        <div>
          {/* Form guide */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                fontFamily: T.slab,
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.warmGrayLight,
                marginBottom: "0.75rem",
                borderBottom: `1px solid ${C.creamShadow}`,
                paddingBottom: "0.4rem",
              }}
            >
              Form Guide — Last 5
            </div>
            {leaderboard.map((entry) => (
              <div
                key={entry.rank}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.4rem",
                }}
              >
                <span
                  style={{
                    fontFamily: T.body,
                    fontSize: "0.82rem",
                    color: C.darkBrown,
                    minWidth: "52px",
                  }}
                >
                  {entry.name}
                </span>
                <span style={{ display: "flex", gap: "3px" }}>
                  {entry.form.map((f, fi) => (
                    <span
                      key={fi}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "18px",
                        height: "18px",
                        borderRadius: "3px",
                        background: formColor(f),
                        fontFamily: T.sans,
                        fontWeight: "bold",
                        fontSize: "0.6rem",
                        color: "#fff",
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>

          {/* Stats corner — accuracy bars */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                fontFamily: T.slab,
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.warmGrayLight,
                marginBottom: "0.75rem",
                borderBottom: `1px solid ${C.creamShadow}`,
                paddingBottom: "0.4rem",
              }}
            >
              The Stats Corner — Accuracy
            </div>
            {leaderboard.map((entry) => (
              <AccuracyBar key={entry.rank} name={entry.name} pct={entry.accuracy} />
            ))}
          </div>

          {/* Group stats */}
          <div
            style={{
              background: C.creamDark,
              border: `1px solid ${C.creamShadow}`,
              borderRadius: "4px",
              padding: "0.75rem",
            }}
          >
            <div
              style={{
                fontFamily: T.slab,
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.warmGrayLight,
                marginBottom: "0.6rem",
              }}
            >
              Numbers Don&apos;t Lie
            </div>
            {[
              { label: "Total predictions", val: stats.totalPredictions },
              { label: "Events resulted", val: `${stats.eventsResulted} of ${stats.totalEvents}` },
              { label: "Group accuracy", val: `${stats.avgAccuracy}%` },
              { label: "Best streak", val: `${stats.bestStreak.name} — ${stats.bestStreak.count} in a row` },
            ].map(({ label, val }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.3rem 0",
                  borderBottom: `1px dotted ${C.creamShadow}`,
                  fontFamily: T.body,
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ color: C.warmGray }}>{label}</span>
                <span style={{ fontWeight: "bold", color: C.darkBrown }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function Design6Page() {
  const upcoming = events.filter((e) => e.status === "upcoming");
  const resulted = events.filter((e) => e.status === "resulted");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${C.cream} 0%, ${C.creamDark} 60%, ${C.cream} 100%)`,
        fontFamily: T.body,
        color: C.darkBrown,
      }}
    >
      {/* ── HEADER / MASTHEAD ─────────────────────────────────────── */}
      <header
        style={{
          background: `linear-gradient(180deg, ${C.darkBrown} 0%, #3d2015 100%)`,
          padding: "0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* decorative top stripe */}
        <div
          style={{
            height: "6px",
            background: `repeating-linear-gradient(90deg, ${C.terracotta} 0px, ${C.terracotta} 20px, ${C.amber} 20px, ${C.amber} 40px)`,
          }}
        />

        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1.5rem 1.75rem" }}>
          {/* back link */}
          <a
            href="/designs"
            style={{
              fontFamily: T.sans,
              fontSize: "0.72rem",
              color: "rgba(253,246,227,0.5)",
              textDecoration: "none",
              letterSpacing: "0.08em",
              display: "inline-block",
              marginBottom: "1.25rem",
              borderBottom: "1px solid rgba(253,246,227,0.2)",
              paddingBottom: "1px",
            }}
          >
            ← Back to designs
          </a>

          {/* masthead */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: T.slab,
                fontSize: "0.7rem",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: C.amber,
                marginBottom: "0.5rem",
              }}
            >
              Est. 2026 · Wexford · Vol. 1
            </div>

            <h1
              style={{
                fontFamily: T.slab,
                fontSize: "clamp(2.8rem, 8vw, 4.5rem)",
                fontWeight: "bold",
                color: C.cream,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                lineHeight: 0.95,
                textShadow: `3px 3px 0 ${C.terracotta}, 5px 5px 0 rgba(0,0,0,0.2)`,
                margin: "0 0 0.5rem",
              }}
            >
              The Terrace
            </h1>

            <div
              style={{
                fontFamily: T.body,
                fontStyle: "italic",
                fontSize: "1.05rem",
                color: C.creamShadow,
                marginBottom: "0.9rem",
              }}
            >
              {competition.name}
            </div>

            {/* round badge */}
            <div
              style={{
                display: "inline-block",
                padding: "0.4rem 1.2rem",
                background: "transparent",
                borderBottom: `3px solid ${C.amber}`,
                fontFamily: T.slab,
                fontSize: "1rem",
                color: C.amberLight,
                letterSpacing: "0.04em",
                marginBottom: "1rem",
                position: "relative",
              }}
            >
              {competition.round.name}
              {/* wavy underline via border */}
            </div>

            <div
              style={{
                fontFamily: T.body,
                fontStyle: "italic",
                fontSize: "0.82rem",
                color: "rgba(253,246,227,0.55)",
              }}
            >
              {competition.memberCount} of the lads are playing · Round {competition.round.number} of{" "}
              {competition.totalRounds}
            </div>
          </div>
        </div>

        {/* bottom decorative stripe */}
        <div
          style={{
            height: "6px",
            background: `repeating-linear-gradient(90deg, ${C.amber} 0px, ${C.amber} 20px, ${C.terracotta} 20px, ${C.terracotta} 40px)`,
          }}
        />
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
      <main style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

        {/* ── QUIZ SHEET — UPCOMING ───────────────────────────────── */}
        <SectionDivider label="This Week's Quiz Sheet" />

        <div
          style={{
            background: `linear-gradient(135deg, ${C.cream} 0%, #fef9ee 100%)`,
            border: `1px solid ${C.creamShadow}`,
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(44,24,16,0.08)",
          }}
        >
          {/* programme header */}
          <div
            style={{
              background: C.terracotta,
              padding: "0.75rem 1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: T.slab,
                fontSize: "0.75rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.cream,
              }}
            >
              Upcoming Events
            </span>
            <span
              style={{
                fontFamily: T.body,
                fontStyle: "italic",
                fontSize: "0.72rem",
                color: "rgba(253,246,227,0.8)",
              }}
            >
              Get your picks in before pencils down!
            </span>
          </div>

          {/* event cards with torn paper dividers */}
          <div>
            {upcoming.map((event, i) => (
              <div key={event.id}>
                <div style={{ padding: "0 0" }}>
                  <div style={{ padding: "0 1.5rem" }}>
                    <EventCard event={event} />
                  </div>
                </div>
                {i < upcoming.length - 1 && <TornPaperDivider />}
              </div>
            ))}
          </div>
        </div>

        {/* ── RESULTED EVENTS ─────────────────────────────────────── */}
        <SectionDivider label="Results In" />

        <div
          style={{
            background: `linear-gradient(135deg, ${C.cream} 0%, #fef9ee 100%)`,
            border: `1px solid ${C.creamShadow}`,
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(44,24,16,0.08)",
          }}
        >
          <div
            style={{
              background: C.warmGray,
              padding: "0.75rem 1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: T.slab,
                fontSize: "0.75rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.cream,
              }}
            >
              Results — Marked Up
            </span>
            <span
              style={{
                fontFamily: T.body,
                fontStyle: "italic",
                fontSize: "0.72rem",
                color: "rgba(253,246,227,0.7)",
              }}
            >
              The teacher has been through these...
            </span>
          </div>

          {resulted.map((event, i) => (
            <div key={event.id}>
              <div style={{ padding: "0 1.5rem" }}>
                <EventCard event={event} />
              </div>
              {i < resulted.length - 1 && <TornPaperDivider />}
            </div>
          ))}
        </div>

        {/* ── SURPRISE CALLOUT ────────────────────────────────────── */}
        <div
          style={{
            margin: "1.5rem 0",
            padding: "1rem 1.25rem",
            background: C.amberPale,
            border: `2px solid ${C.amber}`,
            borderRadius: "4px",
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>📣</span>
          <div>
            <div
              style={{
                fontFamily: T.slab,
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.amber,
                marginBottom: "0.25rem",
              }}
            >
              Surprise of the Round
            </div>
            <div style={{ fontFamily: T.body, fontSize: "0.85rem", color: C.darkBrown }}>
              {stats.surpriseOfTheRound}
            </div>
          </div>
        </div>

        {/* ── LEADERBOARD ─────────────────────────────────────────── */}
        <SectionDivider label="The Standings" />
        <LeaderboardSection />

        {/* ── BACK PAGE ───────────────────────────────────────────── */}
        <SectionDivider label="The Back Page" />
        <BackPageStats />

        {/* ── FOOTER ──────────────────────────────────────────────── */}
        <footer
          style={{
            marginTop: "3rem",
            borderTop: `2px dashed ${C.creamShadow}`,
            paddingTop: "1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              border: `2px solid ${C.creamShadow}`,
              borderRadius: "4px",
              padding: "0.75rem 2rem",
              background: C.creamDark,
            }}
          >
            <div
              style={{
                fontFamily: T.slab,
                fontSize: "0.65rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: C.warmGrayLight,
                marginBottom: "0.3rem",
              }}
            >
              A production of the
            </div>
            <div
              style={{
                fontFamily: T.slab,
                fontSize: "0.9rem",
                color: C.terracotta,
                letterSpacing: "0.08em",
              }}
            >
              Wexford FC Supporters Quiz Committee
            </div>
            <div
              style={{
                fontFamily: T.body,
                fontStyle: "italic",
                fontSize: "0.72rem",
                color: C.warmGrayLight,
                marginTop: "0.3rem",
              }}
            >
              All predictions final. No refunds. The craic is always free.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "2rem",
              marginTop: "1.25rem",
              flexWrap: "wrap",
            }}
          >
            {["Design 1", "Design 2", "Design 3", "Design 4", "Design 5"].map((d, i) => (
              <a
                key={d}
                href={`/designs/${i + 1}`}
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.72rem",
                  color: C.warmGrayLight,
                  textDecoration: "none",
                  borderBottom: `1px solid ${C.creamShadow}`,
                  paddingBottom: "1px",
                }}
              >
                {d}
              </a>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
