import { create } from "zustand";
import { CpuState, Memory } from "@/lib/simulator";
import type { ComponentState } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import type { CPU, CpuInternalStateSnapshot } from "@/lib/simulator/Cpu";
import { useDisplayMaskStore } from "@/lib/displayMaskStore";

const DEFAULT_MAX_TICKS = 1000 as const;

export interface TickSnapshot {
  /** Index of the tick (0 = initial state before first tick). */
  index: number;
  /** Full state of all simulator objects. */
  state: Map<string, ComponentState>;
  /** CPU state at this tick for timeline display. */
  cpuState: CpuState;
  /** Opcode being executed at this tick. */
  opcode: number;
  /** Whether CPU was halted at this tick. */
  halted: boolean;
  /** CPU internal fields not captured by serializeObjects(). */
  cpuInternalState: CpuInternalStateSnapshot;
}

/** An ordered group of components that reveal together during a substep. */
export interface SubstepGroup {
  /** Substep order index (0, 1, 2, ...). Lower reveals first. */
  order: number;
  /** Component IDs that belong to this substep. */
  componentIds: string[];
}

/**
 * A tick frame bundles the pre-tick and post-tick snapshots for a single CPU
 * tick, plus the substep groups used to progressively reveal components as the
 * wire animation plays.
 */
export interface TickFrame {
  /** Index of this tick (0 = initial, 1 = after first tick, etc.). */
  index: number;
  /**
   * State BEFORE this tick's evaluate+commit runs.
   * For index 0 this is the initial reset state; for index N>0 it equals
   * postTick of frame N-1.
   */
  preTick: TickSnapshot;
  /** State AFTER this tick's evaluate+commit runs (fully propagated). */
  postTick: TickSnapshot;
  /** Substep groups for the state executed by this tick. */
  substepGroups: SubstepGroup[];
}

interface ExecutionDerivedState {
  totalTicks: number;
  canGoForward: boolean;
  canGoBack: boolean;
}

export interface ExecutionState extends ExecutionDerivedState {
  /** Complete per-tick frame history (pre/post snapshots + substep groups). */
  frames: TickFrame[];
  /** Index currently displayed. */
  currentIndex: number;
  /** True when a program has been executed and snapshots are ready. */
  isLoaded: boolean;
  /**
   * True when a program has been loaded and the timeline is active.
   * (Renamed from isProgramMode to avoid confusion with the UI mode in modeStore.)
   */
  isTimelineActive: boolean;
  /** Safety cap for batch execution. */
  MAX_TICKS: 1000;
  /** Error message when execution stops due to max ticks. */
  executionError: string | null;

