/**
 * simulatorStore.ts
 *
 * Non-persisted Zustand store that manages the *data layer* instances
 * (Register, Gpr, Ula, CPU, Decoder) backing each UI widget on the canvas.
 *
 * When a component is added/removed on the layout store, the corresponding
 * data object must be created/removed here as well.
 *
 * This store holds plain class instances — it is NOT persisted to
 * localStorage because class instances don't survive JSON serialisation.
 */

import { create } from "zustand";
import { Register, Gpr, Ula, Adder, Mux, Memory, InstructionMemory, CPU, Decoder, Bus, isClockable, CpuState, ALL_CPU_STATES } from "@/lib/simulator";
import type { Connectable, WireDescriptor } from "@/lib/simulator";
import type { ComponentState } from "@/lib/store";
// Lazy import via getter to avoid circular initialisation (store.ts imports simulatorStore).
const getLayoutStore = () =>
  (require("@/lib/store") as typeof import("@/lib/store")).useLayoutStore;

/** Union of every data-layer object type */
export type SimulatorObject = Register | Gpr | Ula | Adder | Mux | Memory | InstructionMemory | CPU | Decoder;

/** Type guard to check if an object is Connectable */
function isConnectable(obj: unknown): obj is Connectable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "getPorts" in obj &&
    typeof (obj as Connectable).getPorts === "function"
  );
}

function inferComponentType(obj: SimulatorObject): string {
  if (obj instanceof Register) return "Register";
  if (obj instanceof Gpr) return "GprComponent";
  if (obj instanceof Ula) return "UlaComponent";
  if (obj instanceof Adder) return "AdderComponent";
  if (obj instanceof Mux) return "MuxComponent";
  if (obj instanceof Memory) return "MemoryComponent";
  if (obj instanceof InstructionMemory) return "InstructionMemoryComponent";
  if (obj instanceof Decoder) return "DecoderComponent";
  if (obj instanceof CPU) return "CpuComponent";
  return "Unknown";
}

interface SimulatorState {
  /** Map from ComponentInstance.id → data-layer object */
  objects: Map<string, SimulatorObject>;

  /** The signal bus for component interconnection */
  bus: Bus;

  /**
   * Create the data-layer object that matches a widget type.
   * Called automatically when `addComponent` is invoked on the layout store.
   *
   * @param id    The ComponentInstance.id (same UUID)
   * @param type  The widget type string, e.g. "Register", "GprComponent", "UlaComponent"
   * @param label The human-readable label
   */
  createObject: (id: string, type: string, label: string, meta?: Record<string, unknown>) => void;

  /**
   * Remove the data-layer object for a given component id.
   * Called automatically when `removeComponent` is invoked on the layout store.
   */
  removeObject: (id: string) => void;

  /**
   * Recreate an object with new meta (e.g., when Mux numInputs changes).
   * This removes the old object and creates a new one with updated config.
   */
  recreateObject: (id: string, type: string, label: string, meta?: Record<string, unknown>) => void;

  /** Remove all data-layer objects (mirrors clearComponents). */
  clearObjects: () => void;

  /**
   * Type-safe accessor: get the data object cast to the expected class.
   * Returns undefined if not found or if the type doesn't match.
   */
  getRegister: (id: string) => Register | undefined;
  getGpr: (id: string) => Gpr | undefined;
  getUla: (id: string) => Ula | undefined;
  getAdder: (id: string) => Adder | undefined;
  getMux: (id: string) => Mux | undefined;
  getMemory: (id: string) => Memory | undefined;
  getInstructionMemory: (id: string) => InstructionMemory | undefined;
  getCpu: (id: string) => CPU | undefined;
  getDecoder: (id: string) => Decoder | undefined;

  /** Toggle or set the paused state of a CPU instance. */
  pauseCpu: (id: string, paused: boolean) => void;

  /** Reset a specific CPU to RESET state. */
  resetCpu: (id: string) => void;

  /**
   * Trigger a re-render for subscribers watching a specific id.
   * Call this after mutating a data object (e.g. ula.execute()) so that
   * React components using `useSimulatorStore` pick up the change.
   */
  touch: () => void;

  /** Monotonically increasing counter bumped by `touch` — forces selector updates. */
  revision: number;

  // ── Clock / CPU-based ticking ──────────────────────────────────

  /**
   * Get the primary CPU instance (first CpuComponent found).
   * Returns null if no CPU exists.
   */
  getPrimaryCpu: () => CPU | null;

  /**
   * Advance the simulation by one tick via the CPU.
   * The CPU controls which components tick based on its current state.
   */
  tickClock: () => void;

  /**
   * Reset the simulation (CPU and all data objects).
   */
  resetClock: () => void;

  /**
   * Tick a single component by ID, bypassing the CPU state system.
   * Useful for manual testing.
   */
  tickSingleComponent: (id: string) => void;

