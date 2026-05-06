import Link from "next/link";

const designs = [
  {
    id: 1,
    name: "Matchday",
    tagline: "Premier League energy",
    description:
      "Deep purple & electric cyan. Bold condensed type, match strips, form guides, MATCHDAY branding. Inspired by the Premier League broadcast aesthetic.",
    colors: ["#37003c", "#00ff87", "#ffffff", "#2d2d2d"],
  },
  {
    id: 2,
    name: "Paddock",
    tagline: "F1 & motorsport feel",
    description:
      "Carbon black & racing red. Wide-tracking uppercase, telemetry-style data viz, grid positions, sector timing aesthetic. Lights out energy.",
    colors: ["#15151e", "#e10600", "#ffffff", "#00d2be"],
  },
  {
    id: 3,
    name: "Bookie",
    tagline: "Paddy Power swagger",
    description:
      "Racing green & gold. Odds-style displays, coupon layout, cheeky fun facts, 'value pick' callouts. Personality-first betting shop energy.",
    colors: ["#004833", "#ffd700", "#ffffff", "#1a1a1a"],
  },
  {
    id: 4,
    name: "Broadcast",
    tagline: "Sky Sports / ESPN",
    description:
      "Dark navy & bold red. News ticker, BREAKING badges, pundit-style stat panels, comparison graphics. Saturday afternoon energy.",
    colors: ["#0c1428", "#cc0000", "#ffcc00", "#ffffff"],
  },
  {
    id: 5,
    name: "Arena",
    tagline: "DraftKings / fantasy pro",
    description:
      "Midnight black & neon green. Data-dense, glowing accents, achievement badges, XP bars, pro gaming aesthetic. Built for sweats.",
    colors: ["#0d1117", "#00e673", "#00d4ff", "#1c1c1c"],
  },
  {
    id: 6,
    name: "Terrace",
    tagline: "Fan culture & pub quiz",
    description:
      "Warm cream & amber. Slab serif headings, pub quiz energy, community focus, supporter chants, hand-crafted personality. The local.",
    colors: ["#fdf6e3", "#d97706", "#c2410c", "#1c4a1c"],
  },
  {
    id: 7,
    name: "Stadium",
    tagline: "Modern sports app",
    description:
      "Deep blue & electric accents. Glassmorphism cards, gradient backgrounds, donut charts, animated counters. Clean, premium, polished.",
    colors: ["#0f172a", "#3b82f6", "#8b5cf6", "#f0f9ff"],
  },
];

export default function DesignsIndex() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#ededed",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            marginBottom: "0.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          PredictSport Design Concepts
        </h1>
        <p style={{ color: "#888", marginBottom: "2.5rem", fontSize: "1.1rem" }}>
          7 distinct visual directions. Each shows the same data in a completely
          different aesthetic. Pick what feels right for the lads.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {designs.map((d) => (
            <Link
              key={d.id}
              href={`/designs/${d.id}`}
              style={{
                display: "block",
                background: "#161616",
                borderRadius: 12,
                padding: "1.5rem",
                border: "1px solid #2a2a2a",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color 0.2s, transform 0.2s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: "1rem",
                }}
              >
                {d.colors.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: c,
                      border: c === "#ffffff" ? "1px solid #333" : "none",
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#666",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 4,
                }}
              >
                Design {d.id}
              </div>
              <h2
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  marginBottom: 2,
                }}
              >
                {d.name}
              </h2>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#00e673",
                  marginBottom: "0.75rem",
                  fontWeight: 500,
                }}
              >
                {d.tagline}
              </p>
              <p style={{ fontSize: "0.85rem", color: "#888", lineHeight: 1.5 }}>
                {d.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
