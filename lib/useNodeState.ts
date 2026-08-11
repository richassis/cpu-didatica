/**
 * useNodeState.ts
 *
 * Turns the display-mask store into the one thing a widget needs to know:
 * what state to paint itself in this tick.
 *
 * The design system spends colour on state, never on identity, so this hook is
 * the only source of colour a node has. A node in `idle` is chromatically
 * neutral and still identifiable — its identity lives in its silhouette, its
 * corner glyph and its internal anatomy.
 */

import { useDisplayMaskStore } from "./displayMaskStore";

/**
 * What a node paints this tick.
 *
 * - "idle":    not participating in this tick, or no animation running. Neutral.
 * - "pending": participates in this tick but its wires have not arrived yet.
 * - "active":  executing this tick, value already latched. Accent + glow.
 * - "error":   unexpected HLT, overflow, bad address. Set explicitly by a widget.
 */
export type NodeState = "idle" | "pending" | "active" | "error";

/**
 * The state a node paints itself in.
 *
 * Note the `participates` term: without it every already-revealed component
 * would read as active, the whole canvas would light up on every tick, and the
 * accent would stop meaning anything. Only the components listed in this
 * tick's substep groups are allowed to glow.
 */
export function useNodeState(componentId: string): NodeState {
  const isActive = useDisplayMaskStore((s) => s.isActive);
  const participates = useDisplayMaskStore((s) =>
    s.substepGroups.some((g) => g.componentIds.includes(componentId))
  );
  const isRevealed = useDisplayMaskStore((s) => s.revealedComponents.has(componentId));

  if (!isActive) return "idle";
  if (!participates) return "idle";
  return isRevealed ? "active" : "pending";
}
