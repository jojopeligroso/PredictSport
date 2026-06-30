"use client";

import { useT } from "@/lib/i18n";

/**
 * Static chat preview for non-members / unauthenticated viewers.
 * Shows fake example messages to showcase the social layer without
 * exposing any real user data.
 */
export function ChatPreview() {
  const t = useT();

  return (
    <div className="flex flex-1 flex-col">
      {/* Banner */}
      <div className="rounded-xl border border-ps-border bg-ps-surface px-4 py-3 text-center">
        <p className="text-sm font-semibold text-ps-text">
          {t("chat.preview_banner")}
        </p>
        <p className="mt-1 text-xs text-ps-text-ter">
          {t("chat.preview_sub")}
        </p>
      </div>

      {/* Fake conversation */}
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface p-4 opacity-70">
        <div className="space-y-3">
          {/* Message 1 — sender */}
          <div className="flex flex-col items-start">
            <span className="mb-0.5 ml-1 text-micro font-semibold text-ps-text-ter">
              Mystery Hawk
            </span>
            <div className="max-w-[75%] rounded-2xl rounded-tl-md bg-ps-chip px-3 py-2">
              <p className="text-sm text-ps-text">
                <span className="font-semibold text-ps-amber">
                  @Mystery Otter
                </span>{" "}
                are you still feeling confident after that performance? Don't
                see them getting to the final four
              </p>
            </div>
          </div>

          {/* Message 2 — reply */}
          <div className="flex flex-col items-start">
            <span className="mb-0.5 ml-1 text-micro font-semibold text-ps-text-ter">
              Mystery Otter
            </span>
            <div className="max-w-[75%] rounded-2xl rounded-tl-md bg-ps-chip px-3 py-2">
              <p className="text-sm text-ps-text">in Messi we trust</p>
            </div>
          </div>

          {/* Message 3 — laughing emoji reply */}
          <div className="flex flex-col items-start">
            <div className="max-w-[75%] rounded-2xl rounded-tl-md bg-ps-chip px-3 py-2">
              <p className="text-2xl leading-none">😂</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
