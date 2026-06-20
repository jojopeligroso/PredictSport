'use client';

import { useState, useCallback } from 'react';

export type ConfidencePhase =
  | 'invisible'
  | 'intro'
  | 'active'
  | 'nudge'
  | 'deprioritized'
  | 'hidden';

const KEYS = {
  graceCount: 'wc-confidence-grace-count',
  introduced: 'wc-confidence-introduced',
  everUsed: 'wc-confidence-ever-used',
  nudgeCount: 'wc-confidence-nudge-count',
  dismissCount: 'wc-confidence-dismiss-count',
  hidden: 'wc-confidence-hidden',
  neglectCount: 'wc-confidence-neglect-count',
} as const;

function readInt(key: string): number {
  if (typeof window === 'undefined') return 0;
  const val = localStorage.getItem(key);
  if (val === null) return 0;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function readBool(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(key) === 'true';
}

function writeInt(key: string, value: number): void {
  localStorage.setItem(key, String(value));
}

function writeBool(key: string, value: boolean): void {
  localStorage.setItem(key, String(value));
}

interface DisclosureState {
  graceCount: number;
  introduced: boolean;
  everUsed: boolean;
  nudgeCount: number;
  dismissCount: number;
  hidden: boolean;
  neglectCount: number;
}

function loadState(): DisclosureState {
  return {
    graceCount: readInt(KEYS.graceCount),
    introduced: readBool(KEYS.introduced),
    everUsed: readBool(KEYS.everUsed),
    nudgeCount: readInt(KEYS.nudgeCount),
    dismissCount: readInt(KEYS.dismissCount),
    hidden: readBool(KEYS.hidden),
    neglectCount: readInt(KEYS.neglectCount),
  };
}

function derivePhase(s: DisclosureState): ConfidencePhase {
  // hidden takes priority — user earned opt-out
  if (s.hidden || s.dismissCount >= 4 || (s.neglectCount >= 10 && s.nudgeCount >= 3)) {
    return 'hidden';
  }

  // grace period
  if (s.graceCount < 3) {
    return 'invisible';
  }

  // intro moment not yet shown
  if (!s.introduced) {
    return 'intro';
  }

  // deprioritized: all 3 nudges sent, never used, 17+ neglects
  if (s.nudgeCount >= 3 && !s.everUsed && s.neglectCount >= 17) {
    return 'deprioritized';
  }

  // nudge: not ever used, 5+ consecutive skips, nudges remaining
  if (!s.everUsed && s.neglectCount >= 5 && s.nudgeCount < 3) {
    return 'nudge';
  }

  return 'active';
}

export function useConfidenceDisclosure() {
  const [state, setState] = useState<DisclosureState>(loadState);

  const phase = derivePhase(state);

  const showIntroCard = phase === 'intro';
  const showBreadcrumb = phase === 'hidden';

  const nudgeIndex: number | null =
    phase === 'nudge' ? state.nudgeCount : null;

  const recordPrediction = useCallback(() => {
    setState((prev) => {
      const next = { ...prev };

      // Always increment grace count
      next.graceCount = prev.graceCount + 1;
      writeInt(KEYS.graceCount, next.graceCount);

      // Increment neglect if not invisible, not hidden, and confidence was not used
      // (confidence usage resets neglect via recordConfidenceUsed, so if neglect
      // is being incremented here it means confidence was skipped this prediction)
      const currentPhase = derivePhase(prev);
      if (currentPhase !== 'invisible' && currentPhase !== 'hidden') {
        next.neglectCount = prev.neglectCount + 1;
        writeInt(KEYS.neglectCount, next.neglectCount);

        // If in nudge phase and neglect threshold crossed, increment nudge count
        if (currentPhase === 'nudge') {
          next.nudgeCount = prev.nudgeCount + 1;
          writeInt(KEYS.nudgeCount, next.nudgeCount);
        }
      }

      return next;
    });
  }, []);

  const recordConfidenceUsed = useCallback(() => {
    setState((prev) => {
      const next = { ...prev };
      next.everUsed = true;
      next.neglectCount = 0;
      next.nudgeCount = 0;
      writeBool(KEYS.everUsed, true);
      writeInt(KEYS.neglectCount, 0);
      writeInt(KEYS.nudgeCount, 0);
      return next;
    });
  }, []);

  const recordConfidenceDismissed = useCallback(() => {
    setState((prev) => {
      const next = { ...prev };
      next.dismissCount = prev.dismissCount + 1;
      writeInt(KEYS.dismissCount, next.dismissCount);
      return next;
    });
  }, []);

  const markIntroduced = useCallback(() => {
    setState((prev) => {
      const next = { ...prev };
      next.introduced = true;
      writeBool(KEYS.introduced, true);
      return next;
    });
  }, []);

  const restore = useCallback(() => {
    setState((prev) => {
      const next = { ...prev };
      next.hidden = false;
      next.dismissCount = 0;
      next.neglectCount = 0;
      writeBool(KEYS.hidden, false);
      writeInt(KEYS.dismissCount, 0);
      writeInt(KEYS.neglectCount, 0);
      return next;
    });
  }, []);

  const resetForCompetition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const fresh: DisclosureState = {
      graceCount: 0,
      introduced: false,
      everUsed: false,
      nudgeCount: 0,
      dismissCount: 0,
      hidden: false,
      neglectCount: 0,
    };
    Object.entries(KEYS).forEach(([, key]) => {
      localStorage.removeItem(key);
    });
    setState(fresh);
  }, []);

  return {
    phase,
    showIntroCard,
    showBreadcrumb,
    nudgeIndex,
    recordPrediction,
    recordConfidenceUsed,
    recordConfidenceDismissed,
    markIntroduced,
    restore,
    resetForCompetition,
  } as const;
}
