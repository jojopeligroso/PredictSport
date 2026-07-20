"use client";

import { useLocale } from "@/lib/i18n";

/**
 * Bi — bilingual leaf. Renders the Spanish or English variant depending on
 * the active locale. Lets server components pass both translations down
 * without becoming client components themselves.
 */
export function Bi({
  es,
  en,
}: {
  es: React.ReactNode;
  en: React.ReactNode;
}) {
  const { locale } = useLocale();
  return <>{locale === "es" ? es : en}</>;
}
