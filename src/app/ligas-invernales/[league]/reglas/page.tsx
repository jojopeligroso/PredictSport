import Link from "next/link";
import { notFound } from "next/navigation";
import { Bi } from "@/components/ligas/Bi";
import { ligaVars, LEAGUE_THEMES } from "@/components/ligas/theme";
import {
  BUCKET_LABELS,
  WINNER_POINTS,
  MAX_GAME_POINTS,
} from "@/lib/ligas/system-b";

export const dynamic = "force-dynamic";

/**
 * /ligas-invernales/[league]/reglas — System B scoring explainer.
 *
 * Entrant-facing copy adapted from the PREDICT scoring design (Appendix A,
 * "How Scoring Works"), translated for the primary LatAm-Spanish audience.
 * Numeric values are pulled from @/lib/ligas/system-b so copy and engine can
 * never drift apart.
 */

/** Width → bonus, mirrored from the scoring engine for the explainer table. */
const BONUS_ROWS: { width: string; bonus: number }[] = [
  { width: "1", bonus: 6 },
  { width: "2", bonus: 4 },
  { width: "3", bonus: 3 },
  { width: "4", bonus: 2 },
];

export default async function ReglasPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  if (!(league in LEAGUE_THEMES)) notFound();

  return (
    <main className="pt-8" style={ligaVars(league)}>
      <header>
        <Link
          href={`/ligas-invernales/${league}`}
          className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-liga-deep dark:text-liga"
        >
          ← <Bi es="Volver" en="Back" />
        </Link>
        <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ps-text">
          <Bi es="Cómo se puntúa" en="How scoring works" />
        </h1>
        <p className="mt-1 text-sm text-ps-text-sec">
          <Bi
            es="Cada juego, haces hasta tres llamadas. Cada una sube la apuesta."
            en="Every game, you make up to three calls. Each one raises the stakes."
          />
        </p>
      </header>

      {/* 1 — Winner */}
      <section className="mt-6 rounded-2xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-base font-extrabold text-ps-text">
            <Bi es="1 · Llama al ganador" en="1 · Call the winner" />
          </h2>
          <span className="font-mono text-sm font-bold text-liga-deep dark:text-liga">
            +{WINNER_POINTS}
          </span>
        </div>
        <p className="mt-2 text-sm text-ps-text-sec">
          <Bi
            es={`Elige el equipo que gana. Si aciertas, ganas ${WINNER_POINTS}. Si fallas, el juego vale cero sin importar lo demás. Todo se construye sobre el ganador.`}
            en={`Pick the team that wins. Nail it, bank ${WINNER_POINTS}. Miss it, and the game scores zero no matter what else you called. Everything is built on the winner.`}
          />
        </p>
      </section>

      {/* 2 — Margin window (the sitting bar) */}
      <section className="mt-4 rounded-2xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-base font-extrabold text-ps-text">
            <Bi es="2 · Llama el margen" en="2 · Call the margin" />
          </h2>
          <span className="font-mono text-sm font-bold text-liga-deep dark:text-liga">
            +6 · +4 · +3 · +2
          </span>
        </div>
        <p className="mt-2 text-sm text-ps-text-sec">
          <Bi
            es="Apuesta por cuántas carreras gana tu equipo, medido al final de la 9ª entrada:"
            en="Back how many runs your team wins by, measured at the end of the 9th:"
          />
        </p>

        {/* Static illustration of the bar */}
        <div className="mt-3 flex gap-1">
          {BUCKET_LABELS.map((label, i) => (
            <div
              key={label}
              className={[
                "flex h-10 flex-1 items-center justify-center rounded-lg font-mono text-sm font-bold",
                i >= 1 && i <= 2
                  ? "bg-liga text-white"
                  : "bg-ps-bg-alt text-ps-text-sec",
              ].join(" ")}
            >
              {label}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ps-text-ter">
          <Bi
            es="0 = empate a los 9, va a extra innings — tu ganador aún cuenta. 5+ cubre cualquier victoria de cinco o más."
            en="0 means it's tied after 9 and heading to extras — your winner still counts. 5+ covers any win of five or more."
          />
        </p>

        <p className="mt-3 text-sm text-ps-text-sec">
          <Bi
            es="No tienes que elegir un solo número — elige el rango que te da confianza. Mientras más ajustado, más paga:"
            en="You don't have to pick a single number — choose the range you trust. The tighter you go, the more it pays:"
          />
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-ps-border">
          {BONUS_ROWS.map((row, idx) => (
            <div
              key={row.width}
              className={[
                "flex items-center justify-between px-3 py-2 text-sm",
                idx % 2 === 0 ? "bg-ps-bg-alt/40" : "bg-transparent",
              ].join(" ")}
            >
              <span className="text-ps-text-sec">
                <Bi
                  es={`${row.width} ${row.width === "1" ? "número" : "números"}`}
                  en={`${row.width} ${row.width === "1" ? "number" : "numbers"}`}
                />
              </span>
              <span className="font-mono font-bold text-liga-deep dark:text-liga">
                +{row.bonus}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ps-text-ter">
          <Bi
            es="Mientras la carrera real caiga en cualquier parte de tu rango, el bono es tuyo. Lectura perfecta — ganador correcto, margen más ajustado — es un 10."
            en="As long as the real margin lands anywhere inside your range, the bonus is yours. A perfect read — right winner, tightest margin — is a 10."
          />
        </p>
      </section>

      {/* 3 — Exact score */}
      <section className="mt-4 rounded-2xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-base font-extrabold text-ps-text">
            <Bi es="3 · Llama el marcador exacto" en="3 · Call the exact score" />
          </h2>
          <span className="font-mono text-sm font-bold text-liga-deep dark:text-liga">
            ×2
          </span>
        </div>
        <p className="mt-2 text-sm text-ps-text-sec">
          <Bi
            es="¿Con confianza? Predice el marcador final exacto. Si lo clavas, todo el total del juego se duplica."
            en="Feeling it? Predict the exact final score. Get it spot on and your entire game total doubles."
          />
        </p>
      </section>

      {/* Worked example */}
      <section className="mt-4 rounded-2xl border border-liga/40 bg-liga/5 p-4">
        <h2 className="font-mono text-micro font-bold uppercase tracking-[0.18em] text-liga-deep dark:text-liga">
          <Bi es="Ejemplo" en="Worked example" />
        </h2>
        <p className="mt-2 text-sm text-ps-text-sec">
          <Bi
            es="Apuestas a que el local gana por exactamente 2, y lo llamas 4–2."
            en="You back the home side to win by exactly 2, and call it 4–2."
          />
        </p>
        <div className="mt-3 space-y-1.5 font-mono text-sm text-ps-text">
          <p>
            <Bi
              es="Ganan 4–2 a los 9:  ganador (4) + margen más ajustado (6) = 10"
              en="They win 4–2 after 9:  winner (4) + tightest margin (6) = 10"
            />
          </p>
          <p>
            <Bi
              es={`Marcador exacto clavado:  ×2 = ${MAX_GAME_POINTS}`}
              en={`Exact score nailed:  ×2 = ${MAX_GAME_POINTS}`}
            />
          </p>
        </div>
        <p className="mt-3 text-xs text-ps-text-ter">
          <Bi
            es={`Juega un rango amplio para un retorno estable, o ve ajustado y persigue el ${MAX_GAME_POINTS} — el máximo de un solo juego. Tu decisión, cada juego.`}
            en={`Play a wide range for a steady return, or go tight and chase the ${MAX_GAME_POINTS} — the most a single game can score. Your call, every game.`}
          />
        </p>
      </section>

      <div className="mt-6">
        <Link
          href={`/ligas-invernales/${league}/picks`}
          className="block rounded-xl bg-liga px-4 py-3 text-center font-display text-sm font-extrabold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:transition-none"
        >
          <Bi es="Ir a mis picks" en="Go to my picks" />
        </Link>
      </div>
    </main>
  );
}
