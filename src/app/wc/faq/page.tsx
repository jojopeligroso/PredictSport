"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /wc/faq — redirects to /wc/rules#faq.
 * FAQ content now lives inline on the rules page.
 */
export default function WCFAQPage() {
  const router = useRouter();

  useEffect(() => {
    window.location.replace("/wc/rules#faq");
  }, [router]);

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
      <p className="text-sm text-ps-text-sec">Redirecting to rules&hellip;</p>
    </div>
  );
}
