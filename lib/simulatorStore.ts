/**
 * simulatorStore.ts
 *
 * Non-persisted Zustand store that manages the *data layer* instances
 * (Register, Gpr, Ula) backing each UI widget on the canvas.
 *
 * When a component is added/removed on the layout store, the corresponding
 * data object must be created/removed here as well.
 *
 * This store holds plain class instances — it is NOT persisted to
 * localStorage because class instances don't survive JSON serialisation.
 */

import { create } from "zustand";
import { Register, Gpr, Ula, Clock, isClockable } from "@/lib/simulator";
import type { ClockStep } from "@/lib/simulator";

/** Union of every data-layer object type */
export type SimulatorObject = Register | Gpr | Ula;

interface SimulatorState {
  /** Map from ComponentInstance.id → data-layer object */
  objects: Map<string, SimulatorObject>;

  /**
   * Create the data-layer object that matches a widget type.
   * Called automatically when `addComponent` is invoked on the layout store.
   *
   * @param id    The ComponentInstance.id (same UUID)
   * @param type  The widget type string, e.g. "Register", "GprComponent", "UlaComponent"
   * @param label The human-readable label
   */
  createObject: (id: string, type: string, label: string) => void;

  /**
   * Remove the data-layer object for a given component id.
   * Called automatically when `removeComponent` is invoked on the layout store.
   */
  removeObject: (id: string) => void;

  /** Remove all data-layer objects (mirrors clearComponents). */
  clearObjects: () => void;

  /**
   * Type-safe accessor: get the data object cast to the expected class.
   * Returns undefined if not found or if the type doesn't match.
   */
  getRegister: (id: string) => Register | undefined;
  getGpr: (id: string) => Gpr | undefined;
  getUla: (id: string) => Ula | undefined;

  /**
   * Trigger a re-render for subscribers watching a specific id.
   * Call this after mutating a data object (e.g. ula.execute()) so that
   * React components using `useSimulatorStore` pick up the change.
   */
  touch: () => void;

  /** Monotonically increasing counter bumped by `touch` — forces selector updates. */
  revision: number;

  // ── Clock ──────────────────────────────────────────────────────

  /** The global clock instance. */
  clock: Clock;

  /** The step that was most recently executed (null before the first tick). */
  lastExecutedStep: ClockStep | null;

  /**
   * Advance the clock by one step, execute all Clockable objects
   * registered for that step, and bump the revision.
   */
  tickClock: () => void;

  /**
   * Run all remaining steps to complete the current cycle.
   */
  completeCycle: () => void;

  /**
   * Reset the clock to the beginning and reset all data objects.
   */
  resetClock: () => void;
}

export const useSimulatorStore = create<SimulatorState>()((set, get) => ({
  objects: new Map<string, SimulatorObject>(),
  revision: 0,

  createObject: (id, type, label) => {
    const map = new Map(get().objects);

    switch (type) {
      case "Register":
        map.set(id, new Register(id, label));
        break;
      case "GprComponent":
        map.set(id, new Gpr(id, label));
        break;
      case "UlaComponent":
        map.set(id, new Ula(id, label));
        break;
      // Types without a data-layer (LabelWidget, ValueDisplayWidget, MemoryComponent)
      // are silently ignored — they have no backing domain object (yet).
      default:
        break;
    }

    set({ objects: map });
  },

  removeObject: (id) => {
    const map = new Map(get().objects);
    map.delete(id);
    set({ objects: map });
  },

  clearObjects: () => {
    set({ objects: new Map() });
  },

  getRegister: (id) => {
    const obj = get().objects.get(id);
    return obj instanceof Register ? obj : undefined;
  },

  getGpr: (id) => {
    const obj = get().objects.get(id);
    return obj instanceof Gpr ? obj : undefined;
  },

  getUla: (id) => {
    const obj = get().objects.get(id);
    return obj instanceof Ula ? obj : undefined;
  },

  touch: () => {
    set((s) => ({ revision: s.revision + 1 }));
  },

  // ── Clock ──────────────────────────────────────────────────────

  clock: new Clock(),
  lastExecutedStep: null,

  tickClock: () => {
    const { clock, objects } = get();
    const step = clock.tick();

    // Execute all Clockable objects that subscribe to this step
    for (const obj of objects.values()) {
      if (isClockable(obj) && obj.clockSteps.includes(step)) {
        obj.onClockStep(step);
      }
    }

    // Bump revision so UI re-renders, and record the step
    set((s) => ({
      revision: s.revision + 1,
      lastExecutedStep: step,
    }));
  },

  completeCycle: () => {
    const { clock, objects } = get();
    const steps = clock.completeCycle();

    for (const step of steps) {
      for (const obj of objects.values()) {
        if (isClockable(obj) && obj.clockSteps.includes(step)) {
          obj.onClockStep(step);
        }
      }
    }

    set((s) => ({
      revision: s.revision + 1,
      lastExecutedStep: steps[steps.length - 1] ?? null,
    }));
  },

  resetClock: () => {
    const { clock, objects } = get();
    clock.reset();

    // Reset every data object
    for (const obj of objects.values()) {
      if ("reset" in obj && typeof obj.reset === "function") {
        obj.reset();
      }
    }

    set((s) => ({
      revision: s.revision + 1,
      lastExecutedStep: null,
    }));
  },
}));
