import { create } from "zustand";
import { CpuState, Memory, Register } from "@/lib/simulator";
import type { WireDescriptor } from "@/lib/simulator";
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
  /**
   * Address of the instruction being executed at this tick — stable across
   * every tick of one instruction, only advancing at FETCH. This is NOT the
   * live PC register value (which now increments to PC+1 during the instruction
   * it fetched); it is carried forward from the PC value used at the last
   * FETCH, which is what a source-line / IMEM highlight needs.
   */
  pc: number;
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
  /**
   * Component ids that *received* something this tick (latched a new value, or
   * were the target of an asserted write-enable) but aren't in a substep group
   * because they don't *send* this state. See `computeActivatedComponents`.
   */
  activatedComponentIds: string[];
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
      latchedFlagZero: false,
      latchedFlagCarry: false,
      latchedFlagNegative: false,
    };
  }

  return {
    state: cpu.state,
    fsmIndex: cpu.fsmIndex,
    halted: cpu.halted,
    totalTicks: cpu.totalTicks,
    previousState: cpu.previousState,
    latchedFlagZero: cpu.latchedFlagZero,
    latchedFlagCarry: cpu.latchedFlagCarry,
    latchedFlagNegative: cpu.latchedFlagNegative,
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

function arrChanged(x?: number[], y?: number[]): boolean {
  if (x === y) return false;
  if (!x || !y || x.length !== y.length) return true;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return true;
  return false;
}

/**
 * Components that took part in this tick beyond sending a value from a substep
 * group — so the node lighting can also mark the ones that *received* something.
 * Two sources, both deliberately narrow so the whole datapath doesn't light
 * every tick from combinational ripple:
 *
 *  1. Clocked storage that latched a NEW value — a register whose output moved,
 *     a GPR that was written, a memory cell that was written.
 *  2. A component on the receiving end of a write-enable control signal that is
 *     ASSERTED this tick (a wire out of the CPU driven non-zero) — that signal
 *     means "you are latching now". "O recebimento de sinal de controle também
 *     deve acender o componente." The clearing edge doesn't count, and mux
 *     selects don't either — a mux lights from its own `tickSteps`.
 */
const ENABLE_SIGNAL_PORTS = new Set(["out_wrPC", "out_wrIR", "out_wrReg", "out_wrMem"]);
function computeActivatedComponents(
  cpu: CPU | null,
  wires: WireDescriptor[],
  pre: TickSnapshot,
  post: TickSnapshot,
): string[] {
  if (!cpu) return [];
  const ids = new Set<string>();

  for (const comp of cpu.getRegisteredComponents()) {
    const a = pre.state.get(comp.id);
    const b = post.state.get(comp.id);
    if (!a || !b) continue;

    let latched = false;
    switch (comp.type) {
      case "Register":
      case "PipelineRegister":
        latched = a.ports.value !== b.ports.value;
        break;
      case "GprComponent":
        latched = arrChanged(a.registers, b.registers);
        break;
      case "MemoryComponent":
        latched = arrChanged(a.cells, b.cells);
        break;
    }
    if (latched) ids.add(comp.id);
  }

  for (const w of wires) {
    if (w.sourceComponentId !== cpu.id) continue;
    if (!ENABLE_SIGNAL_PORTS.has(w.sourcePortName)) continue;
    const before = pre.state.get(w.sourceComponentId)?.ports[w.sourcePortName];
    const after = post.state.get(w.sourceComponentId)?.ports[w.sourcePortName];
    if (before !== after && after) ids.add(w.targetComponentId);
  }

  return [...ids];
}

/**
 * Wires whose source is a register. Their target input is special on the
 * timeline: it shows the value the wire last carried and only changes when the
 * wire animates again (see `holdRegisterFedInputs`).
 */
function registerFedWires(): WireDescriptor[] {
  const sim = useSimulatorStore.getState();
  return sim.getWires().filter((w) => sim.objects.get(w.sourceComponentId) instanceof Register);
}

/**
 * Rewrite, in every frame's snapshots, the input each register-fed wire shows.
 *
 * A snapshot is taken after the tick has fully propagated, so a register that
 * latched shows its NEW value on the inputs it feeds — although the wire
 * carried the OLD one and will only animate the new one in a later tick (the
 * PC latches PC+1 at FETCH, but PC → IMem.addr animates again only at the next
 * FETCH). Instead, an input holds what its wire last carried: the source's
 * pre-tick value in the last tick where that wire animated, i.e. the source is
 * in the frame's substep groups.
 *
 * Only target *input* ports are rewritten, and the values are read from the
 * raw pre-tick snapshot before any rewrite; the registers' own ports are never
 * touched. Frame 0 has pre === post and is left as captured.
 */
function holdRegisterFedInputs(frames: TickFrame[], wires: WireDescriptor[]): void {
  if (frames.length < 2 || wires.length === 0) return;

  const initial = frames[0].postTick.state;
  const held = new Map<string, number | undefined>();
  for (const w of wires) {
    held.set(w.id, initial.get(w.targetComponentId)?.ports[w.targetPortName]);
  }

  const write = (snapshot: TickSnapshot, w: WireDescriptor) => {
    const value = held.get(w.id);
    const ports = snapshot.state.get(w.targetComponentId)?.ports;
    if (ports && typeof value === "number") ports[w.targetPortName] = value;
  };

  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i];
    const animated = new Set(frame.substepGroups.flatMap((g) => g.componentIds));

    for (const w of wires) {
      write(frame.preTick, w);
      if (animated.has(w.sourceComponentId)) {
        const carried = frame.preTick.state.get(w.sourceComponentId)?.ports[w.sourcePortName];
        if (typeof carried === "number") held.set(w.id, carried);
      }
      write(frame.postTick, w);
    }
  }
}

