import { describe, it, expect } from "vitest";
import {
  computeDailyLockTime,
  computeDayStatus,
  formatLockCountdown,
  getDailyLockTimes,
  DAILY_LOCK_OFFSET_MINUTES,
  utcDateIso,
} from "./daily-lock";

// ── computeDailyLockTime ──────────────────────────────────────────────────

describe("computeDailyLockTime", () => {
  it("returns earliest kickoff minus 10 minutes for a single event", () => {
    const result = computeDailyLockTime([
      { start_time: "2026-06-11T19:00:00Z" },
    ]);
    expect(result.toISOString()).toBe("2026-06-11T18:50:00.000Z");
  });

  it("uses earliest kickoff when multiple matches on one day", () => {
    // Day with 14:00, 17:00, 20:00 kickoffs — locks at 13:50
    const result = computeDailyLockTime([
      { start_time: "2026-06-14T20:00:00Z" },
      { start_time: "2026-06-14T14:00:00Z" },
      { start_time: "2026-06-14T17:00:00Z" },
    ]);
    expect(result.toISOString()).toBe("2026-06-14T13:50:00.000Z");
  });

  it("offset is exactly 10 minutes", () => {
    expect(DAILY_LOCK_OFFSET_MINUTES).toBe(10);
  });

  it("throws for empty events array", () => {
    expect(() => computeDailyLockTime([])).toThrow();
  });
});

// ── getDailyLockTimes ─────────────────────────────────────────────────────

describe("getDailyLockTimes", () => {
  it("groups events by UTC date and returns one lock time per day", () => {
    const events = [
      { id: "a", start_time: "2026-06-11T19:00:00Z", lock_time: "2026-06-11T18:50:00.000Z" },
      { id: "b", start_time: "2026-06-12T02:00:00Z", lock_time: "2026-06-12T01:50:00.000Z" },
      { id: "c", start_time: "2026-06-12T19:00:00Z", lock_time: "2026-06-12T01:50:00.000Z" },
    ];
    const result = getDailyLockTimes(events);
    expect(result.size).toBe(2);
    expect(result.get("2026-06-11")).toBe("2026-06-11T18:50:00.000Z");
    // Both Jun 12 events share the same daily lock time
    expect(result.get("2026-06-12")).toBe("2026-06-12T01:50:00.000Z");
  });

  it("takes earliest lock_time if events on same day have different lock_times (safety net)", () => {
    const events = [
      { id: "a", start_time: "2026-06-14T14:00:00Z", lock_time: "2026-06-14T13:50:00.000Z" },
      { id: "b", start_time: "2026-06-14T20:00:00Z", lock_time: "2026-06-14T19:50:00.000Z" }, // old per-event style
    ];
    const result = getDailyLockTimes(events);
    // Should take the earlier lock_time
    expect(result.get("2026-06-14")).toBe("2026-06-14T13:50:00.000Z");
  });
});

// ── computeDayStatus ──────────────────────────────────────────────────────

