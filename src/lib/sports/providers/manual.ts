import type { NormalizedResult, SearchableEvent, Sport, SportsProvider } from "../types";

/**
 * Null provider for sports without APIs (GAA, Snooker).
 * Always returns null/empty — admin must enter results manually.
 * Exists so the registry always has at least one entry per sport.
 */
export class ManualProvider implements SportsProvider {
  readonly name = "manual";
  readonly supportedSports = [
    "gaa",
    "snooker",
  ] as const satisfies readonly Sport[];

  async getResult(): Promise<NormalizedResult | null> {
    return null;
  }

  async searchEvents(): Promise<SearchableEvent[]> {
    return [];
  }
}
