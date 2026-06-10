"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

export function Footer() {
  const t = useT();

  return (
    <footer className="mt-auto border-t border-ps-border py-5">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-[11px] font-extrabold lowercase tracking-tight text-ps-text-ter">
          sports<span className="text-ps-amber">predict.</span>
        </p>
        <p className="mt-1.5 font-serif text-[11px] italic text-ps-text-ter">
          {t("footer.tagline")}
        </p>
        <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-ps-text-ter">
          <Link
            href="/privacy"
            className="transition-colors hover:text-ps-text"
          >
            {t("footer.privacy")}
          </Link>
          <span aria-hidden="true" className="text-ps-border-strong">
            &middot;
          </span>
          <Link
            href="/terms"
            className="transition-colors hover:text-ps-text"
          >
            {t("footer.terms")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
