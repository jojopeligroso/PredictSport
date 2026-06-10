'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import en from './locales/en.json';
import es from './locales/es.json';

/* ── Types ──────────────────────────────────────────────────────────── */

export type Locale = 'en' | 'es';

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

/* ── Context ────────────────────────────────────────────────────────── */

const LocaleContext = createContext<LocaleCtx>({
  locale: 'en',
  setLocale: () => {},
});

/* ── Provider ───────────────────────────────────────────────────────── */

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('locale');
  return stored === 'es' ? 'es' : 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('locale', l);
    document.cookie = `locale=${l};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`;
    // Update <html lang> for accessibility
    document.documentElement.lang = l;
  }, []);

  return (
    <LocaleContext value={{ locale, setLocale }}>
      {children}
    </LocaleContext>
  );
}

/* ── Hooks ──────────────────────────────────────────────────────────── */

export function useLocale() {
  return useContext(LocaleContext);
}

const messages: Record<Locale, Record<string, string>> = { en, es };

/**
 * Returns a translation function `t(key, vars?)`.
 * Falls back to English, then to the raw key.
 */
export function useT() {
  const { locale } = useLocale();

  return useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let text = messages[locale]?.[key] ?? messages.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale],
  );
}
