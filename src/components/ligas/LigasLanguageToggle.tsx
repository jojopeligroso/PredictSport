"use client";

import { usePathname } from "next/navigation";
import { LanguageToggle } from "@/components/LanguageToggle";

/**
 * LigasLanguageToggle — LanguageToggle for the /ligasinvernales surface.
 *
 * Spanish flag is contextual: the country of the league being viewed
 * (MX / VE / DO / PR), falling back to Mexico on the hub, todas and SdC
 * pages. English flag is always the US.
 */

const LEAGUE_FLAGS: Record<string, string> = {
  lmp: "mx",
  lvbp: "ve",
  lidom: "do",
  lbprc: "pr",
};

export function LigasLanguageToggle() {
  const pathname = usePathname();
  const segment = pathname.split("/")[2] ?? "";
  const esFlag = LEAGUE_FLAGS[segment] ?? "mx";
  return <LanguageToggle esFlag={esFlag} enFlag="us" />;
}
