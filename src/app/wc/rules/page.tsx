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
                description="Cumulative points across every prediction window."
              />
              <ClassificationItem
                name="Format"
                description="Prediction groups of four. Bottom drops each stage. Points reset per stage."
              />
              <ClassificationItem
                name="Full Bracket"
                description="Pre-tournament picks for every group and knockout result. Locked at kickoff."
              />
              <ClassificationItem
                name="KO Bracket"
                description="Knockout stage bracket. Opens after the group stage."
              />
              <ClassificationItem
                name="The Cut"
                description="How many of the 32 knockout teams you correctly predicted from your bracket."
              />
            </ul>
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
