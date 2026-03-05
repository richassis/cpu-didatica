/**
 * Clockable.ts
 *
 * Defines the interface that any simulator component must implement
 * to participate in the global clock.
 *
 * Step/FSM/pipeline management is the CPU's responsibility, not the clock's.
 */

/**
 * Interface for simulator components that react to clock ticks.
 *
 * The Clock calls `onTick()` on every registered component each time
 * it advances. Components should perform their edge-triggered logic here.
 */
export interface Clockable {
  onTick(): void;
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
