/**
 * Simple in-memory sliding-window rate limiter keyed by provider name.
 * Best-effort in serverless — cold starts reset the window, which is
 * acceptable since results are cached in DB and fetched infrequently.
 */

interface Window {
  timestamps: number[];
}

const windows = new Map<string, Window>();

export function checkRateLimit(
  providerName: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  let window = windows.get(providerName);
  if (!window) {
    window = { timestamps: [] };
    windows.set(providerName, window);
  }

  // Prune expired timestamps
  window.timestamps = window.timestamps.filter((t) => t > cutoff);

  if (window.timestamps.length >= maxRequests) {
    return false;
  }

  window.timestamps.push(now);
  return true;
}
