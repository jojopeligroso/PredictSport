/**
 * /wc/rules — Scoring and classification rules for the World Cup game.
 *
 * Server component. No client JS required — collapsible sections use native
 * <details>/<summary>. Scoring info was moved here from the landing page per
 * Section 22 of DESIGN-WC-DASHBOARD-STATE.md.
 */
import { Metadata } from "next";
import { WcBrandedTitle } from "@/components/wc/WcBrandedTitle";

export const metadata: Metadata = {
  title: "Rules — FIFA World Cup 2026",
  description:
    "Simple scoring explained. Points, classifications, and tiebreakers for the FIFA World Cup 2026 prediction game.",
};

export default function WcRulesPage() {
  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <WcBrandedTitle
        title="Rules"
        subtitle="Simple scoring. How it works."
        backHref="/wc"
        backLabel="Back to World Cup"
        className="mb-8"
      />

      <div className="space-y-3">
        {/* Section 1: Scoring */}
        <details className="group rounded-lg border border-ps-border bg-ps-surface open:border-ps-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
            <span className="font-display font-extrabold text-ps-text">
              Scoring
            </span>
            <span
              className="text-ps-text-sec transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▾
            </span>
          </summary>

          <div className="border-t border-ps-border px-4 pb-4 pt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ps-border">
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-ps-text-sec">
                    Prediction
                  </th>
                  <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-ps-text-sec">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ps-border">
                <tr>
                  <td className="py-2.5 text-ps-text">
                    Correct match outcome (winner/draw)
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-ps-amber">
                    2
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-ps-text">Exact score bonus</td>
                  <td className="py-2.5 text-right font-mono font-bold text-ps-amber">
                    +3
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-ps-text">
                    Correct advancing team (knockout)
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-ps-amber">
                    1
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="mt-3 text-xs text-ps-text-sec">
              Group: max <span className="font-mono font-bold">5pts</span> per
              match. Knockout: max{" "}
              <span className="font-mono font-bold">6pts</span>.
            </p>
          </div>
        </details>

        {/* Section 2: Classifications */}
        <details className="group rounded-lg border border-ps-border bg-ps-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
            <span className="font-display font-extrabold text-ps-text">
              Classifications
            </span>
            <span
              className="text-ps-text-sec transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▾
            </span>
          </summary>

          <div className="border-t border-ps-border px-4 pb-4 pt-3">
            <ul className="space-y-3">
              <ClassificationItem
                name="Overall"
                description="Every point you earn across every prediction window counts towards one running total. Whoever has the most points when the final whistle blows wins. The purest test — consistency over the whole tournament."
              />
              <ClassificationItem
                name="Format"
                description="Players are drawn into groups of four. After each stage of matches, points reset and the bottom-placed player in each group is eliminated. New groups are drawn from the survivors and it starts again. Last player standing wins."
              />
              <ClassificationItem
                name="Full Bracket"
                description="Before a ball is kicked, predict every group finishing order and the entire knockout bracket — from the Round of 32 right through to the final. Everything locks at the first whistle. As results come in, each correct pick earns points. Most points from your locked bracket wins."
              />
              <ClassificationItem
                name="KO Bracket"
                description="Once the group stage is done, a second bracket opens with the real 32 qualified teams. Predict every knockout match from the Round of 32 to the final. Same scoring as the Full Bracket, but with the advantage of knowing who actually made it through."
              />
            </ul>

            <div className="mt-4 rounded-md border border-dashed border-ps-border px-3 py-2.5">
              <p className="text-xs font-semibold text-ps-text-sec">
                Bonus: The Cut
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ps-text-sec">
                How many of the 32 knockout teams did your Full Bracket get
                right? A fun stat pulled automatically from your picks — not a
                separate competition, just bragging rights.
              </p>
            </div>
          </div>
        </details>

        {/* Section 3: Tiebreakers */}
        <details className="group rounded-lg border border-ps-border bg-ps-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
            <span className="font-display font-extrabold text-ps-text">
              Tiebreakers
            </span>
            <span
              className="text-ps-text-sec transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▾
            </span>
          </summary>

          <div className="border-t border-ps-border px-4 pb-4 pt-3">
            <p className="text-sm leading-relaxed text-ps-text-sec">
              Ties broken by: head-to-head goal difference, head-to-head goals
              scored, overall goal difference, overall goals scored, random.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

function ClassificationItem({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <li className="rounded-md bg-ps-chip px-3 py-2.5">
      <p className="text-sm font-semibold text-ps-text">{name}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ps-text-sec">
        {description}
      </p>
    </li>
  );
}
