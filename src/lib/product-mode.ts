import type { ProductMode } from "@/types/tournament";

export function getProductMode(): ProductMode {
  return (process.env.NEXT_PUBLIC_PRODUCT_MODE as ProductMode) || "predictsport_full";
}

export function isWorldCupShell(): boolean {
  return getProductMode() === "world_cup_2026_shell";
}

export function isWorldCupArchive(): boolean {
  return getProductMode() === "world_cup_2026_archive";
}
