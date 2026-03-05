import { Clockable } from "./Clockable";

/**
 * Clock.ts
 *
 * A global clock whose only responsibilities are:
 *  1. Counting ticks.
 *  2. Notifying every registered {@link Clockable} component on each tick.
 *
 * Step sequencing, FSM management, and pipeline control are handled
 * by the CPU, not here.
 */
export class Clock {
  /** All components that will receive `onTick()` on every tick. */
  private _components: Clockable[] = [];

  /** Total number of ticks since creation or last reset. */
  private _totalTicks = 0;

  // ── Component registration ───────────────────────────────────

  /**
   * Register a component to receive clock ticks.
   * Silently ignores duplicates.
   */
  register(component: Clockable): void {
    if (!this._components.includes(component)) {
      this._components.push(component);
    }
  }

  /** Register multiple components at once. */
  registerAll(components: Clockable[]): void {
    for (const c of components) this.register(c);
  }

  /** Unregister a previously registered component. */
  unregister(component: Clockable): void {
    this._components = this._components.filter(c => c !== component);
  }

  // ── Accessors ────────────────────────────────────────────────

  /** Total number of ticks executed since creation or last reset. */
  get totalTicks(): number {
    return this._totalTicks;
  }

  /** Read-only snapshot of the registered components list. */
  get components(): readonly Clockable[] {
    return this._components;
  }

  // ── Control ──────────────────────────────────────────────────

  /**
   * Advance the clock by one tick.
   * Every registered component has its `onTick()` called in registration order.
   */
  tick(): void {
    this._totalTicks++;
    for (const component of this._components) {
      component.onTick();
    }
  }

  /** Advance the clock by `n` ticks. */
  tickN(n: number): void {
    for (let i = 0; i < n; i++) this.tick();
  }

  /** Reset the tick counter and clear all registered components. */
  reset(): void {
    this._totalTicks = 0;
    this._components = [];
  }
}
