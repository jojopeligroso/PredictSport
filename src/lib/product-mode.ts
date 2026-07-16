import type { ProductMode } from "@/types/tournament";

export function getProductMode(): ProductMode {
  // NEXT_PUBLIC_ vars are inlined at build time for client code but may not
  // be available at runtime in serverless functions. PRODUCT_MODE (non-public)
  // is always available at runtime via process.env. Check both.
  return (
    (process.env.NEXT_PUBLIC_PRODUCT_MODE as ProductMode) ||
    (process.env.PRODUCT_MODE as ProductMode) ||
    "predictsport_full"
  );
}

export function isWorldCupShell(): boolean {
  return getProductMode() === "world_cup_2026_shell";
}

export function isWorldCupArchive(): boolean {
  return getProductMode() === "world_cup_2026_archive";
}
