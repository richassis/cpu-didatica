/**
 * Clockable.ts
 *
 * Defines the interface that any simulator component must implement
 * to be ticked by the CPU.
 */

/**
 * Interface for simulator components that react to clock ticks.
 *
 * The CPU ticks its registered components in two phases:
 * - evaluate(): combinational phase
 * - commit(): sequential phase
 *
 * `onTick()` is a single-call tick outside that loop: the editor's "Tick Now"
 * and the no-CPU fallback call it, and the CPU falls back to it for a
 * component that implements neither phase.
 */
export interface Clockable {
  onTick(): void;
  evaluate?: () => void;
  commit?: () => void;
}

/**
 * Runtime type-guard: returns true if `obj` implements Clockable.
 */
export function isClockable(obj: unknown): obj is Clockable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Clockable).onTick === "function"
  );
}
