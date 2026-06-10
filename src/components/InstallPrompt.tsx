"use client";

import { useEffect, useState, useCallback } from "react";
import { isPwaInstalled, isIos } from "@/lib/push/client";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isPwaInstalled()) return;

    // Check if user previously dismissed
    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      const daysSince =
        (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < 14) return;
    }

    // Android/Chrome: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: show manual instructions
    if (isIos() && !isPwaInstalled()) {
      setShowIosBanner(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosBanner(false);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  }, []);

  if (dismissed || (!deferredPrompt && !showIosBanner)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-[440px] rounded-xl border border-ps-amber/30 bg-ps-bg p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-display text-sm font-extrabold text-ps-text">
            Install sportspredict.
          </p>
          <p className="mt-0.5 text-xs text-ps-text/70">
            {showIosBanner
              ? "Tap the share button, then \"Add to Home Screen\"."
              : "Add to your home screen for the full experience."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              className="rounded-lg bg-ps-amber px-3 py-1.5 text-xs font-semibold text-ps-ink"
            >
              Install
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="p-1 text-ps-text/50 hover:text-ps-text"
            aria-label="Dismiss"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
