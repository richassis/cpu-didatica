/**
 * useRevealState.ts
 *
 * Hook that returns the reveal status of a component during animation.
 * Used by widget components to apply dimming/highlighting based on
 * the display mask store's progressive reveal state.
 */

import type { CSSProperties } from "react";
import { useDisplayMaskStore } from "./displayMaskStore";

export type RevealStatus = "inactive" | "pending" | "revealed";

/**
 * Style applied to a widget based on its reveal status during animation.
 * - "pending":  dimmed + desaturated (showing pre-tick values, not yet reached).
 * - "revealed": full opacity with a brief cyan glow (just updated to post-tick).
 * - "inactive": no styling (normal live/edit display).
 */
export function revealStyle(status: RevealStatus): CSSProperties {
  switch (status) {
    case "pending":
      return {
        opacity: 0.35,
        filter: "saturate(0.5)",
        transition: "opacity 0.25s ease, filter 0.25s ease",
      };
    case "revealed":
      return {
        opacity: 1,
        filter: "drop-shadow(0 0 6px rgba(34, 211, 238, 0.45))",
        transition: "opacity 0.25s ease, filter 0.25s ease",
      };
    default:
      return {};
  }
}

/**
 * Returns the reveal status of a component during animation.
 * - "inactive": Display mask is not active (edit mode, no animation). Show live values normally.
 * - "pending":  Component has not been revealed yet. Show dimmed, old values.
 * - "revealed": Component has been revealed. Show bright, updated values.
 */
export function useRevealState(componentId: string): RevealStatus {
  const isActive = useDisplayMaskStore((s) => s.isActive);
  const isRevealed = useDisplayMaskStore((s) =>
    s.isActive ? s.revealedComponents.has(componentId) : true
  );

  if (!isActive) return "inactive";
  if (isRevealed) return "revealed";
  return "pending";
}
