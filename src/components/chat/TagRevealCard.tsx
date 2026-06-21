/**
 * TagRevealCard — structured Data Fact Card rendered inside chat for
 * `system_tag_reveal` messages. Reads entirely from the chat message's
 * `metadata` JSONB payload — no external data fetching.
 *
 * Design reference: REPUTATION_COPY_SPEC §5-6
 */

export interface TagRevealMetadata {
  tagName: string;
  displayName: string;
  layer1: string;
  factCard: {
    fact: string;
    stat: string;
    context: string;
  };
  visual: {
    borderColor: string;
    gold?: boolean;
    opacity?: number;
  };
}

interface TagRevealCardProps {
  metadata: TagRevealMetadata;
}

export function TagRevealCard({ metadata }: TagRevealCardProps) {
  const { tagName, displayName, factCard, visual } = metadata;

  const borderColor = visual.gold ? "#FFD700" : (visual.borderColor || "var(--ps-amber)");

  return (
    <div
      className="mt-2 rounded-lg px-3 py-2.5 bg-ps-amber-soft"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        opacity: visual.opacity ?? 1,
      }}
    >
      {/* Tag name — Inter 800, uppercase */}
      <p className="font-display font-extrabold uppercase text-xs tracking-wider text-ps-text">
        {tagName}
      </p>

      {/* Display name — Inter 500 */}
      <p className="text-xs text-ps-text mt-0.5">
        {displayName}
      </p>

      {/* Data fact — Instrument Serif italic */}
      <p className="font-serif italic text-xs text-ps-text mt-2 leading-relaxed">
        {factCard.fact}
      </p>

      {/* Specific stat — JetBrains Mono, amber-deep */}
      <p className="font-mono text-xs text-ps-amber-deep mt-1 font-semibold">
        {factCard.stat}
      </p>

      {/* Group context — Inter 400, secondary text */}
      {factCard.context && (
        <p className="text-[11px] text-ps-text-ter mt-1.5 leading-snug">
          {factCard.context}
        </p>
      )}
    </div>
  );
}