  /**
   * Get the tick steps configured for a component.
   */
  getComponentTickSteps: (id: string) => CpuState[] | undefined;

  /**
   * Set the tick steps for a component.
   */
  setComponentTickSteps: (id: string, steps: CpuState[]) => void;

  /**
   * Get animation substep order map by CPU state for a component.
   */
  getComponentTickOrderByState: (id: string) => Partial<Record<CpuState, number>> | undefined;

  /**
   * Set animation substep order map by CPU state for a component.
   */
  setComponentTickOrderByState: (id: string, orderByState: Partial<Record<CpuState, number>>) => void;

  // ── Wire Management ────────────────────────────────────────────

  /**
   * Create a wire connection between two component ports.
   * Returns the wire ID if successful, null if failed.
   */
  createWire: (
    sourceId: string,
    sourcePort: string,
    targetId: string,
    targetPort: string,
    options?: {
      id?: string;
      label?: string;
      visible?: boolean;
      nodes?: Array<{ x: number; y: number }>;
      color?: string;
    }
  ) => string | null;

  /**
   * Remove a wire by its ID.
   */
  removeWire: (wireId: string) => void;

  /**
   * Get all wire descriptors (for persistence/UI).
   */
  getWires: () => WireDescriptor[];

  /**
   * Restore wires from descriptors (e.g., after loading a saved state).
   */
  restoreWires: (descriptors: WireDescriptor[]) => void;

  /**
   * Serialise runtime values of all data-layer objects into plain-JSON ComponentState records.
   * Returns a Map from component id → ComponentState.
   */
  serializeObjects: () => Map<string, ComponentState>;

  /**
   * Apply a previously-serialised state map back to live data-layer objects.
   * Used on page reload and when loading a project file.
   */
  applyObjectStates: (stateMap: Map<string, ComponentState>) => void;

  /**
   * Directly write a word into a Memory cell, bypassing tick logic.
   * Immediately persists updated state.
   */
  pokeMemory: (id: string, addr: number, value: number) => void;

  /**
   * Directly write a value into a GPR register, bypassing tick logic.
   * Immediately persists updated state.
   */
  pokeGprRegister: (id: string, index: number, value: number) => void;
}

