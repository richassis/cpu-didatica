/**
 * textSize.ts
 *
 * "Tamanho do texto": a factor on the root font size, set as
 * `<html data-text-size>` (see `--fs` in globals.css).
 *
 * Kept free of zustand and React so `app/layout.tsx` can import it: its inline
 * script writes the attribute before first paint, and has to agree with the
 * store's default or the page changes size once the store loads.
 */

export type TextSize = "small" | "medium" | "large";

export const DEFAULT_TEXT_SIZE: TextSize = "small";

/**
 * The canvas follows the text size at less than half the rate: `--fs-cv` in
 * globals.css, for anything that has to be sized in script.
 */
export const CANVAS_TEXT_SCALE: Record<TextSize, number> = { small: 0.95, medium: 1, large: 1.06 };

/** Reflect the text size onto <html>, where every rem picks it up. */
export function applyTextSizeAttribute(size: TextSize): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.textSize = size;
}
