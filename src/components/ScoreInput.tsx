"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ScoreInputProps {
  homeLabel: string;
  awayLabel: string;
  initialHome?: string;
  initialAway?: string;
  onCommit: (home: number, away: number) => void | Promise<void>;
  disabled?: boolean;
  variant: "compact" | "card" | "standard";
}

/**
 * Unified score input primitive.
 *
 * Renders two numeric inputs (home / away) with a dash separator.
 * Manages its own internal state and calls `onCommit` when both inputs
 * contain valid numbers. Identical interaction behaviour across all three
 * visual variants (compact, card, standard).
 *
 * Ghost-value UX: focusing a filled input stores the current value as a
 * faded placeholder and clears the visible text so the user can type fresh.
 * Blurring without typing restores the ghost.
 *
 * Auto-commit: 1.75 s of inactivity blurs both inputs, triggering commit.
 */
export function ScoreInput({
  homeLabel,
  awayLabel,
  initialHome,
  initialAway,
  onCommit,
  disabled = false,
  variant,
}: ScoreInputProps) {
  const [home, setHome] = useState(initialHome ?? "");
  const [away, setAway] = useState(initialAway ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Ghost values — shown as faded placeholders while the user re-enters.
  const [homeGhost, setHomeGhost] = useState("");
  const [awayGhost, setAwayGhost] = useState("");

  const homeRef = useRef<HTMLInputElement>(null);
  const awayRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs track the latest values synchronously so blur handlers never read
  // stale closure state (the batched setState hasn't committed yet when a
  // synchronous focus change triggers blur).
  const homeValueRef = useRef(initialHome ?? "");
  const awayValueRef = useRef(initialAway ?? "");

  // Guard against double-commit with identical values.
  const lastCommitted = useRef<{ home: number; away: number } | null>(null);

  // ── Auto-commit timer ──────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Only auto-blur when both scores are filled — don't kick the user
      // out of the away input before they've typed in it.
      if (homeValueRef.current !== "" && awayValueRef.current !== "") {
        homeRef.current?.blur();
        awayRef.current?.blur();
      }
    }, 1750);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  // ── Commit logic (called on blur) ─────────────────────────────────────
  const tryCommit = useCallback(
    (h: string, a: string) => {
      const hNum = parseInt(h, 10);
      const aNum = parseInt(a, 10);
      if (h === "" || a === "" || isNaN(hNum) || isNaN(aNum) || hNum < 0 || aNum < 0) return;

      // Skip if identical to last committed values.
      if (
        lastCommitted.current &&
        lastCommitted.current.home === hNum &&
        lastCommitted.current.away === aNum
      ) {
        return;
      }
      lastCommitted.current = { home: hNum, away: aNum };
      setIsSaving(true);
      const result = onCommit(hNum, aNum);
      if (result instanceof Promise) {
        result.finally(() => setIsSaving(false));
      } else {
        setTimeout(() => setIsSaving(false), 300);
      }
    },
    [onCommit],
  );

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleHomeFocus = useCallback(() => {
    if (homeValueRef.current !== "") {
      setHomeGhost(homeValueRef.current);
      setHome("");
      homeValueRef.current = "";
    }
  }, []);

  const handleAwayFocus = useCallback(() => {
    if (awayValueRef.current !== "") {
      setAwayGhost(awayValueRef.current);
      setAway("");
      awayValueRef.current = "";
    }
  }, []);

  const handleHomeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, "");
      const val = raw === "" ? "" : String(parseInt(raw, 10));
      homeValueRef.current = val;
      setHome(val);
      resetTimer();
      // Clear any pending single-digit advance timer on each keystroke.
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (val.length >= 2) {
        // Two digits typed — advance immediately.
        awayRef.current?.focus();
      } else if (val.length === 1) {
        // Single digit — advance after 750 ms if no second digit follows.
        advanceTimerRef.current = setTimeout(() => {
          awayRef.current?.focus();
        }, 750);
      }
    },
    [resetTimer],
  );

  const handleAwayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, "");
      const val = raw === "" ? "" : String(parseInt(raw, 10));
      awayValueRef.current = val;
      setAway(val);
      resetTimer();
    },
    [resetTimer],
  );

  const handleHomeBlur = useCallback(() => {
    let resolved = homeValueRef.current;
    if (resolved === "" && homeGhost !== "") {
      resolved = homeGhost;
      setHome(homeGhost);
      homeValueRef.current = homeGhost;
    }
    setHomeGhost("");
    tryCommit(resolved, awayValueRef.current || awayGhost);
  }, [homeGhost, awayGhost, tryCommit]);

  const handleAwayBlur = useCallback(() => {
    let resolved = awayValueRef.current;
    if (resolved === "" && awayGhost !== "") {
      resolved = awayGhost;
      setAway(awayGhost);
      awayValueRef.current = awayGhost;
    }
    setAwayGhost("");
    tryCommit(homeValueRef.current || homeGhost, resolved);
  }, [awayGhost, homeGhost, tryCommit]);

  // ── Variant-specific class strings ─────────────────────────────────────
  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-1${isSaving ? " animate-pulse" : ""}`}>
        <input
          ref={homeRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={home}
          placeholder={homeGhost || undefined}
          onChange={handleHomeChange}
          onFocus={handleHomeFocus}
          onBlur={handleHomeBlur}
          disabled={disabled}
          aria-label={`${homeLabel} score`}
          className={[
            "w-[34px] h-[32px] rounded-full border text-center font-mono text-base font-semibold text-ps-text outline-none transition-all duration-150 shrink-0",
            home !== "" ? "bg-white border-ps-amber" : "bg-transparent border-ps-border",
            "focus:border-ps-amber focus:bg-white",
          ].join(" ")}
        />
        <span className="text-xs text-ps-text-ter">&ndash;</span>
        <input
          ref={awayRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={away}
          placeholder={awayGhost || undefined}
          onChange={handleAwayChange}
          onFocus={handleAwayFocus}
          onBlur={handleAwayBlur}
          disabled={disabled}
          aria-label={`${awayLabel} score`}
          className={[
            "w-[34px] h-[32px] rounded-full border text-center font-mono text-base font-semibold text-ps-text outline-none transition-all duration-150 shrink-0",
            away !== "" ? "bg-white border-ps-amber" : "bg-transparent border-ps-border",
            "focus:border-ps-amber focus:bg-white",
          ].join(" ")}
        />
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`inline-flex items-center gap-1${isSaving ? " animate-pulse" : ""}`}>
        <input
          ref={homeRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={home}
          placeholder={homeGhost || undefined}
          onChange={handleHomeChange}
          onFocus={handleHomeFocus}
          onBlur={handleHomeBlur}
          disabled={disabled}
          aria-label={`${homeLabel} score`}
          className={[
            "w-[34px] h-[32px] rounded-full border text-center font-mono text-base font-semibold tabular-nums text-white outline-none transition-all duration-150 shrink-0 placeholder:text-white/40",
            home !== "" ? "bg-black/30 border-ps-amber" : "bg-black/20 border-white/30",
            "focus:border-ps-amber focus:bg-black/35",
          ].join(" ")}
        />
        <span className="font-mono text-sm font-bold text-white/70">&ndash;</span>
        <input
          ref={awayRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={away}
          placeholder={awayGhost || undefined}
          onChange={handleAwayChange}
          onFocus={handleAwayFocus}
          onBlur={handleAwayBlur}
          disabled={disabled}
          aria-label={`${awayLabel} score`}
          className={[
            "w-[34px] h-[32px] rounded-full border text-center font-mono text-base font-semibold tabular-nums text-white outline-none transition-all duration-150 shrink-0 placeholder:text-white/40",
            away !== "" ? "bg-black/30 border-ps-amber" : "bg-black/20 border-white/30",
            "focus:border-ps-amber focus:bg-black/35",
          ].join(" ")}
        />
      </div>
    );
  }

  // variant === "standard"
  return (
    <div className={`flex items-center gap-2${isSaving ? " animate-pulse" : ""}`}>
      <span className="text-xs font-semibold text-ps-text min-w-[60px] truncate text-right">
        {homeLabel}
      </span>
      <input
        ref={homeRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={home}
        placeholder={homeGhost || undefined}
        onChange={handleHomeChange}
        onFocus={handleHomeFocus}
        onBlur={handleHomeBlur}
        disabled={disabled}
        aria-label={`${homeLabel} score`}
        className="w-12 rounded-md border border-ps-border-strong bg-ps-surface px-1.5 py-1.5 text-center text-base font-mono text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <span className="text-xs text-ps-text-ter">-</span>
      <input
        ref={awayRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={away}
        placeholder={awayGhost || undefined}
        onChange={handleAwayChange}
        onFocus={handleAwayFocus}
        onBlur={handleAwayBlur}
        disabled={disabled}
        aria-label={`${awayLabel} score`}
        className="w-12 rounded-md border border-ps-border-strong bg-ps-surface px-1.5 py-1.5 text-center text-base font-mono text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <span className="text-xs font-semibold text-ps-text min-w-[60px] truncate">
        {awayLabel}
      </span>
    </div>
  );
}
