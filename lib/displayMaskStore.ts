/**
 * displayMaskStore.ts
 *
 * Zustand store that manages the progressive reveal of component values
 * during the animation tick system.
 *
 * Lifecycle:
 *  - init()             called by goToTick() to set up pre/post snapshots and start dimming
 *  - revealComponents() called by EnhancedBusOverlay when a substep's wires finish;
 *                       reveals the components those wires TARGET (dataflow order)
 *  - revealAll()        called on animation end or fast-scrub to finalize everything
 *  - deactivate()       called when exiting timeline or edit mode
 */

import { create } from "zustand";
import type { TickSnapshot, SubstepGroup } from "./executionStore";
import { applySnapshot } from "./executionStore";
import { useSimulatorStore } from "./simulatorStore";
import { Gpr, Memory, InstructionMemory } from "./simulator";

interface DisplayMaskState {
  /** Whether progressive reveal is active (only during timeline animation). */
  isActive: boolean;

  /** The pre-tick snapshot (starting point — what widgets show initially). */
  baseSnapshot: TickSnapshot | null;

  /** The post-tick snapshot (target — what widgets show after reveal). */
  targetSnapshot: TickSnapshot | null;

  /** Set of component IDs that have been "revealed" (show post-tick values). */
  revealedComponents: Set<string>;

  /** Ordered substep groups for current tick (used to gate active-state checks). */
  substepGroups: SubstepGroup[];

  /**
   * Component ids that changed state this tick but are NOT in any substep group
   * (they received a value rather than sent one). They light up too, staged the
   * same way — dim until their incoming wire lands, then bright.
   */
  activatedComponents: Set<string>;

  /**
   * Initialize for a new tick animation.
   * Applies the baseSnapshot to live simulator objects so widgets start showing old values.
   */
  init: (
    baseSnapshot: TickSnapshot,
    targetSnapshot: TickSnapshot,
    substepGroups: SubstepGroup[],
    activatedComponentIds?: string[],
  ) => void;

  /**
   * Reveal the given components by applying their post-tick values from
   * targetSnapshot to the live simulator objects.
   *
   * Called by the wire animation when a substep's wires complete, passing the
   * TARGET component IDs of those wires — a component latches its new value only
   * once the wires feeding into it have finished animating. (This is why PC,
   * which sends in substep 0 but receives from MuxPC in the last substep, only
   * updates at the end of the state.)
   */
  revealComponents: (componentIds: string[]) => void;

  /**
   * Reveal a single named input port early, decoupled from the owning
   * component's own (possibly later) reveal via `revealComponents`.
   *
   * Built for a MUX's `sel` line: it is driven by a CPU control-signal wire,
   * which lands in the earlier "CPU phase" of the animation, while the data
   * flowing *through* the MUX lands in a later data substep. Without this,
   * the MUX's selection indicator would wait for that later substep — by
   * which point the animation has already drawn data flowing through it
   * using the stale, pre-tick selection. Does not touch `revealedComponents`,
   * so the component's overall dim/bright styling still follows its normal
   * full reveal.
   */
  revealInputPort: (componentId: string, portName: string) => void;

  /**
   * Force-reveal all remaining components.
   * Called when: skipping animation, fast scrubbing, animation ends.
   */
  revealAll: () => void;

  /** Deactivate progressive reveal (exit timeline, edit mode, etc.) */
  deactivate: () => void;

  /**
   * Check if a component has been revealed.
   * Widgets use this to decide styling (dimmed vs bright).
   */
  isRevealed: (componentId: string) => boolean;

  /**
   * Check if a component is active in the current tick
   * (i.e., is in any substep group for this state).
   */
  isActiveInCurrentTick: (componentId: string) => boolean;
}

/**
 * Apply the post-tick port values + bulk data of a single component to the
 * live simulator objects.
 *
 * Output ports use `setWithoutPropagate` so revealing one component (e.g. IR
 * in FETCH) does not cascade through wires into not-yet-revealed components
 * (e.g. Decoder) — each component is revealed independently from its own
 * snapshot slice.
 *
 * Input ports are restored too, via `InputPort.set()` — the same "bypass
 * wiring" entry point components use internally. Without this, a widget that
 * displays one of its OWN inputs (the ULA's operands, the GPR's read/write
 * addresses, a MUX's select line) would show the post-tick value the instant
 * the tick computes, since input ports are never touched by wire propagation
 * during a reveal (propagation is deliberately suppressed above) and nothing
 * else was resetting or advancing them mid-animation. Restoring them here
 * puts a component's inputs on the same reveal timing as its outputs.
 *
 * Setting an input directly can re-trigger that port's own `onChange` (e.g.
 * the GPR recomputing its read-data outputs from a restored read address) —
 * harmless here because this same call also restores every output from the
 * snapshot afterward, so the authoritative post-tick value always wins.
 */
