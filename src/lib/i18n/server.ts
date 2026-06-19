/**
 * Server-side i18n utility.
 *
 * Reads the `locale` cookie to determine the active language, then
 * returns a `t(key, vars?)` function identical to the client-side `useT()`.
 *
 * Server components update on the next navigation after a locale switch
 * (the client-side LocaleProvider writes the cookie immediately).
 */

import { cookies } from 'next/headers';
import type { Locale } from './index';
import en from './locales/en.json';
import es from './locales/es.json';

const messages: Record<Locale, Record<string, string>> = { en, es };

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const val = cookieStore.get('locale')?.value;
  return val === 'es' ? 'es' : 'en';
}

export async function getServerT() {
  const locale = await getServerLocale();
  return (key: string, vars?: Record<string, string | number>) => {
    let text = messages[locale]?.[key] ?? messages.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  };
}

/**
 * Translate a key for a specific locale without request context.
 * Used by cron jobs and other server-side code that knows the user's locale.
 */
export function serverT(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  let text = messages[locale]?.[key] ?? messages.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
