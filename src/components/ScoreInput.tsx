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

  // Ghost values — shown as faded placeholders while the user re-enters.
  const [homeGhost, setHomeGhost] = useState("");
  const [awayGhost, setAwayGhost] = useState("");

  const homeRef = useRef<HTMLInputElement>(null);
  const awayRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Guard against double-commit with identical values.
  const lastCommitted = useRef<{ home: number; away: number } | null>(null);

  // ── Auto-commit timer ──────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      homeRef.current?.blur();
      awayRef.current?.blur();
    }, 1750);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
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
      onCommit(hNum, aNum);
    },
    [onCommit],
  );

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleHomeFocus = useCallback(() => {
    if (home !== "") {
      setHomeGhost(home);
      setHome("");
    }
  }, [home]);

  const handleAwayFocus = useCallback(() => {
    if (away !== "") {
      setAwayGhost(away);
      setAway("");
    }
  }, [away]);

  const handleHomeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, "");
      const val = raw === "" ? "" : String(parseInt(raw, 10));
      setHome(val);
      resetTimer();
      // Auto-advance to away input on digit entry.
      if (val !== "") {
        awayRef.current?.focus();
      }
    },
    [resetTimer],
  );

  const handleAwayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, "");
      const val = raw === "" ? "" : String(parseInt(raw, 10));
      setAway(val);
      resetTimer();
    },
    [resetTimer],
  );

  const handleHomeBlur = useCallback(() => {
    let resolved = home;
    if (home === "" && homeGhost !== "") {
      resolved = homeGhost;
      setHome(homeGhost);
    }
    setHomeGhost("");
    // Use resolved + current away for commit check.
    // We need the latest away — read from state via a ref-like pattern.
    // Since away is captured in closure, this works for the blur moment.
    tryCommit(resolved, away || awayGhost);
  }, [home, homeGhost, away, awayGhost, tryCommit]);

  const handleAwayBlur = useCallback(() => {
    let resolved = away;
    if (away === "" && awayGhost !== "") {
      resolved = awayGhost;
      setAway(awayGhost);
    }
    setAwayGhost("");
    tryCommit(home || homeGhost, resolved);
  }, [away, awayGhost, home, homeGhost, tryCommit]);

  // ── Variant-specific class strings ─────────────────────────────────────
  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-1">
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
      <div className="inline-flex items-center gap-1">
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
            "w-[34px] h-[32px] rounded-full border text-center font-mono text-base font-semibold text-white outline-none transition-all duration-150 shrink-0 placeholder:text-white/30",
            home !== "" ? "bg-white/18 border-ps-amber/70" : "bg-white/8 border-white/25",
            "focus:border-ps-amber/80 focus:bg-white/15",
          ].join(" ")}
        />
        <span className="text-xs text-white/40">&ndash;</span>
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
            "w-[34px] h-[32px] rounded-full border text-center font-mono text-base font-semibold text-white outline-none transition-all duration-150 shrink-0 placeholder:text-white/30",
            away !== "" ? "bg-white/18 border-ps-amber/70" : "bg-white/8 border-white/25",
            "focus:border-ps-amber/80 focus:bg-white/15",
          ].join(" ")}
        />
      </div>
    );
  }

  // variant === "standard"
  return (
    <div className="flex items-center gap-2">
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
