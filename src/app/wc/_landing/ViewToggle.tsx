"use client";

import { useT } from "@/lib/i18n";
import { CHROME_PALETTE } from "./brand-palette";

export type ViewMode = "date" | "group";

/**
 * Two-peer segmented control: By date | By group.
 *
 * Equal peers, not on/off — both modes view the same 24 events; only the
 * sectioning differs. Active segment is underlined in the brand chrome
 * royal-blue (CHROME_PALETTE.toggleActive) to stay visually distinct from
 * the amber pick-selection token used on cards.
 *
 * Visual lineage: FixturesTabs.TabButton (lines 180–218) was the closest
 * existing pattern. We borrow the tablist semantics and styling rhythm,
 * but swap the filled-pill active state for an underline because two
 * equal peers read cleaner that way at narrow widths.
 */
export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  const t = useT();
  return (
    <div
      role="tablist"
      aria-label="Group picks by"
      className="mx-auto mt-4 flex w-full max-w-[480px] gap-1 px-4"
    >
      <Segment label={t('wc.by_date')} active={value === "date"} onClick={() => onChange("date")} />
      <Segment label={t('wc.by_group')} active={value === "group"} onClick={() => onChange("group")} />
    </div>
  );
}

function Segment({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "flex-1 rounded-md py-2 text-xs font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber/50",
        active ? "text-ps-text" : "text-ps-text-ter hover:text-ps-text-sec",
      ].join(" ")}
      style={
        active
          ? {
              borderBottom: `2px solid ${CHROME_PALETTE.toggleActive}`,
              marginBottom: -2,
            }
          : { borderBottom: "2px solid transparent", marginBottom: -2 }
      }
    >
      {label}
    </button>
  );
}
