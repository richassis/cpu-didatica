import { create } from "zustand";
import { CpuState } from "@/lib/simulator";
import type { ComponentState } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import type { CpuInternalStateSnapshot } from "@/lib/simulator/Cpu";

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

interface ExecutionDerivedState {
  totalTicks: number;
  canGoForward: boolean;
  canGoBack: boolean;
}

export interface ExecutionState extends ExecutionDerivedState {
  /** Complete snapshots history. */
  snapshots: TickSnapshot[];
  /** Index currently displayed. */
  currentIndex: number;
  /** True when a program has been executed and snapshots are ready. */
  isLoaded: boolean;
  /** True when program mode is active. */
  isProgramMode: boolean;
  /** Safety cap for batch execution. */
  MAX_TICKS: 1000;

  loadAndExecute: () => void;
  goToTick: (index: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  goToStart: () => void;
  goToEnd: () => void;
  exitProgramMode: () => void;
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

function toDerivedState(snapshots: TickSnapshot[], currentIndex: number): ExecutionDerivedState {
  const totalTicks = Math.max(0, snapshots.length - 1);
  return {
    totalTicks,
    canGoBack: snapshots.length > 0 && currentIndex > 0,
    canGoForward: snapshots.length > 0 && currentIndex < totalTicks,
  };
}

function applySnapshot(snapshot: TickSnapshot): void {
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
  snapshots: [],
  currentIndex: 0,
  isLoaded: false,
  isProgramMode: false,
  MAX_TICKS: DEFAULT_MAX_TICKS,
  totalTicks: 0,
  canGoForward: false,
  canGoBack: false,

  loadAndExecute: () => {
    const sim = useSimulatorStore.getState();
    const snapshots: TickSnapshot[] = [];

    useSimulatorStore.setState({ isBatchExecuting: true });
    try {
      sim.resetClock();
      snapshots.push(captureSnapshot(0));

      let tickCount = 0;
      while (tickCount < get().MAX_TICKS) {
        const cpu = sim.getPrimaryCpu();
        if (cpu?.halted) break;

        sim.tickClock();
        tickCount += 1;
        snapshots.push(captureSnapshot(tickCount));

        if (sim.getPrimaryCpu()?.halted) {
          break;
        }
      }
    } finally {
      useSimulatorStore.setState({ isBatchExecuting: false });
    }

    if (snapshots.length > 0) {
      applySnapshot(snapshots[0]);
    }

    set({
      snapshots,
      currentIndex: 0,
      isLoaded: snapshots.length > 0,
      isProgramMode: true,
      ...toDerivedState(snapshots, 0),
    });
  },

  goToTick: (index) => {
    const { snapshots } = get();
    if (snapshots.length === 0) return;

    const clamped = Math.max(0, Math.min(snapshots.length - 1, index));
    const snapshot = snapshots[clamped];

    applySnapshot(snapshot);

    set({
      currentIndex: clamped,
      ...toDerivedState(snapshots, clamped),
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

  exitProgramMode: () => {
    const { snapshots } = get();
    if (snapshots.length > 0) {
      applySnapshot(snapshots[0]);
    }

    set({
      snapshots: [],
      currentIndex: 0,
      isLoaded: false,
      isProgramMode: false,
      MAX_TICKS: DEFAULT_MAX_TICKS,
      totalTicks: 0,
      canGoForward: false,
      canGoBack: false,
    });
  },
}));