export const useSimulatorStore = create<SimulatorState>()((set, get) => ({
  objects: new Map<string, SimulatorObject>(),
  bus: new Bus(),
  revision: 0,

  createObject: (id, type, label, meta) => {
    const { objects, bus } = get();
    const map = new Map(objects);
    let newObj: SimulatorObject | null = null;

    switch (type) {
      case "Register": {
        const bitWidth = typeof meta?.bitWidth === "number" ? meta.bitWidth : 16;
        newObj = new Register(id, label, bitWidth);
        break;
      }
      case "GprComponent":
        newObj = new Gpr(id, label);
        break;
      case "UlaComponent":
        newObj = new Ula(id, label);
        break;
      case "AdderComponent":
        newObj = new Adder(id, label);
        break;
      case "MuxComponent": {
        const bitWidth  = typeof meta?.bitWidth  === "number" ? meta.bitWidth  : 16;
        const numInputs = (meta?.numInputs === 3 ? 3 : 2) as 2 | 3;
        newObj = new Mux(id, label, bitWidth, numInputs);
        break;
      }
      case "CpuComponent":
        newObj = new CPU(id, label);
        break;
      case "DecoderComponent":
        newObj = new Decoder(id, label);
        break;
      case "MemoryComponent": {
        const wordCount = typeof meta?.wordCount === "number" ? meta.wordCount : 256;
        const bitWidth  = typeof meta?.bitWidth  === "number" ? meta.bitWidth  : 16;
        newObj = new Memory(id, label, wordCount, bitWidth);
        break;
      }
      case "InstructionMemoryComponent": {
        const wordCount = typeof meta?.wordCount === "number" ? meta.wordCount : 256;
        const bitWidth  = typeof meta?.bitWidth  === "number" ? meta.bitWidth  : 16;
        newObj = new InstructionMemory(id, label, wordCount, bitWidth);
        break;
      }
      // Unknown types are silently ignored.
      default:
        break;
    }

    if (newObj) {
      map.set(id, newObj);
      // Register with the bus if it's Connectable
      if (isConnectable(newObj)) {
        bus.registerComponent(newObj);
      }

      if (newObj instanceof CPU) {
        // If CPU is created after other components, register existing clockables now.
        const layoutById = new Map(getLayoutStore().getState().components.map((c) => [c.id, c]));

        for (const [existingId, existingObj] of map.entries()) {
          if (existingObj instanceof CPU) continue;
          if (!isClockable(existingObj)) continue;

          const inferredType = inferComponentType(existingObj);
          const customSteps = layoutById.get(existingId)?.tickSteps as CpuState[] | undefined;
          const customOrder = layoutById.get(existingId)?.tickOrderByState as Partial<Record<CpuState, number>> | undefined;
          newObj.registerComponent(existingId, inferredType, existingObj, customSteps, customOrder);
        }
      }
      
      // Register with CPU runtime and animation mask metadata (if not the CPU itself)
      if (isClockable(newObj) && type !== "CpuComponent") {
        // Find the primary CPU and register this component
        for (const obj of map.values()) {
          if (obj instanceof CPU) {
            const layoutComponent = getLayoutStore().getState().components.find((c) => c.id === id);
            const customSteps = layoutComponent?.tickSteps as CpuState[] | undefined;
            const customOrder = layoutComponent?.tickOrderByState as Partial<Record<CpuState, number>> | undefined;
            obj.registerComponent(id, type, newObj, customSteps, customOrder);
            break;
          }
        }
      }
    }

    set({ objects: map });
  },

  removeObject: (id) => {
    const { objects, bus } = get();
    const map = new Map(objects);
    
    // Unregister from CPU
    for (const obj of objects.values()) {
      if (obj instanceof CPU) {
        obj.unregisterComponent(id);
        break;
      }
    }
    
    // Unregister from bus before removing
    bus.unregisterComponent(id);
    map.delete(id);
    
    set({ objects: map });
  },

  recreateObject: (id, type, label, meta) => {
    const { removeObject, createObject } = get();
    // Remove old object (unregisters from bus and CPU)
    removeObject(id);
    // Create new object with updated meta
    createObject(id, type, label, meta);
  },

  clearObjects: () => {
    const { bus } = get();
    // Clear all wires and components from bus
    for (const wireId of bus.getWireIds()) {
      bus.removeWire(wireId);
    }
    set({ objects: new Map(), bus: new Bus() });
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

  getAdder: (id) => {
    const obj = get().objects.get(id);
    return obj instanceof Adder ? obj : undefined;
  },

  getMux: (id) => {
    const obj = get().objects.get(id);
    return obj instanceof Mux ? obj : undefined;
  },

  getMemory: (id) => {
    const obj = get().objects.get(id);
    return obj instanceof Memory ? obj : undefined;
  },

  getInstructionMemory: (id) => {
    const obj = get().objects.get(id);
    return obj instanceof InstructionMemory ? obj : undefined;
  },

  getCpu: (id) => {
    const obj = get().objects.get(id);
    return obj instanceof CPU ? obj : undefined;
  },

  getDecoder: (id) => {
    const obj = get().objects.get(id);
    return obj instanceof Decoder ? obj : undefined;
  },

  pauseCpu: (id, paused) => {
    const obj = get().objects.get(id);
    if (obj instanceof CPU) {
      obj.setPaused(paused);
      set((s) => ({ revision: s.revision + 1 }));
    }
  },

  resetCpu: (id) => {
    const obj = get().objects.get(id);
    if (obj instanceof CPU) {
      obj.reset();
      set((s) => ({ revision: s.revision + 1 }));
      getLayoutStore().getState().saveState();
    }
  },

  touch: () => {
    set((s) => ({ revision: s.revision + 1 }));
  },

  // ── Clock / CPU-based ticking ──────────────────────────────────

  getPrimaryCpu: () => {
    const { objects } = get();
    for (const obj of objects.values()) {
      if (obj instanceof CPU) {
        return obj;
      }
    }
    return null;
  },

  tickClock: () => {
    const { objects } = get();
    
    // Find the primary CPU
    let cpu: CPU | null = null;
    for (const obj of objects.values()) {
      if (obj instanceof CPU) {
        cpu = obj;
        break;
      }
    }

    if (cpu) {
      // CPU-controlled ticking: CPU decides which components tick
      cpu.tick();
    } else {
      // Fallback: tick all Clockable objects if no CPU exists
      for (const obj of objects.values()) {
        if (isClockable(obj)) {
          obj.onTick();
        }
      }
    }

    // Bump revision so UI re-renders
    set((s) => ({ revision: s.revision + 1 }));
    // Persist updated port/register/memory values
    getLayoutStore().getState().saveState();
  },

  resetClock: () => {
    const { objects } = get();

    // Reset every data object
    for (const obj of objects.values()) {
      if ("reset" in obj && typeof obj.reset === "function") {
        (obj as { reset: () => void }).reset();
      }
    }

    set((s) => ({ revision: s.revision + 1 }));
    // Persist cleared values
    getLayoutStore().getState().saveState();
  },

  tickSingleComponent: (id) => {
    const { objects } = get();
    const obj = objects.get(id);
    if (obj && isClockable(obj)) {
      obj.onTick();
      set((s) => ({ revision: s.revision + 1 }));
      getLayoutStore().getState().saveState();
    }
  },

  getComponentTickSteps: (id) => {
    const { objects } = get();
    for (const obj of objects.values()) {
      if (obj instanceof CPU) {
        return obj.getComponentTickSteps(id);
      }
    }
    return undefined;
  },

  setComponentTickSteps: (id, steps) => {
    const { objects } = get();
    for (const obj of objects.values()) {
      if (obj instanceof CPU) {
        obj.setComponentTickSteps(id, steps);
        set((s) => ({ revision: s.revision + 1 }));
        break;
      }
    }
  },

  getComponentTickOrderByState: (id) => {
    const { objects } = get();
    for (const obj of objects.values()) {
      if (obj instanceof CPU) {
        return obj.getComponentTickOrderByState(id);
      }
    }
    return undefined;
  },

  setComponentTickOrderByState: (id, orderByState) => {
    const { objects } = get();
    for (const obj of objects.values()) {
      if (obj instanceof CPU) {
        obj.setComponentTickOrderByState(id, orderByState);
        set((s) => ({ revision: s.revision + 1 }));
        break;
      }
    }
  },

  // ── Wire Management ────────────────────────────────────────────

  createWire: (sourceId, sourcePort, targetId, targetPort, options) => {
    const { bus } = get();
    const wire = bus.createWire(sourceId, sourcePort, targetId, targetPort, options);
    if (wire) {
      set((s) => ({ revision: s.revision + 1 }));
      // Persist wire list alongside components in the layout store.
      getLayoutStore().getState().saveWires();
      getLayoutStore().getState().saveState();
      return wire.id;
    }
    return null;
  },

  removeWire: (wireId) => {
    const { bus } = get();
    bus.removeWire(wireId);
    set((s) => ({ revision: s.revision + 1 }));
    // Keep persisted snapshot in sync.
    getLayoutStore().getState().saveWires();
    getLayoutStore().getState().saveState();
  },

  getWires: () => {
    const { bus } = get();
    return bus.serialize();
  },

  restoreWires: (descriptors) => {
    const { bus, objects } = get();
    
    // Ensure all components are registered first
    for (const obj of objects.values()) {
      if (isConnectable(obj) && !bus.getComponent(obj.id)) {
        bus.registerComponent(obj);
      }
    }
    
    // Restore wires — skip invalid descriptors so a single bad entry
    // doesn't abort restoring all the remaining valid wires.
    bus.deserialize(descriptors, /* skipInvalid */ true);
    set((s) => ({ revision: s.revision + 1 }));
  },

  serializeObjects: () => {
    const { objects } = get();
    const result = new Map<string, ComponentState>();
    for (const [id, obj] of objects) {
      const ports: Record<string, number> = {};
      // Capture all port values by their map key
      if (isConnectable(obj)) {
        for (const [key, port] of Object.entries(obj.getPorts())) {
          ports[key] = port.value as number;
        }
      }
      const entry: ComponentState = { ports };
      // GPR: also save the register bank
      if (obj instanceof Gpr) {
        entry.registers = obj.snapshot().map((r) => r.value);
      }
      // Memory and InstructionMemory: also save the cells array
      if (obj instanceof Memory || obj instanceof InstructionMemory) {
        entry.cells = obj.dump();
      }
      result.set(id, entry);
    }
    return result;
  },

  applyObjectStates: (stateMap) => {
    const { objects } = get();
    for (const [id, state] of stateMap) {
      const obj = objects.get(id);
      if (!obj) continue;
      // Restore bulk data first (so port reads reflect restored values)
      if (obj instanceof Gpr && state.registers) {
        state.registers.forEach((v, i) => obj.write(i, v));
      }
      if ((obj instanceof Memory || obj instanceof InstructionMemory) && state.cells) {
        obj.load(state.cells);
      }
      // Restore port values (output ports only — inputs are driven by wires)
      if (isConnectable(obj)) {
        const portMap = obj.getPorts();
        for (const [key, value] of Object.entries(state.ports)) {
          const port = portMap[key];
          // Only set output ports directly; input ports get their value from wires
          if (port && port.direction === "output" && typeof value === "number") {
            (port as { set?: (v: number) => void }).set?.(value);
          }
        }
      }
    }
    set((s) => ({ revision: s.revision + 1 }));
  },

  pokeMemory: (id, addr, value) => {
    const obj = get().objects.get(id);
    if (obj instanceof Memory) {
      obj.poke(addr, value);
      set((s) => ({ revision: s.revision + 1 }));
      getLayoutStore().getState().saveState();
    }
  },

  pokeGprRegister: (id, index, value) => {
    const obj = get().objects.get(id);
    if (obj instanceof Gpr) {
      obj.write(index, value);
      set((s) => ({ revision: s.revision + 1 }));
      getLayoutStore().getState().saveState();
    }
  },
}));