function applyComponentTargetState(componentId: string, targetSnapshot: TickSnapshot): boolean {
  const targetState = targetSnapshot.state.get(componentId);
  if (!targetState) return false;

  const obj = useSimulatorStore.getState().objects.get(componentId);
  if (!obj) return false;

  // Restore bulk data (GPR registers, memory cells).
  if (obj instanceof Gpr && targetState.registers) {
    targetState.registers.forEach((v, i) => obj.write(i, v));
  }
  if ((obj instanceof Memory || obj instanceof InstructionMemory) && targetState.cells) {
    obj.load(targetState.cells);
  }

  if ("getPorts" in obj && typeof (obj as { getPorts: () => unknown }).getPorts === "function") {
    const portMap = (obj as {
      getPorts: () => Record<string, {
        direction: string;
        set?: (v: number) => void;
        setWithoutPropagate?: (v: number) => void;
      }>;
    }).getPorts();
    for (const [key, value] of Object.entries(targetState.ports)) {
      const port = portMap[key];
      if (!port || typeof value !== "number") continue;
      if (port.direction === "output") {
        if (port.setWithoutPropagate) {
          port.setWithoutPropagate(value);
        } else {
          port.set?.(value);
        }
      } else {
        port.set?.(value);
      }
    }
  }

  return true;
}

export const useDisplayMaskStore = create<DisplayMaskState>()((set, get) => ({
  isActive: false,
  baseSnapshot: null,
  targetSnapshot: null,
  revealedComponents: new Set(),
  substepGroups: [],
  activatedComponents: new Set(),

  init: (baseSnapshot, targetSnapshot, substepGroups, activatedComponentIds = []) => {
    // Apply the BASE snapshot to live simulator objects so all widgets/wires
    // initially show pre-tick (old) values.
    applySnapshot(baseSnapshot);

    // Restore CPU internal state from TARGET so FSM labels are correct, and
    // immediately reveal the CPU's post-tick output ports — control signals are
    // not animated, they just take their new values at the start of the state.
    const revealed = new Set<string>();
    const cpu = useSimulatorStore.getState().getPrimaryCpu();
    if (cpu) {
      cpu.restoreInternalState(targetSnapshot.cpuInternalState);
      if (applyComponentTargetState(cpu.id, targetSnapshot)) {
        revealed.add(cpu.id);
      }
    }

    // A component already in a substep group is staged by its own wire reveal;
    // only components NOT in one need the separate "activated" (received a
    // value) treatment.
    const groupedIds = new Set(substepGroups.flatMap((g) => g.componentIds));
    const activatedComponents = new Set(
      activatedComponentIds.filter((id) => !groupedIds.has(id))
    );

    set({
      isActive: true,
      baseSnapshot,
      targetSnapshot,
      substepGroups,
      activatedComponents,
      revealedComponents: revealed,
    });
  },

  revealComponents: (componentIds) => {
    const { targetSnapshot, revealedComponents, isActive } = get();
    if (!isActive || !targetSnapshot) return;

    const newRevealed = new Set(revealedComponents);
    let changed = false;

    for (const componentId of componentIds) {
      if (applyComponentTargetState(componentId, targetSnapshot)) {
        newRevealed.add(componentId);
        changed = true;
      }
    }

    if (!changed) return;

    set({ revealedComponents: newRevealed });

    // Bump revision so widgets + downstream wire values re-render with the
    // revealed values. (Does NOT restart the wire animation, which keys on
    // `animationCycle`.)
    useSimulatorStore.setState((s) => ({ revision: s.revision + 1 }));
  },

  revealInputPort: (componentId, portName) => {
    const { targetSnapshot, isActive } = get();
    if (!isActive || !targetSnapshot) return;

    const targetState = targetSnapshot.state.get(componentId);
    if (!targetState) return;
    const value = targetState.ports[portName];
    if (typeof value !== "number") return;

    const obj = useSimulatorStore.getState().objects.get(componentId);
    if (!obj || !("getPorts" in obj)) return;
    const portMap = (obj as {
      getPorts: () => Record<string, { direction: string; set?: (v: number) => void }>;
    }).getPorts();
    const port = portMap[portName];
    if (!port || port.direction !== "input") return;

    port.set?.(value);
    useSimulatorStore.setState((s) => ({ revision: s.revision + 1 }));
  },

  revealAll: () => {
    const { targetSnapshot, isActive } = get();
    if (!isActive || !targetSnapshot) return;

    // Apply the full post-tick snapshot.
    applySnapshot(targetSnapshot);

    set({
      revealedComponents: new Set(Array.from(targetSnapshot.state.keys())),
    });
  },

  deactivate: () => {
    set({
      isActive: false,
      baseSnapshot: null,
      targetSnapshot: null,
      revealedComponents: new Set(),
      substepGroups: [],
      activatedComponents: new Set(),
    });
  },

  isRevealed: (componentId) => {
    const { isActive, revealedComponents } = get();
    if (!isActive) return true;
    return revealedComponents.has(componentId);
  },

  isActiveInCurrentTick: (componentId) => {
    const { substepGroups } = get();
    return substepGroups.some((g) => g.componentIds.includes(componentId));
  },
}));
