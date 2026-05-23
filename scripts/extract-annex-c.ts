/**
 * One-shot extraction of FIFA WC 2026 Annex C — the 495-row best-third
 * allocation matrix — from `annexes_FWC2026_regulations_EN.pdf` into a
 * TypeScript constant.
 *
 * Run from project root:
 *   npx tsx scripts/extract-annex-c.ts
 *
 * Output: writes `src/lib/bracket/data/wc2026-best-third-allocation.ts`.
 *
 * Validation:
 *   - Exactly 495 rows extracted.
 *   - Each row has 8 distinct `3X` cells covering 8 of {A..L}.
 *   - Each `(winner-slot, third-letter)` pair respects the per-slot
 *     eligibility set from Article 12.6 of the regulations.
 *   - No two rows share the same sorted 8-letter key (so 495 unique keys).
 *
 * Aborts the run on any invariant failure.
 */

import { execSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PDF = "annexes_FWC2026_regulations_EN.pdf";
const OUT = "src/lib/bracket/data/wc2026-best-third-allocation.ts";

// Article 12.6 — per-slot eligibility sets. Each best-third R32 slot accepts
// a third from only one of these 5-group subsets.
const ELIGIBILITY: Record<WinnerSlot, ReadonlySet<string>> = {
  A: new Set(["C", "E", "F", "H", "I"]), // M79
  B: new Set(["E", "F", "G", "I", "J"]), // M85
  D: new Set(["B", "E", "F", "I", "J"]), // M81
  E: new Set(["A", "B", "C", "D", "F"]), // M74
  G: new Set(["A", "E", "H", "I", "J"]), // M82
  I: new Set(["C", "D", "F", "G", "H"]), // M77
  K: new Set(["D", "E", "I", "J", "L"]), // M87
  L: new Set(["E", "H", "I", "J", "K"]), // M80
} as const;

type WinnerSlot = "A" | "B" | "D" | "E" | "G" | "I" | "K" | "L";
const WINNER_SLOTS: WinnerSlot[] = ["A", "B", "D", "E", "G", "I", "K", "L"];

function fail(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Get the PDF text (use pdftotext -layout to preserve columns).
// ---------------------------------------------------------------------------

if (!existsSync(PDF)) fail(`PDF not found: ${PDF} (run from project root)`);

const text = execSync(`pdftotext -layout ${PDF} -`, {
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});

// ---------------------------------------------------------------------------
// 2. Parse rows. Each row looks like:
//      "      1      3E   3J   3I   3F   3H   3G   3L   3K"
//    with optional leading whitespace and 2+ spaces between fields.
// ---------------------------------------------------------------------------

const ROW_RE = /^\s*(\d{1,3})\s+(3[A-L])\s+(3[A-L])\s+(3[A-L])\s+(3[A-L])\s+(3[A-L])\s+(3[A-L])\s+(3[A-L])\s+(3[A-L])\s*$/;

interface Row {
  index: number;
  /** Map of winner-slot letter → third's group letter (without the '3'). */
  pairings: Record<WinnerSlot, string>;
}

const rows: Row[] = [];

for (const line of text.split("\n")) {
  const m = line.match(ROW_RE);
  if (!m) continue;
  const index = parseInt(m[1], 10);
  // Skip the header (the "Option" column would never match — single digits
  // could spuriously match a row index, so additionally require index in [1,
  // 495] which the row regex enforces by digit count and we re-check here).
  if (index < 1 || index > 495) continue;
  const cellLetters = m.slice(2, 10).map((c) => c.charAt(1)); // strip leading '3'
  const pairings = {} as Record<WinnerSlot, string>;
  WINNER_SLOTS.forEach((slot, i) => {
    pairings[slot] = cellLetters[i];
  });
  rows.push({ index, pairings });
}

console.log(`Parsed ${rows.length} rows`);

// ---------------------------------------------------------------------------
// 3. Validate.
// ---------------------------------------------------------------------------

if (rows.length !== 495) {
  fail(`Expected exactly 495 rows, got ${rows.length}`);
}

// Indices must be 1..495 with no duplicates and no gaps.
const indices = rows.map((r) => r.index).sort((a, b) => a - b);
for (let i = 0; i < 495; i++) {
  if (indices[i] !== i + 1) {
    fail(`Row index gap at position ${i}: expected ${i + 1}, got ${indices[i]}`);
  }
}

// Each row: 8 distinct third-letters; each pairing respects eligibility.
const keys = new Set<string>();
for (const row of rows) {
  const letters = Object.values(row.pairings);
  const uniq = new Set(letters);
  if (uniq.size !== 8) {
    fail(`Row ${row.index}: 8 cells but only ${uniq.size} distinct letters: ${letters.join(",")}`);
  }
  for (const slot of WINNER_SLOTS) {
    const third = row.pairings[slot];
    if (!ELIGIBILITY[slot].has(third)) {
      fail(
        `Row ${row.index}: winner ${slot} paired with 3${third} but eligibility set is ${[...ELIGIBILITY[slot]].join(",")}`,
      );
    }
  }
  const key = [...letters].sort().join(",");
  if (keys.has(key)) {
    fail(`Row ${row.index}: duplicate qualifying-thirds key ${key}`);
  }
  keys.add(key);
}

console.log("✅ All 495 rows validated");

// ---------------------------------------------------------------------------
// 4. Emit TypeScript.
// ---------------------------------------------------------------------------

const sorted = [...rows].sort((a, b) => a.index - b.index);

const entries = sorted.map((r) => {
  const key = Object.values(r.pairings).sort().join(",");
  const value = WINNER_SLOTS.map((s) => `${s}:"${r.pairings[s]}"`).join(",");
  return `  "${key}":{${value}}, // Annex C row ${r.index}`;
});

const out = `// AUTO-GENERATED by scripts/extract-annex-c.ts from
// annexes_FWC2026_regulations_EN.pdf (Annex C, pages 80-97 of the FIFA
// World Cup 2026 Regulations, 495 entries).
//
// Do not edit by hand. To regenerate:
//   npx tsx scripts/extract-annex-c.ts
//
// Shape: key = sorted-CSV of the 8 group letters whose third-placed teams
// qualified; value = map of winner-group letter → group letter whose third
// they play in R32. Compatible with Article 12.6 of the regulations.

export type Wc2026WinnerSlot = "A" | "B" | "D" | "E" | "G" | "I" | "K" | "L";

export type Wc2026BestThirdRow = Record<Wc2026WinnerSlot, string>;

export const WC2026_WINNER_SLOTS: readonly Wc2026WinnerSlot[] = [
  "A", "B", "D", "E", "G", "I", "K", "L",
] as const;

/**
 * Per-slot eligibility — each best-third R32 slot accepts a third from
 * only this 5-group subset. From Article 12.6 of the WC 2026 Regulations.
 * Useful for runtime validation; the matrix itself respects these by
 * construction (the extraction script aborts if any row violates them).
 */
export const WC2026_BEST_THIRD_ELIGIBILITY: Readonly<
  Record<Wc2026WinnerSlot, ReadonlySet<string>>
> = {
  A: new Set(["C", "E", "F", "H", "I"]),
  B: new Set(["E", "F", "G", "I", "J"]),
  D: new Set(["B", "E", "F", "I", "J"]),
  E: new Set(["A", "B", "C", "D", "F"]),
  G: new Set(["A", "E", "H", "I", "J"]),
  I: new Set(["C", "D", "F", "G", "H"]),
  K: new Set(["D", "E", "I", "J", "L"]),
  L: new Set(["E", "H", "I", "J", "K"]),
} as const;

export const WC2026_BEST_THIRD_ALLOCATION: Readonly<Record<string, Wc2026BestThirdRow>> = {
${entries.join("\n")}
};
`;

const outPath = resolve(OUT);
writeFileSync(outPath, out);
console.log(`✅ Wrote ${outPath} (${rows.length} entries)`);
