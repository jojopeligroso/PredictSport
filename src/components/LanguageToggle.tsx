'use client';

/**
 * LanguageToggle — tiny pill-shaped flag that switches between EN / ES.
 *
 * English flag is randomly chosen per page load:
 *   US (35%), Canada (60%), Ireland (5%)
 * Spanish flag is always Mexico.
 *
 * Uses the same pill silhouette as CountryFlag (FIFA 2026 poster shape).
 */

import { useState } from 'react';
import { useLocale, type Locale } from '@/lib/i18n';

/* ── Flag config ────────────────────────────────────────────────────── */

const ES_FLAG = 'mx';

function pickEnglishFlag(): string {
  const r = Math.random();
  if (r < 0.35) return 'us';
  if (r < 0.95) return 'ca';
  return 'ie';
}

function flagUrl(code: string) {
  return `https://flagcdn.com/${code}.svg`;
}

/* ── Component ──────────────────────────────────────────────────────── */

export function LanguageToggle({
  esFlag = ES_FLAG,
  enFlag: enFlagProp,
}: {
  /** Flag shown while in Spanish mode (default: Mexico). */
  esFlag?: string;
  /** Flag shown while in English mode (default: random US/CA/IE). */
  enFlag?: string;
} = {}) {
  const { locale, setLocale } = useLocale();
  // Pick the English flag once per mount — stable for the session
  const [randomEnFlag] = useState(pickEnglishFlag);
  const enFlag = enFlagProp ?? randomEnFlag;

  const currentFlag = locale === 'es' ? esFlag : enFlag;
  const nextLocale: Locale = locale === 'es' ? 'en' : 'es';
  const label = locale === 'es' ? 'Switch to English' : 'Cambiar a español';

  const toggle = () => setLocale(nextLocale);

  // Pill dimensions — matches CountryFlag pill at small size
  const width = 22;
  const height = Math.round((width * 3) / 4); // 16-17px
  const r = Math.round(width * 0.35);
  const BORDER = 1;
  const innerW = width - BORDER * 2;
  const innerH = height - BORDER * 2;
  const innerR = Math.max(1, r - BORDER);

  const flagPath = (w: number, h: number, rr: number) =>
    `path('M 0 0 L ${w - rr} 0 A ${rr} ${rr} 0 0 1 ${w} ${rr} L ${w} ${h} L ${rr} ${h} A ${rr} ${rr} 0 0 1 0 ${h - rr} Z')`;

  const outerClip = flagPath(width, height, r);
  const innerClip = flagPath(innerW, innerH, innerR);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 transition-opacity hover:opacity-80 active:scale-95"
    >
      <span
        className="relative inline-block shrink-0 bg-ps-surface"
        style={{
          width,
          height,
          clipPath: outerClip,
          WebkitClipPath: outerClip,
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25))',
        }}
      >
        <span
          className="block bg-ps-surface"
          style={{
            position: 'absolute',
            top: BORDER,
            left: BORDER,
            width: innerW,
            height: innerH,
            clipPath: innerClip,
            WebkitClipPath: innerClip,
            overflow: 'hidden',
          }}
        >
          <img
            src={flagUrl(currentFlag)}
            alt=""
            width={innerW}
            height={innerH}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(0.88) brightness(0.96)' }}
          />
        </span>
      </span>
      <span className="text-caption font-bold uppercase tracking-wide text-ps-text-sec">
        {locale === 'es' ? 'ES' : 'EN'}
      </span>
    </button>
  );
}