  loadAndExecute: (dataWords?: number[]) => void;
  goToTick: (index: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  goToStart: () => void;
  goToEnd: () => void;
  /** Exit the timeline and reset to initial state. (Renamed from exitProgramMode.) */
  exitTimeline: () => void;
}

function cloneComponentState(state: ComponentState): ComponentState {
  return {
    ports: { ...state.ports },
    ...(state.registers ? { registers: [...state.registers] } : {}),
    ...(state.cells ? { cells: [...state.cells] } : {}),
  };
}

function cloneStateMap(source: Map<string, ComponentState>): Map<string, ComponentState> {
  const cloned = new Map<string, ComponentState>();
  for (const [id, state] of source) {
    cloned.set(id, cloneComponentState(state));
  }
  return cloned;
}

function toCpuInternalState(index: number): CpuInternalStateSnapshot {
  const cpu = useSimulatorStore.getState().getPrimaryCpu();
  if (!cpu) {
    return {
      state: CpuState.FETCH,
      fsmIndex: 0,
      halted: false,
      totalTicks: index,
      previousState: CpuState.RESET,
    };
  }

  return {
    state: cpu.state,
    fsmIndex: cpu.fsmIndex,
    halted: cpu.halted,
    totalTicks: cpu.totalTicks,
    previousState: cpu.previousState,
  };
}

function toDerivedState(frames: TickFrame[], currentIndex: number): ExecutionDerivedState {
  const totalTicks = Math.max(0, frames.length - 1);
  return {
    totalTicks,
    canGoBack: frames.length > 0 && currentIndex > 0,
    canGoForward: frames.length > 0 && currentIndex < totalTicks,
  };
}

/**
 * Build the ordered substep groups for the state a tick just executed.
 *
 * Components are grouped by their `tickOrderByState[executedState]` (lower
 * reveals first). Components whose `tickSteps` do not include the executed
 * state are skipped — they stay at their pre-tick values for this frame.
 *
 * `executedState` must match the state the wire-animation overlay groups by
 * (the CPU's `previousState` after the tick), so wire groups and reveal groups
 * refer to the same order values.
 */
function buildSubstepGroups(cpu: CPU | null, executedState: CpuState): SubstepGroup[] {
  if (!cpu) return [];

  const orderMap = new Map<number, string[]>();
  for (const comp of cpu.getRegisteredComponents()) {
    if (!comp.tickSteps.includes(executedState)) continue;

    const rawOrder = comp.tickOrderByState[executedState] ?? 0;
    const order = Number.isFinite(rawOrder) ? Math.max(0, Math.floor(rawOrder)) : 0;
    const group = orderMap.get(order) ?? [];
    group.push(comp.id);
    orderMap.set(order, group);
  }

  return Array.from(orderMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([order, componentIds]) => ({ order, componentIds }));
}

export function applySnapshot(snapshot: TickSnapshot): void {
  const sim = useSimulatorStore.getState();
  sim.applyObjectStates(cloneStateMap(snapshot.state));

  const cpu = sim.getPrimaryCpu();
  if (cpu) {
    cpu.restoreInternalState(snapshot.cpuInternalState);
  }
}

function captureSnapshot(index: number): TickSnapshot {
  const sim = useSimulatorStore.getState();
  const cpu = sim.getPrimaryCpu();

  return {
    index,
    state: cloneStateMap(sim.serializeObjects()),
    cpuState: cpu?.state ?? CpuState.FETCH,
    opcode: Number(cpu?.in_opcode?.value ?? 0),
    halted: cpu?.halted ?? false,
    cpuInternalState: toCpuInternalState(index),
  };
}

export const useExecutionStore = create<ExecutionState>()((set, get) => ({
  frames: [],
  currentIndex: 0,
  isLoaded: false,
  isTimelineActive: false,
  executionError: null,
  MAX_TICKS: DEFAULT_MAX_TICKS,
  totalTicks: 0,
  canGoForward: false,
  canGoBack: false,

  loadAndExecute: (dataWords: number[] = []) => {
    const sim = useSimulatorStore.getState();
    const frames: TickFrame[] = [];

    useSimulatorStore.setState({ isBatchExecuting: true });
    try {
      sim.resetClock();

      // Reload initial data memory values after resetClock() wiped everything
      if (dataWords.length > 0) {
        const memEntry = Array.from(sim.objects.entries())
          .find(([, obj]) => obj instanceof Memory);
        if (memEntry) (memEntry[1] as Memory).load(dataWords);
      }

      // Frame 0: initial state. No tick has run, so pre === post and there are
      // no substeps to reveal.
      const initialSnapshot = captureSnapshot(0);
      frames.push({
        index: 0,
        preTick: initialSnapshot,
        postTick: initialSnapshot,
        substepGroups: [],
      });

      let tickCount = 0;
      while (tickCount < get().MAX_TICKS) {
        const cpu = sim.getPrimaryCpu();
        if (cpu?.halted) break;

        // State BEFORE the tick — what widgets/wires show when this frame opens.
        const preSnapshot = captureSnapshot(tickCount);

        sim.tickClock();
        tickCount += 1;

        // State AFTER the tick — fully propagated final values.
        const postSnapshot = captureSnapshot(tickCount);

        // Group by the state that just executed (CPU.previousState), matching
        // the state the wire-animation overlay groups wires by.
        const executedState = postSnapshot.cpuInternalState.previousState;
        const substepGroups = buildSubstepGroups(sim.getPrimaryCpu(), executedState);

        frames.push({
          index: tickCount,
          preTick: preSnapshot,
          postTick: postSnapshot,
          substepGroups,
        });

        if (sim.getPrimaryCpu()?.halted) {
          break;
        }
      }

      const halted = sim.getPrimaryCpu()?.halted ?? false;
      if (!halted && tickCount >= get().MAX_TICKS) {
        const message = `Execution stopped after ${get().MAX_TICKS} ticks (possible infinite loop).`;
        console.warn(message);
        set({ executionError: message });
      } else {
        set({ executionError: null });
      }
    } finally {
      useSimulatorStore.setState({ isBatchExecuting: false });
    }

    useDisplayMaskStore.getState().deactivate();
    if (frames.length > 0) {
      applySnapshot(frames[0].preTick);
    }

    set({
      frames,
      currentIndex: 0,
      isLoaded: frames.length > 0,
      isTimelineActive: true,
      ...toDerivedState(frames, 0),
    });
  },

  goToTick: (index) => {
    const { frames } = get();
    if (frames.length === 0) return;

    const clamped = Math.max(0, Math.min(frames.length - 1, index));
    const frame = frames[clamped];

    const maskStore = useDisplayMaskStore.getState();

    // Fast-scrub: finalize any in-flight animation before starting a new one.
    if (maskStore.isActive) {
      maskStore.revealAll();
    }

    if (frame.substepGroups.length > 0) {
      // Progressive reveal: start widgets/wires at the pre-tick state, then let
      // the wire animation reveal post-tick values substep by substep.
      maskStore.init(frame.preTick, frame.postTick, frame.substepGroups);
    } else {
      // No substeps (e.g. frame 0) — apply the final state directly.
      maskStore.deactivate();
      applySnapshot(frame.postTick);
    }

    // Start exactly one wire-animation pass for this navigation. Reveals bump
    // `revision` (not `animationCycle`), so they refresh values without
    // restarting this animation.
    useSimulatorStore.getState().bumpAnimationCycle();

    set({
      currentIndex: clamped,
      ...toDerivedState(frames, clamped),
    });
  },

  stepForward: () => {
    const { currentIndex, totalTicks } = get();
    if (currentIndex >= totalTicks) return;
    get().goToTick(currentIndex + 1);
  },

  stepBackward: () => {
    const { currentIndex } = get();
    if (currentIndex <= 0) return;
    get().goToTick(currentIndex - 1);
  },

  goToStart: () => {
    get().goToTick(0);
  },

  goToEnd: () => {
    const { totalTicks } = get();
    get().goToTick(totalTicks);
  },

  exitTimeline: () => {
    const { frames } = get();
    useDisplayMaskStore.getState().deactivate();
    if (frames.length > 0) {
      applySnapshot(frames[0].preTick);
    }

    set({
      frames: [],
      currentIndex: 0,
      isLoaded: false,
      isTimelineActive: false,
      executionError: null,
      MAX_TICKS: DEFAULT_MAX_TICKS,
      totalTicks: 0,
      canGoForward: false,
      canGoBack: false,
    });
  },
}));
