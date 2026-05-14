import { checkRateLimit } from "../rate-limiter";
import type {
  NormalizedResult,
  ProviderConfig,
  SearchableEvent,
  Sport,
  SportsProvider,
} from "../types";

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Abstract base provider with shared fetch, rate limiting, and error handling.
 * All providers extend this. The only place fetch() is called.
 */
export abstract class BaseProvider implements SportsProvider {
  abstract readonly name: string;
  abstract readonly supportedSports: readonly Sport[];
  protected abstract readonly config: ProviderConfig;

  protected async apiFetch<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T | null> {
    const { baseUrl, rateLimit, apiKey } = this.config;

    if (!checkRateLimit(this.name, rateLimit.requests, rateLimit.windowMs)) {
      console.warn(`[sports] ${this.name}: rate limit exceeded, skipping`);
      return null;
    }

    const url = new URL(path, baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) {
      // Subclasses can override getAuthHeader() if the API uses a different header
      Object.assign(headers, this.getAuthHeaders(apiKey));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(
          `[sports] ${this.name}: ${response.status} ${response.statusText} for ${path}`
        );
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.error(`[sports] ${this.name}: timeout for ${path}`);
      } else {
        console.error(`[sports] ${this.name}: fetch error for ${path}:`, error);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Override in subclasses that use non-standard auth headers */
  protected getAuthHeaders(apiKey: string): Record<string, string> {
    return { Authorization: `Bearer ${apiKey}` };
  }

  abstract getResult(
    sport: Sport,
    externalEventId: string,
    providerLeague?: string
  ): Promise<NormalizedResult | null>;

  abstract searchEvents(
    sport: Sport,
    query: string,
    options?: { date?: string; limit?: number }
  ): Promise<SearchableEvent[]>;
}