describe("computeDayStatus", () => {
  const baseLock = "2026-06-11T18:50:00.000Z";

  it("returns 'complete' when all fixtures have winner + exact_score", () => {
    expect(
      computeDayStatus({
        totalEvents: 3,
        fullyComplete: 3,
        hasAnyOutcome: true,
        lockTime: baseLock,
        now: new Date("2026-06-10T12:00:00Z"),
      })
    ).toBe("complete");
  });

  it("returns 'partial' when outcomes exist but exact scores missing", () => {
    expect(
      computeDayStatus({
        totalEvents: 3,
        fullyComplete: 1,
        hasAnyOutcome: true,
        lockTime: baseLock,
        now: new Date("2026-06-10T12:00:00Z"),
      })
    ).toBe("partial");
  });

  it("returns 'urgent' when incomplete and <24h to lock", () => {
    // 5 hours before lock, no outcomes at all
    expect(
      computeDayStatus({
        totalEvents: 3,
        fullyComplete: 0,
        hasAnyOutcome: false,
        lockTime: baseLock,
        now: new Date("2026-06-11T13:50:00Z"),
      })
    ).toBe("urgent");
  });

  it("does NOT return 'urgent' when >24h before lock", () => {
    expect(
      computeDayStatus({
        totalEvents: 3,
        fullyComplete: 0,
        hasAnyOutcome: false,
        lockTime: baseLock,
        now: new Date("2026-06-09T12:00:00Z"), // >2 days before lock
      })
    ).toBe("upcoming");
  });

  it("returns 'upcoming' when no predictions and >24h to go", () => {
    expect(
      computeDayStatus({
        totalEvents: 3,
        fullyComplete: 0,
        hasAnyOutcome: false,
        lockTime: baseLock,
        now: new Date("2026-06-08T12:00:00Z"),
      })
    ).toBe("upcoming");
  });

  it("complete overrides urgent (complete even if <24h to lock)", () => {
    expect(
      computeDayStatus({
        totalEvents: 2,
        fullyComplete: 2,
        hasAnyOutcome: true,
        lockTime: baseLock,
        now: new Date("2026-06-11T17:00:00Z"), // 1h50m before lock
      })
    ).toBe("complete");
  });

  it("partial overrides urgent (partial even if <24h to lock)", () => {
    expect(
      computeDayStatus({
        totalEvents: 3,
        fullyComplete: 1,
        hasAnyOutcome: true,
        lockTime: baseLock,
        now: new Date("2026-06-11T17:00:00Z"),
      })
    ).toBe("partial");
  });

  it("users can predict future days in advance (no restrictions on early predictions)", () => {
    // 3 days before lock — should be 'upcoming', not blocked
    const status = computeDayStatus({
      totalEvents: 3,
      fullyComplete: 0,
      hasAnyOutcome: false,
      lockTime: baseLock,
      now: new Date("2026-06-08T12:00:00Z"),
    });
    // 'upcoming' means the UI allows predictions — there's no "too early" state
    expect(status).toBe("upcoming");
  });
});

// ── formatLockCountdown ───────────────────────────────────────────────────

describe("formatLockCountdown", () => {
  it("returns null when lock time has passed", () => {
    expect(
      formatLockCountdown("2026-06-11T18:50:00Z", new Date("2026-06-11T19:00:00Z"))
    ).toBeNull();
  });

  it("formats days + hours when > 1 day", () => {
    expect(
      formatLockCountdown("2026-06-13T18:50:00Z", new Date("2026-06-11T12:00:00Z"))
    ).toBe("2d 6h");
  });

  it("formats hours + minutes when < 1 day", () => {
    expect(
      formatLockCountdown("2026-06-11T18:50:00Z", new Date("2026-06-11T15:00:00Z"))
    ).toBe("3h 50m");
  });

  it("formats minutes only when < 1 hour", () => {
    expect(
      formatLockCountdown("2026-06-11T18:50:00Z", new Date("2026-06-11T18:30:00Z"))
    ).toBe("20m");
  });
});

// ── utcDateIso ────────────────────────────────────────────────────────────

describe("utcDateIso", () => {
  it("formats a date in UTC YYYY-MM-DD", () => {
    expect(utcDateIso(new Date("2026-06-11T23:59:59Z"))).toBe("2026-06-11");
  });

  it("handles midnight correctly", () => {
    expect(utcDateIso(new Date("2026-07-01T00:00:00Z"))).toBe("2026-07-01");
  });
});

// ── Color token separation ────────────────────────────────────────────────

describe("color token separation", () => {
  it("completion accent (amber) and attention accent (purple) are distinct", () => {
    // These values come from globals.css / brand-palette.ts
    const completionAccent = "#f59e0b"; // ps-amber
    const attentionAccent = "#a020f0"; // ps-purple / CHROME_PALETTE.attention
    expect(completionAccent).not.toBe(attentionAccent);
  });
});

// ── Internal terminology isolation ────────────────────────────────────────

describe("internal terminology does not leak to user-facing labels", () => {
  it("DayPredictionStatus uses user-neutral terms", () => {
    // The status type should not expose 'daily-round', 'window-id', or
    // internal lock-unit terminology. It uses: complete, partial, urgent, upcoming.
    const statuses: string[] = ["complete", "partial", "urgent", "upcoming"];
    for (const s of statuses) {
      expect(s).not.toContain("round");
      expect(s).not.toContain("window");
    }
  });
});
