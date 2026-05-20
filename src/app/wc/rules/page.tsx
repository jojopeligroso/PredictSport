/**
 * /rules — Public rules and scoring explanation for the World Cup game.
 */
export default function RulesPage() {
  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <h1 className="text-xl font-extrabold text-ps-text">Rules</h1>

      <div className="mt-6 space-y-8">
        <Section title="How It Works">
          <p>
            Predict match outcomes and exact scores for every FIFA World Cup 2026 fixture.
            Points are awarded when results are confirmed. Four classifications run simultaneously
            — you compete in all of them.
          </p>
        </Section>

        <Section title="Scoring">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ps-border">
                <th className="py-2 text-left font-semibold text-ps-text-sec">Prediction</th>
                <th className="py-2 text-right font-mono font-semibold text-ps-text-sec">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ps-border">
              <tr>
                <td className="py-2 text-ps-text">Correct match outcome</td>
                <td className="py-2 text-right font-mono font-bold text-ps-amber">2</td>
              </tr>
              <tr>
                <td className="py-2 text-ps-text">Exact score bonus</td>
                <td className="py-2 text-right font-mono font-bold text-ps-amber">3</td>
              </tr>
              <tr>
                <td className="py-2 text-ps-text">Correct advancing team (knockout only)</td>
                <td className="py-2 text-right font-mono font-bold text-ps-amber">1</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ps-text-ter">
            Group matches: max 5pts per match. Knockout matches: max 6pts.
          </p>
        </Section>

        <Section title="Classifications">
          <div className="space-y-4">
            <ClassificationRule
              name="Overall"
              description="Cumulative points across every match in the tournament. Highest total wins."
            />
            <ClassificationRule
              name="Format"
              description="You're placed in prediction groups of 4. Points reset each stage. Bottom performers are eliminated after each stage. Like the World Cup itself, but for predictors."
            />
            <ClassificationRule
              name="Full Bracket"
              description="Before kickoff, predict every group ranking and knockout result. If any of your picks are wrong at any point, your bracket is dead. Last bracket standing wins."
            />
            <ClassificationRule
              name="Knockout Bracket"
              description="Same as Full Bracket but only for the knockout rounds. Opens after the group stage finishes."
            />
          </div>
        </Section>

        <Section title="Deadlines">
          <p>
            Each prediction window has a lock time. Once locked, no picks can be changed.
            Multiple windows may be open at the same time — check the Picks page for
            current deadlines.
          </p>
        </Section>

        <Section title="Results">
          <p>
            Results are confirmed by the game administrator. Provisional results may be shown
            before official confirmation. Points shown with a &quot;Provisional&quot; label may change
            if a result is corrected.
          </p>
        </Section>

        <Section title="Tie-breaking">
          <p>If two players are tied on points, the following order applies:</p>
          <ol className="mt-2 ml-4 list-decimal space-y-1 text-ps-text-sec">
            <li>Total exact-score predictions correct</li>
            <li>Total match outcomes correct</li>
            <li>Earlier average submission time</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-widest text-ps-text-ter">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-ps-text-sec">{children}</div>
    </div>
  );
}

function ClassificationRule({ name, description }: { name: string; description: string }) {
  return (
    <div className="rounded-lg bg-ps-surface border border-ps-border px-3 py-2">
      <h3 className="text-sm font-bold text-ps-text">{name}</h3>
      <p className="mt-1 text-xs text-ps-text-sec">{description}</p>
    </div>
  );
}
