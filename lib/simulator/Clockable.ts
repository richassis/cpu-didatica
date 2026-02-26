/**
 * Clockable.ts
 *
 * Defines the pipeline steps and the interface that any simulator
 * data-layer object must implement to participate in the global clock.
 */

/**
 * The discrete pipeline steps the clock cycles through, in order.
 * Extend this union as the CPU model grows.
 */
export type ClockStep = "FETCH" | "DECODE" | "EXECUTE" | "WRITEBACK";

/** The fixed pipeline order used by the Clock. */
export const CLOCK_STEP_ORDER: readonly ClockStep[] = [
  "FETCH",
  "DECODE",
  "EXECUTE",
  "WRITEBACK",
] as const;

/**
 * Interface for simulator objects that react to clock ticks.
 *
 * Each implementing class declares which steps it participates in
 * and provides the callback invoked by the clock on those steps.
 */
export interface Clockable {
  /** The pipeline steps this object is active in. */
  readonly clockSteps: ClockStep[];

  /**
   * Called by the clock when a subscribed step fires.
   * Implement the behaviour for each relevant step in a switch/case.
   */
  onClockStep(step: ClockStep): void;
}

/**
 * Runtime type-guard: returns true if `obj` implements Clockable.
 */
export function isClockable(obj: unknown): obj is Clockable {
  if (typeof obj !== "object" || obj === null) return false;
  const c = obj as Record<string, unknown>;
  return (
    Array.isArray(c.clockSteps) &&
    typeof c.onClockStep === "function"
  );
}
