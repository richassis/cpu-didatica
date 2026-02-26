import { ClockStep, CLOCK_STEP_ORDER } from "./Clockable";

/**
 * Clock.ts
 *
 * A global clock that advances through pipeline steps in order.
 * Does NOT hold references to simulator objects — the store is
 * responsible for iterating objects and calling onClockStep().
 *
 * The Clock is a plain class (not a store) owned by the simulatorStore.
 */
export class Clock {
  /** The ordered list of steps in one cycle. */
  readonly stepOrder: readonly ClockStep[];

  /** Index into stepOrder pointing at the *next* step to execute. */
  private _index: number;

  /** Total number of individual steps executed since creation / last reset. */
  private _totalTicks: number;

  /** Total number of full cycles completed. */
  private _totalCycles: number;

  constructor(stepOrder: readonly ClockStep[] = CLOCK_STEP_ORDER) {
    this.stepOrder = stepOrder;
    this._index = 0;
    this._totalTicks = 0;
    this._totalCycles = 0;
  }

  // ── Accessors ────────────────────────────────────────────────

  /** The step that will execute on the next call to `tick()`. */
  get currentStep(): ClockStep {
    return this.stepOrder[this._index];
  }

  /** Zero-based index of the current step within the cycle. */
  get currentIndex(): number {
    return this._index;
  }

  /** How many individual steps have been executed. */
  get totalTicks(): number {
    return this._totalTicks;
  }

  /** How many full cycles have completed. */
  get totalCycles(): number {
    return this._totalCycles;
  }

  /** Number of steps per cycle. */
  get stepsPerCycle(): number {
    return this.stepOrder.length;
  }

  // ── Control ──────────────────────────────────────────────────

  /**
   * Advance by one step.
   * Returns the step that was just executed (so the caller knows
   * which step to broadcast to Clockable objects).
   */
  tick(): ClockStep {
    const step = this.stepOrder[this._index];
    this._totalTicks++;
    this._index++;

    if (this._index >= this.stepOrder.length) {
      this._index = 0;
      this._totalCycles++;
    }

    return step;
  }

  /**
   * Execute all remaining steps in the current cycle.
   * Returns the list of steps that were executed.
   */
  completeCycle(): ClockStep[] {
    const executed: ClockStep[] = [];
    const startCycle = this._totalCycles;
    do {
      executed.push(this.tick());
    } while (this._totalCycles === startCycle);
    return executed;
  }

  /** Reset the clock to the beginning (step 0, counters zeroed). */
  reset(): void {
    this._index = 0;
    this._totalTicks = 0;
    this._totalCycles = 0;
  }
}
