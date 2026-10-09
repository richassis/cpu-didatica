import { create } from "zustand";
import { CONTROL_SIGNAL_DEFS, CpuState, Memory, Register, controlPortKey } from "@/lib/simulator";
import type { WireDescriptor } from "@/lib/simulator";
import type { ComponentState } from "@/lib/store";
import { inferComponentType, useSimulatorStore } from "@/lib/simulatorStore";
import { portKind } from "@/lib/portKinds";
import type { CPU, CpuInternalStateSnapshot } from "@/lib/simulator/Cpu";
import { useDisplayMaskStore } from "@/lib/displayMaskStore";

/** Safety cap for batch execution. */
const MAX_TICKS = 1000;

export interface TickSnapshot {
  /** Full state of all simulator objects. */
  state: Map<string, ComponentState>;
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
  /**
   * State BEFORE this tick's evaluate+commit runs.
   * For frame 0 this is the initial reset state; for frame N>0 it equals
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
  /**
   * The value each data wire carried when it last animated, as of the end of
   * this tick (see `computeWireValues`). A wire at rest shows this, not the
   * live value of its source, which keeps changing after the wire delivered.
   */
  wireValues?: Map<string, number>;
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
  /** True when a program has been loaded and the timeline is active. */
  isTimelineActive: boolean;
  /** Why execution stopped early (the run hit `MAX_TICKS`); the text is the interface's. */
  executionError: { code: "tickLimit"; maxTicks: number } | null;

  loadAndExecute: (dataWords?: number[]) => void;
  goToTick: (index: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  goToStart: () => void;
  goToEnd: () => void;
  /** Exit the timeline and reset to initial state. */
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
      latchedFlagOverflow: false,
      ulaFlags: { zero: false, carry: false, negative: false, overflow: false },
      drivenSignals: [],
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
    latchedFlagOverflow: cpu.latchedFlagOverflow,
    ulaFlags: { ...cpu.ulaFlags },
    drivenSignals: cpu.getDrivenControlSignalPorts(),
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

/**
 * Components that took part in this tick beyond sending a value from a substep
 * group — so the node lighting can also mark the ones that *received* something.
 * A block lights because it *operated*, not because its value moved: writing
 * the same value it already held is still a write. Two sources, both
 * deliberately narrow so the whole datapath doesn't light every tick from
 * combinational ripple:
 *
 *  1. Clocked storage that performed a write this tick (`wroteLastCommit`) — a
 *     register whose write-enable or CPU gate was open, a GPR or memory cell
 *     that was written. Read from the live objects, so this must run right
 *     after the tick.
 *  2. A component on the receiving end of a write-enable control signal that is
 *     ASSERTED this tick (a wire out of the CPU at non-zero) — that signal
 *     means "you are latching now". "O recebimento de sinal de controle também
 *     deve acender o componente." Mux selects don't count — a mux lights from
 *     its own `tickSteps`.
 */
const ENABLE_SIGNAL_PORTS: ReadonlySet<string> = new Set(
  CONTROL_SIGNAL_DEFS.filter((d) => d.role === "writeEnable").map((d) => controlPortKey(d.name)),
);
function computeActivatedComponents(
  cpu: CPU | null,
  wires: WireDescriptor[],
  post: TickSnapshot,
): string[] {
  if (!cpu) return [];
  const ids = new Set<string>();

  // A HALT tick doesn't tick the datapath, so the flags would be stale.
  for (const comp of cpu.halted ? [] : cpu.getRegisteredComponents()) {
    const storage = comp.component as unknown as { wroteLastCommit?: boolean };
    if (storage.wroteLastCommit) ids.add(comp.id);
  }

  for (const w of wires) {
    if (w.sourceComponentId !== cpu.id) continue;
    if (!ENABLE_SIGNAL_PORTS.has(w.sourcePortName)) continue;
    const after = post.state.get(w.sourceComponentId)?.ports[w.sourcePortName];
    if (after) ids.add(w.targetComponentId);
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
 * Fill `wireValues` on every frame: the value each data wire carried when it
 * last animated, as of the end of that tick.
 *
 * A wire at rest keeps showing that value. Reading the live source instead
 * drifts: a register updates after its wire delivered, and combinational logic
 * (the IMem, PC+1, MUX_PC) is re-evaluated every tick with the propagated
 * inputs, whether or not any wire animated.
 */
function computeWireValues(frames: TickFrame[]): void {
  if (frames.length === 0) return;
  const sim = useSimulatorStore.getState();
  // Control-signal wires reflect the CPU's current state and never go stale.
  const wires = sim.getWires().filter((w) => {
    const source = sim.objects.get(w.sourceComponentId);
    return !source || portKind(inferComponentType(source), w.sourcePortName) !== "control";
  });

  const carried = new Map<string, number>();
  for (const w of wires) {
    const initial = frames[0].postTick.state.get(w.sourceComponentId)?.ports[w.sourcePortName];
    if (typeof initial === "number") carried.set(w.id, initial);
  }
  frames[0].wireValues = new Map(carried);

  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i];
    const animated = new Set(frame.substepGroups.flatMap((g) => g.componentIds));

    for (const w of wires) {
      if (!animated.has(w.sourceComponentId)) continue;
      // A register drives its wire with the value it held before the commit;
      // everything else has already computed its output by then.
      const isRegister = sim.objects.get(w.sourceComponentId) instanceof Register;
      const snapshot = isRegister ? frame.preTick : frame.postTick;
      const value = snapshot.state.get(w.sourceComponentId)?.ports[w.sourcePortName];
      if (typeof value === "number") carried.set(w.id, value);
    }
    frame.wireValues = new Map(carried);
  }
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
    .find((w) => w.sourceComponentId === cpuId && w.sourcePortName === controlPortKey("wrPC"));
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
  const state = cloneStateMap(sim.serializeObjects());

  return {
    state,
    cpuInternalState: toCpuInternalState(index),
    pc: instructionAddr,
  };
}

export const useExecutionStore = create<ExecutionState>()((set, get) => ({
  frames: [],
  currentIndex: 0,
  isTimelineActive: false,
  executionError: null,
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
        preTick: initialSnapshot,
        postTick: initialSnapshot,
        substepGroups: [],
        activatedComponentIds: [],
      });

      let tickCount = 0;
      while (tickCount < MAX_TICKS) {
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
          preTick: preSnapshot,
          postTick: postSnapshot,
          substepGroups,
          activatedComponentIds: computeActivatedComponents(
            sim.getPrimaryCpu(),
            wires,
            postSnapshot,
          ),
        });

        if (sim.getPrimaryCpu()?.halted) {
          break;
        }
      }

      const halted = sim.getPrimaryCpu()?.halted ?? false;
      if (!halted && tickCount >= MAX_TICKS) {
        console.warn(`Execution stopped after ${MAX_TICKS} ticks (possible infinite loop).`);
        set({ executionError: { code: "tickLimit", maxTicks: MAX_TICKS } });
      } else {
        set({ executionError: null });
      }
    } finally {
      useSimulatorStore.setState({ isBatchExecuting: false });
    }

    computeWireValues(frames);
    holdRegisterFedInputs(frames, registerFedWires());

    useDisplayMaskStore.getState().deactivate();
    if (frames.length > 0) {
      applySnapshot(frames[0].preTick);
    }

    set({
      frames,
      currentIndex: 0,
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
      isTimelineActive: false,
      executionError: null,
      totalTicks: 0,
      canGoForward: false,
      canGoBack: false,
    });
  },
}));
