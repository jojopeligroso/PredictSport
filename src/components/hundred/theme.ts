import type React from "react";

/**
 * /hundred surface theme — single accent via the same CSS custom-property
 * mechanism as the ligas surface (`--liga-accent` / `--liga-accent-deep`,
 * consumed by the `liga` / `liga-deep` Tailwind tokens in globals.css).
 * The Hundred brand magenta family.
 */
export const HUNDRED_ACCENT = "#e6007e";
export const HUNDRED_ACCENT_DEEP = "#a8005c";

export function hundredVars(): React.CSSProperties {
  return {
    "--liga-accent": HUNDRED_ACCENT,
    "--liga-accent-deep": HUNDRED_ACCENT_DEEP,
  } as React.CSSProperties;
}