export function applySnapshot(snapshot: TickSnapshot): void {
  const sim = useSimulatorStore.getState();
  sim.applyObjectStates(cloneStateMap(snapshot.state));

  // applyObjectStates restores outputs, which propagate: a register's new value
  // would land on every input it feeds. Put those inputs back to what the
  // snapshot says they show.
  const fed = registerFedWires();
  if (fed.length > 0) {
    const objects = useSimulatorStore.getState().objects;
    for (const w of fed) {
      const value = snapshot.state.get(w.targetComponentId)?.ports[w.targetPortName];
      const target = objects.get(w.targetComponentId);
      if (typeof value !== "number" || !target || !("getPorts" in target)) continue;
      const port = (target as { getPorts: () => Record<string, { direction: string; set?: (v: number) => void }> })
        .getPorts()[w.targetPortName];
      if (port?.direction === "input") port.set?.(value);
    }
    useSimulatorStore.setState((s) => ({ revision: s.revision + 1 }));
  }

  const cpu = sim.getPrimaryCpu();
  if (cpu) {
    cpu.restoreInternalState(snapshot.cpuInternalState);
  }
}

/**
 * Resolve the PC register's component id from wiring, not from a hardcoded id —
 * a project's ids are arbitrary (the default project's own IMEM id is a
 * generated uuid), so the only reliable way to find "the PC" is to follow the
 * CPU's own `out_wrPC` control signal to whatever register it drives.
 */
function resolvePcRegisterId(cpuId: string): string | null {
  const wire = useSimulatorStore
    .getState()
    .getWires()
    .find((w) => w.sourceComponentId === cpuId && w.sourcePortName === "out_wrPC");
  return wire?.targetComponentId ?? null;
}

/** Live value of the PC register right now, or 0 when the PC can't be resolved. */
function readPcRegister(pcRegisterId: string | null): number {
  if (!pcRegisterId) return 0;
  return useSimulatorStore.getState().getRegister(pcRegisterId)?.value ?? 0;
}

/**
 * @param instructionAddr address of the instruction being executed this tick —
 *        the caller carries this forward and only advances it at FETCH.
 */
function captureSnapshot(index: number, instructionAddr: number): TickSnapshot {
  const sim = useSimulatorStore.getState();
  const cpu = sim.getPrimaryCpu();
  const state = cloneStateMap(sim.serializeObjects());

  return {
    index,
    state,
    cpuState: cpu?.state ?? CpuState.FETCH,
    opcode: Number(cpu?.in_opcode?.value ?? 0),
    halted: cpu?.halted ?? false,
    cpuInternalState: toCpuInternalState(index),
    pc: instructionAddr,
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

      // resetClock() zeroes the data memory (Memory.reset()). Reload the
      // program's initial data values on top of the clean slate; with no .data
      // section `dataWords` is empty and the memory simply stays zeroed.
      if (dataWords.length > 0) {
        const memEntry = Array.from(sim.objects.entries())
          .find(([, obj]) => obj instanceof Memory);
        if (memEntry) (memEntry[1] as Memory).load(dataWords);
      }

      const cpuForPc = sim.getPrimaryCpu();
      const pcRegisterId = cpuForPc ? resolvePcRegisterId(cpuForPc.id) : null;
      const wires = sim.getWires();

      // The address of the instruction being executed. Carried forward across
      // ticks and only advanced at FETCH, so it stays put while the PC register
      // itself runs ahead to PC+1 during the instruction it fetched.
      let instructionAddr = readPcRegister(pcRegisterId);

      // Frame 0: initial state. No tick has run, so pre === post and there are
      // no substeps to reveal.
      const initialSnapshot = captureSnapshot(0, instructionAddr);
      frames.push({
        index: 0,
        preTick: initialSnapshot,
        postTick: initialSnapshot,
        substepGroups: [],
        activatedComponentIds: [],
      });

      let tickCount = 0;
      while (tickCount < get().MAX_TICKS) {
        const cpu = sim.getPrimaryCpu();
        if (cpu?.halted) break;

        // State BEFORE the tick — what widgets/wires show when this frame opens.
        const preSnapshot = captureSnapshot(tickCount, instructionAddr);

        // PC value used by this tick's FETCH (before the tick increments it).
        const pcBeforeTick = readPcRegister(pcRegisterId);
        sim.tickClock();
        tickCount += 1;

        // Group by the state that just executed (CPU.previousState), matching
        // the state the wire-animation overlay groups wires by.
        const executedState =
          sim.getPrimaryCpu()?.previousState ?? CpuState.RESET;

        // A FETCH just latched the instruction at the pre-tick PC value; that is
        // the instruction every following tick executes until the next FETCH.
        if (executedState === CpuState.FETCH) {
          instructionAddr = pcBeforeTick;
        }

        // State AFTER the tick — fully propagated final values.
        const postSnapshot = captureSnapshot(tickCount, instructionAddr);

        const substepGroups = buildSubstepGroups(sim.getPrimaryCpu(), executedState);

        frames.push({
          index: tickCount,
          preTick: preSnapshot,
          postTick: postSnapshot,
          substepGroups,
          activatedComponentIds: computeActivatedComponents(
            sim.getPrimaryCpu(),
            wires,
            preSnapshot,
            postSnapshot,
          ),
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

    holdRegisterFedInputs(frames, registerFedWires());

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

    if (frame.substepGroups.length > 0 || frame.activatedComponentIds.length > 0) {
      // Progressive reveal: start widgets/wires at the pre-tick state, then let
      // the wire animation reveal post-tick values substep by substep.
      maskStore.init(
        frame.preTick,
        frame.postTick,
        frame.substepGroups,
        frame.activatedComponentIds,
      );
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
