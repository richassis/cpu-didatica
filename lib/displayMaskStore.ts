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
import { Gpr, Memory, InstructionMemory, Ula } from "./simulator";
import { CpuState } from "./simulator/CpuState";

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
   * Components whose substep has started — they are acting (sending) even if no
   * wire has delivered a value to them. Drives the node glow only; it is NOT a
   * reveal, so `revealedComponents` keeps meaning "the new value is latched".
   */
  sendingComponents: Set<string>;

  /**
   * A substep started: light every component at that order or an earlier one.
   * Earlier orders are included so a component with no visible wire in its own
   * step still lights no later than the steps after it.
   */
  markSending: (order: number) => void;

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
   * Reveal a single named output port early. Built for a MUX's result: it is
   * combinational, so once its `sel` has landed its output is the post-tick
   * value — the wire leaving it must animate that value, not the stale one
   * the pre-tick snapshot left there until the MUX's own (later) reveal.
   * Sequential components must NOT use this: they hold their old output
   * until their incoming wire delivers.
   */
  revealOutputPort: (componentId: string, portName: string) => void;

  /**
   * Reveal every output port of a purely combinational component (MUX, ULA,
   * adder, incrementer, decoder) — same reasoning as `revealOutputPort`, for a
   * component whose several outputs all settle in the evaluate phase.
   */
  revealOutputPorts: (componentId: string) => void;

  /**
   * Move the ULA's own flags (shown inside the ULA) to their post-tick value.
   * Called when the ULA computes — its operands have landed or it starts
   * sending its result — never at the start of the tick.
   */
  revealUlaFlags: () => void;

  /**
   * Move the control unit's flags (shown in the UC) to their post-tick value.
   * Called when the flags reach the UC: the ULA's flags wire lands on it, or —
   * for LDA/LDAI — the loaded value lands in the GPR that produces them.
   */
  revealControlFlags: () => void;

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
  sendingComponents: new Set(),

  init: (baseSnapshot, targetSnapshot, substepGroups, activatedComponentIds = []) => {
    // Apply the BASE snapshot to live simulator objects so all widgets/wires
    // initially show pre-tick (old) values.
    applySnapshot(baseSnapshot);

    // Restore CPU internal state from TARGET so FSM labels are correct, and
    // immediately reveal the CPU's post-tick output ports — control signals are
    // not animated, they just take their new values at the start of the state.
    // The flags are the exception: they are produced by the data, so they stay
    // on their pre-tick values until that data arrives (`revealUlaFlags`,
    // `revealControlFlags`).
    const revealed = new Set<string>();
    const cpu = useSimulatorStore.getState().getPrimaryCpu();
    if (cpu) {
      cpu.restoreInternalState(targetSnapshot.cpuInternalState);
      cpu.restoreUlaFlags(baseSnapshot.cpuInternalState.ulaFlags);
      cpu.restoreLatchedFlags(baseSnapshot.cpuInternalState);
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
      sendingComponents: new Set(),
      revealedComponents: revealed,
    });
  },

  markSending: (order) => {
    const { isActive, substepGroups, sendingComponents } = get();
    if (!isActive) return;

    const next = new Set(sendingComponents);
    for (const group of substepGroups) {
      if (group.order <= order) group.componentIds.forEach((id) => next.add(id));
    }
    if (next.size !== sendingComponents.size) set({ sendingComponents: next });
  },

  revealComponents: (componentIds) => {
    const { targetSnapshot, revealedComponents, isActive } = get();
    if (!isActive || !targetSnapshot) return;

    const newRevealed = new Set(revealedComponents);
    let changed = false;

    // LDA/LDAI set the UC's Z/N from the value written into the GPR, so they
    // change once that value lands there — the same rule `latchFlagsIfProduced`
    // follows in the CPU.
    const { previousState } = targetSnapshot.cpuInternalState;
    const loadsFlags =
      previousState === CpuState.WRITEREG1 || previousState === CpuState.WRITEREG2;
    const objects = useSimulatorStore.getState().objects;

    for (const componentId of componentIds) {
      if (applyComponentTargetState(componentId, targetSnapshot)) {
        newRevealed.add(componentId);
        changed = true;
      }
      const obj = objects.get(componentId);
      // The ULA computes as soon as its operands have landed.
      if (obj instanceof Ula) get().revealUlaFlags();
      if (obj instanceof Gpr && loadsFlags) get().revealControlFlags();
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

  revealOutputPort: (componentId, portName) => {
    const { targetSnapshot, isActive } = get();
    if (!isActive || !targetSnapshot) return;

    const value = targetSnapshot.state.get(componentId)?.ports[portName];
    if (typeof value !== "number") return;

    const obj = useSimulatorStore.getState().objects.get(componentId);
    if (!obj || !("getPorts" in obj)) return;
    const port = (obj as {
      getPorts: () => Record<
        string,
        { direction: string; set?: (v: number) => void; setWithoutPropagate?: (v: number) => void }
      >;
    }).getPorts()[portName];
    if (!port || port.direction !== "output") return;

    // Without propagation, like every other reveal: the value must not flow
    // into not-yet-revealed components.
    if (port.setWithoutPropagate) port.setWithoutPropagate(value);
    else port.set?.(value);
    useSimulatorStore.setState((s) => ({ revision: s.revision + 1 }));
  },

  revealOutputPorts: (componentId) => {
    const { targetSnapshot, isActive } = get();
    if (!isActive || !targetSnapshot) return;

    const targetState = targetSnapshot.state.get(componentId);
    const obj = useSimulatorStore.getState().objects.get(componentId);
    if (!targetState || !obj || !("getPorts" in obj)) return;

    const portMap = (obj as {
      getPorts: () => Record<
        string,
        { direction: string; set?: (v: number) => void; setWithoutPropagate?: (v: number) => void }
      >;
    }).getPorts();
    for (const [key, value] of Object.entries(targetState.ports)) {
      const port = portMap[key];
      if (!port || port.direction !== "output" || typeof value !== "number") continue;
      if (port.setWithoutPropagate) port.setWithoutPropagate(value);
      else port.set?.(value);
    }
    // A ULA sending its result has computed, flags included.
    if (obj instanceof Ula) get().revealUlaFlags();
    useSimulatorStore.setState((s) => ({ revision: s.revision + 1 }));
  },

  revealUlaFlags: () => {
    const { targetSnapshot, isActive } = get();
    if (!isActive || !targetSnapshot) return;
    const cpu = useSimulatorStore.getState().getPrimaryCpu();
    if (!cpu) return;
    cpu.restoreUlaFlags(targetSnapshot.cpuInternalState.ulaFlags);
    useSimulatorStore.setState((s) => ({ revision: s.revision + 1 }));
  },

  revealControlFlags: () => {
    const { targetSnapshot, isActive } = get();
    if (!isActive || !targetSnapshot) return;
    const cpu = useSimulatorStore.getState().getPrimaryCpu();
    if (!cpu) return;
    cpu.restoreLatchedFlags(targetSnapshot.cpuInternalState);
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
      sendingComponents: new Set(),
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
