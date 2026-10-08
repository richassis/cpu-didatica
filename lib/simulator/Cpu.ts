import type { Clockable } from "./Clockable";
import { Opcode, UlaOperation, OPCODE_TO_ULA_OP, FLAG_BITS } from "./ISA";
import { InputPort, OutputPort, type Connectable, type PortMap } from "./Port";
import { CpuState, ALL_CPU_STATES } from "./CpuState";
import { DEFAULT_TICK_STEPS } from "./CpuSteps";

// Re-export CpuState for backwards compatibility
export { CpuState } from "./CpuState";

/**
 * Control signal definitions for the CPU.
 * These are output ports that drive other components.
 */
export interface ControlSignalDef {
  name: string;
  bitWidth: number;
  description: string;
}

/**
 * Safety cap for the combinational settle loop in `tickAllComponentsPhased()`.
 * Deeper than any datapath the simulator can build; guards against oscillation.
 */
const MAX_EVALUATE_PASSES = 8;

export const CONTROL_SIGNAL_DEFS: ControlSignalDef[] = [
  { name: "wrIR", bitWidth: 1, description: "Write enable for IR" },
  { name: "muxAReg", bitWidth: 1, description: "GPR address mux select" },
  { name: "muxDReg", bitWidth: 2, description: "GPR data mux select" },
  { name: "wrPC", bitWidth: 1, description: "Write enable for PC" },
  { name: "muxPC", bitWidth: 1, description: "PC source mux select" },
  { name: "rdMem", bitWidth: 1, description: "Memory read enable" },
  { name: "wrMem", bitWidth: 1, description: "Memory write enable" },
  { name: "wrReg", bitWidth: 1, description: "Write enable for GPR" },
  { name: "opULA", bitWidth: 3, description: "ULA operation select" },
];

/**
 * Maps each opcode to its ordered sequence of CpuState steps that execute
 * after FETCH+DECODE, one per clock tick; the CPU returns to FETCH when the
 * last step is done. Opcodes without an entry (HLT, unknown) go to HALT.
 */
export const OPCODE_SEQUENCES: Readonly<Partial<Record<Opcode, CpuState[]>>> = {
  [Opcode.LDA]:  [CpuState.READMEM,  CpuState.WRITEREG1],
  [Opcode.LDAI]: [CpuState.WRITEREG2],
  [Opcode.STA]:  [CpuState.READREG1, CpuState.WRITEMEM],
  [Opcode.ADD]:  [CpuState.READREG2, CpuState.EXECUTE,  CpuState.WRITEREG3],
  [Opcode.SUB]:  [CpuState.READREG2, CpuState.EXECUTE,  CpuState.WRITEREG3],
  [Opcode.AND]:  [CpuState.READREG2, CpuState.EXECUTE,  CpuState.WRITEREG3],
  [Opcode.OR]:   [CpuState.READREG2, CpuState.EXECUTE,  CpuState.WRITEREG3],
  [Opcode.NOT]:  [CpuState.READREG2, CpuState.EXECUTE,  CpuState.WRITEREG3],
  [Opcode.JZ]:   [CpuState.WRITEPC],
  [Opcode.JN]:   [CpuState.WRITEPC],
  [Opcode.JMP]:  [CpuState.WRITEPC],
  // HLT and unknown opcodes are handled in doDecode()
};

/**
 * Control signal configuration for each CPU state.
 * Defines which control signals are active and their values for each state.
 * 
 * Signal values (mux inputs as wired in the default project):
 * - wrReg: 0=no write, 1=write to GPR
 * - muxAReg: 0=register field [10:8] (standard format), 1=ULA dst field [2:0]
 * - muxDReg: 0=sign-extended immediate, 1=memory data (MDR), 2=ULA result (R)
 * - wrPC: 0=no write, 1=write to PC
 * - muxPC: 0=branch target (MAR), 1=PC+1
 * - rdMem: 0=no read, 1=read from data memory
 * - wrMem: 0=no write, 1=write to data memory
 * - wrIR: 0=no write, 1=write to IR
 * - opULA: ULA operation code (see UlaOperation enum)
 */
export interface ControlSignals {
  wrIR?: number;
  muxAReg?: number;
  muxDReg?: number;
  wrPC?: number;
  muxPC?: number;
  rdMem?: number;
  wrMem?: number;
  wrReg?: number;
  opULA?: number;
}

/**
 * Control signal values at rest, applied by `CPU.reset()` (the RESET entry
 * below). Mux selects rest on the path FETCH uses, not on 0.
 */
export const DEFAULT_CONTROL_SIGNALS: Readonly<ControlSignals> = {
  wrIR: 0,
  muxAReg: 1,              // Default mux selection
  muxDReg: 2,              // Default mux selection
  wrPC: 0,
  muxPC: 1,                // Default mux selection
  rdMem: 0,
  wrMem: 0,
  wrReg: 0,
  opULA: UlaOperation.ADD, // Default ULA operation
};

/**
 * Control signal configurations for each CPU state.
 * Only the signals a state changes need to be listed; a signal a state leaves
 * out keeps whatever value it had (see `emitSignals`).
 *
 * Complete CPU State Machine Control Signal Map:
 * ┌──────────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
 * │ State        │wrReg│muxAR│muxDR│wrPC │muxPC│rdMem│wrMem│wrIR │opULA│
 * ├──────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
 * │ RESET        │  0  │  1  │  2  │  0  │  1  │  0  │  0  │  0  │ ADD │
 * │ FETCH        │  0  │  1  │  2  │  1  │  1  │  0  │  0  │  1  │ ADD │
 * │ DECODE       │  -  │  -  │  -  │  0  │  -  │  -  │  -  │  0  │  -  │
 * │ READMEM      │  -  │  0  │  1  │  -  │  -  │  1  │  -  │  -  │  -  │
 * │ WRITEREG1    │  1  │  -  │  -  │  -  │  -  │  0  │  -  │  -  │  -  │
 * │ WRITEREG2    │  1  │  0  │  0  │  -  │  -  │  -  │  -  │  -  │  -  │
 * │ READREG1     │  -  │  -  │  -  │  -  │  -  │  -  │  -  │  -  │  -  │
 * │ WRITEMEM     │  -  │  -  │  -  │  -  │  -  │  -  │  1  │  -  │  -  │
 * │ READREG2     │  -  │  -  │  -  │  -  │  -  │  -  │  -  │  -  │  -  │
 * │ EXECUTE      │  -  │  -  │  -  │  -  │  -  │  -  │  -  │  -  │ dyn │
 * │ WRITEREG3    │  1  │  -  │  -  │  -  │  -  │  -  │  -  │  -  │ ADD │
 * │ WRITEPC      │  -  │  -  │  -  │cond │cond │  -  │  -  │  -  │  -  │
 * └──────────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
 * Legend: - = not set (keeps its previous value), dyn = dynamic (opcode-dependent),
 *         cond = conditional (flag-dependent), ADD = UlaOperation.ADD
 *
 * Special cases:
 * - RESET: DEFAULT_CONTROL_SIGNALS, applied only by `CPU.reset()` — never run
 *          as a tick. Mux signals rest on FETCH's path, not on zero.
 * - FETCH: IR ← IMem[PC] and PC ← PC+1, both latched on this tick
 * - DECODE: Handled by doDecode(), determines next state based on opcode
 * - READREG1: no signals — the CPU opens the A/B latches itself (see `tick`)
 * - EXECUTE: opULA value set dynamically based on instruction opcode
 * - WRITEPC: wrPC and muxPC set only when the branch is taken
 */
export const STATE_CONTROL_SIGNALS: Readonly<Partial<Record<CpuState, ControlSignals>>> = {
  // RESET - every signal at rest; applied by reset(), never as a tick
  [CpuState.RESET]: DEFAULT_CONTROL_SIGNALS,

  // FETCH state - IR ← IMem[PC], PC ← PC+1
  [CpuState.FETCH]: {
    wrPC: 1,      // Enable PC write (PC latches PC+1 this tick)
    wrIR: 1,      // Enable IR write (latch instruction)
    wrMem: 0,     // Disable memory write
    muxPC: 1,     // Select PC+1 as the next PC
    muxAReg: 1,   // Select address for register
    muxDReg: 2,   // Select data for register
    rdMem: 0,     // Data memory read disabled during FETCH (InstructionMemory is always-on)
    wrReg: 0,
    opULA: UlaOperation.ADD, // ULA back to its idle operation
  },

  // DECODE state - instruction and PC+1 already latched in FETCH
  [CpuState.DECODE]: {
    wrPC: 0,      // Disable PC write
    wrIR: 0,      // Disable IR write
  },
  
  // READMEM state - read from memory (used by LDA)
  [CpuState.READMEM]: {
    rdMem: 1,
    muxAReg: 0,   // select GPR address for later write
    muxDReg: 1,   // select memory data for later write
  },

  // WRITEREG1 state - write memory data to GPR (used by LDA)
  [CpuState.WRITEREG1]: {
    wrReg: 1,
    rdMem: 0,
  },

  // WRITEREG2 state - write immediate operand to GPR (used by LDAI)
  [CpuState.WRITEREG2]: {
    wrReg: 1,
    muxAReg: 0,   // select GPR address
    muxDReg: 0,   // immediate operand
  },

  // READREG1 state - read the source register into A (used by STA)
  [CpuState.READREG1]: {
    // No signals: the CPU opens the A/B latches itself (see `tick`)
  },

  // WRITEMEM state - write GPR data to memory (used by STA)
  [CpuState.WRITEMEM]: {
    wrMem: 1,
  },

  // READREG2 state - read second source operand (used by ULA ops)
  [CpuState.READREG2]: {
    // No signals need to be set - just a wait state for data propagation
  },

  // EXECUTE state - perform ULA operation
  // Note: opULA value is set dynamically based on opcode
  [CpuState.EXECUTE]: {
    // opULA is set in emitSignals based on the instruction
  },

  // WRITEREG3 state - write ULA result to destination register
  [CpuState.WRITEREG3]: {
    wrReg: 1,
    opULA: UlaOperation.ADD, // result already latched in R; ULA back to its idle operation
  },

  // WRITEPC state - update PC for jumps
  // Note: wrPC and muxPC are set conditionally based on opcode and flags
  [CpuState.WRITEPC]: {
    // Signals set conditionally in emitSignals
  },
};

/**
 * Signals a state writes only to put a line back at rest ("limpeza") — not
 * what the state is for. They still get written every time, but when the line
 * was already at that value nothing actually happened on it, so the control
 * unit doesn't light its dot (see `getDrivenControlSignalPorts`). Every other
 * signal a state writes lights whether or not its value changed.
 */
export const STATE_CLEANUP_SIGNALS: Readonly<Partial<Record<CpuState, (keyof ControlSignals)[]>>> = {
  [CpuState.FETCH]:     ["wrReg", "muxAReg", "muxDReg", "rdMem", "wrMem", "opULA"],
  [CpuState.DECODE]:    ["wrPC", "wrIR"],
  [CpuState.WRITEREG1]: ["rdMem"],
  [CpuState.WRITEREG3]: ["opULA"],
};

/** Z/C/N/V as one record. */
export interface UlaFlags {
  zero: boolean;
  carry: boolean;
  negative: boolean;
  overflow: boolean;
}

const NO_FLAGS: Readonly<UlaFlags> = { zero: false, carry: false, negative: false, overflow: false };

/**
 * Component registry entry for step-based ticking.
 */
export interface RegisteredComponent {
  id: string;
  type: string;
  component: Clockable;
  /** Animation-only state mask (does not gate functional ticking). */
  tickSteps: CpuState[];
  /** Optional animation substep order by CPU state. Lower runs first. */
  tickOrderByState: Partial<Record<CpuState, number>>;
}

export interface CpuInternalStateSnapshot {
  state: CpuState;
  fsmIndex: number;
  halted: boolean;
  totalTicks: number;
  previousState: CpuState;
  /** The control unit's status flags — set by ULA operations and by LDA/LDAI (Z, N). */
  latchedFlagZero: boolean;
  latchedFlagCarry: boolean;
  latchedFlagNegative: boolean;
  latchedFlagOverflow: boolean;
  /** The ULA's own flags — set only by ULA operations (EXECUTE). */
  ulaFlags?: UlaFlags;
  /** Control output port names the executed state wrote (see `getDrivenControlSignalPorts`). */
  drivenSignals: string[];
}


/**
 * CPU control unit.
 *
 * Implements a finite state machine that sequences through instruction phases
 * and drives control signals to other components via output ports.
 * 
 * The CPU owns the clock: each `tick()` runs one FSM state and then evaluates
 * and commits every registered component. Per-component tick steps only drive
 * the animation (see `registerComponent`).
 *
 * Ports:
 * - in_opcode (5-bit): The decoded opcode from the Decoder
 * - in_flags (4-bit): The ULA's flags bus, Z C N V (see `FLAG_BITS`)
 * - in_flagZeroGpr (1-bit, hidden): Zero flag from the GPR's write-data bus
 *   (LDA/LDAI loading a zero value)
 * - in_flagNegativeGpr (1-bit, hidden): Negative flag from the GPR's
 *   write-data bus (LDA/LDAI loading a negative value)
 * - out_wrReg, out_muxAReg, out_muxDReg, etc.: Control signal outputs
 * - out_state (4-bit, hidden): Current FSM state
 * - out_halted (1-bit, hidden): High once the CPU has halted
 *
 * Two flag sets are kept. The ULA's own flags (`ulaFlags`) change only when
 * the ULA operates. The control unit's flags (`latchedFlag*`, what the jumps
 * read) change on ULA operations too, and also on LDA/LDAI (Z/N) — which is
 * effectively an OR between the ULA's flags and the GPR's:
 * `latchFlagsIfProduced()` samples whichever source's operation just
 * finished (ULA after EXECUTE, GPR after a LDA/LDAI write commits in
 * WRITEREG1/WRITEREG2), so a flag left over on the *other* input from an
 * earlier, unrelated instruction never bleeds into the freshly latched value.
 */
export class CPU implements Clockable, Connectable {
  readonly id: string;
  name: string;

  // FSM state - the state the next tick will execute
  private _state: CpuState = CpuState.FETCH;
  private _FSMindex: number = 0;
  private _halted: boolean = false;

  // Clock tick counter
  private _totalTicks: number = 0;

  // Registered components for step-based ticking
  private _registeredComponents: Map<string, RegisteredComponent> = new Map();

  // Control output port names that changed in the most recent tick.
  private _changedControlSignalPorts: Set<string> = new Set();

  // Control output port names the executed state wrote, changed or not.
  private _drivenControlSignalPorts: Set<string> = new Set();
  
  // Track the state that was just executed (whose signals are currently active)
  private _previousState: CpuState = CpuState.RESET;

  // The control unit's flags (from the ULA on EXECUTE, Z/N also from LDA/LDAI)
  private _latchedFlagZero: boolean = false;
  private _latchedFlagCarry: boolean = false;
  private _latchedFlagNegative: boolean = false;
  private _latchedFlagOverflow: boolean = false;

  // The ULA's own flags (captured on EXECUTE only)
  private _ulaFlags: UlaFlags = { ...NO_FLAGS };

  // Testing mode: force a specific opcode
  private _testingModeOpcode: Opcode | null = null;
  private _testingModeEnabled: boolean = false;

  // ── Input Ports ──────────────────────────────────────────────
  readonly in_opcode: InputPort<number>;
  readonly in_flags: InputPort<number>;
  readonly in_flagZeroGpr: InputPort<number>;
  readonly in_flagNegativeGpr: InputPort<number>;

  // ── Output Ports (Control Signals) ───────────────────────────
  readonly out_wrIR: OutputPort<number>;
  readonly out_muxAReg: OutputPort<number>;
  readonly out_muxDReg: OutputPort<number>;
  readonly out_wrPC: OutputPort<number>;
  readonly out_muxPC: OutputPort<number>;
  readonly out_rdMem: OutputPort<number>;
  readonly out_wrMem: OutputPort<number>;
  readonly out_wrReg: OutputPort<number>;
  readonly out_opULA: OutputPort<number>;
  readonly out_state: OutputPort<number>;
  readonly out_halted: OutputPort<boolean>;

  constructor(id: string, name: string = "CPU") {
    this.id = id;
    this.name = name;

    // Input ports
    this.in_opcode = new InputPort<number>("in_opcode", "opcode", 5, Opcode.HLT);
    this.in_flags = new InputPort<number>("in_flags", "number", 4, 0);
    this.in_flagZeroGpr = new InputPort<number>("in_flagZeroGpr", "number", 1, 0);
    this.in_flagNegativeGpr = new InputPort<number>("in_flagNegativeGpr", "number", 1, 0);

    // Control signal output ports
    this.out_wrIR = new OutputPort<number>("out_wrIR", "number", 1, 0);
    this.out_muxAReg = new OutputPort<number>("out_muxAReg", "number", 1, 1);
    this.out_muxDReg = new OutputPort<number>("out_muxDReg", "number", 2, 2);
    this.out_wrPC = new OutputPort<number>("out_wrPC", "number", 1, 0);
    this.out_muxPC = new OutputPort<number>("out_muxPC", "number", 1, 1);
    this.out_rdMem = new OutputPort<number>("out_rdMem", "number", 1, 0);
    this.out_wrMem = new OutputPort<number>("out_wrMem", "number", 1, 0);
    this.out_wrReg = new OutputPort<number>("out_wrReg", "number", 1, 0);
    this.out_opULA = new OutputPort<number>("out_opULA", "number", 3, UlaOperation.ADD);
    this.out_state = new OutputPort<number>("out_state", "number", 4, CpuState.RESET);
    this.out_halted = new OutputPort<boolean>("out_halted", "boolean", 1, false);

    this.resetLatchedFlags();
  }

  // ── Component Registration ───────────────────────────────────

  /**
   * Register a component for CPU-managed ticking.
   *
   * Note: `tickSteps` and `tickOrderByState` are animation metadata only.
   * Functional ticking is global for all registered components each CPU tick.
   */
  registerComponent(
    id: string,
    type: string,
    component: Clockable,
    customTickSteps?: CpuState[],
    customTickOrderByState?: Partial<Record<CpuState, number>>
  ): void {
    const defaultSteps = DEFAULT_TICK_STEPS[type] ?? ALL_CPU_STATES;
    this._registeredComponents.set(id, {
      id,
      type,
      component,
      tickSteps: customTickSteps ?? [...defaultSteps],
      tickOrderByState: customTickOrderByState ?? {},
    });
  }

  /**
   * Unregister a component.
   */
  unregisterComponent(id: string): void {
    this._registeredComponents.delete(id);
  }

  /**
   * Get animation steps for a registered component.
   */
  getComponentTickSteps(id: string): CpuState[] | undefined {
    return this._registeredComponents.get(id)?.tickSteps;
  }

  /**
   * Set animation steps for a registered component.
   */
  setComponentTickSteps(id: string, steps: CpuState[]): void {
    const entry = this._registeredComponents.get(id);
    if (entry) {
      entry.tickSteps = [...steps];
    }
  }

  /**
   * Get per-state animation substep order for a registered component.
   */
  getComponentTickOrderByState(id: string): Partial<Record<CpuState, number>> | undefined {
    return this._registeredComponents.get(id)?.tickOrderByState;
  }

  /**
   * Set per-state animation substep order for a registered component.
   */
  setComponentTickOrderByState(id: string, orderByState: Partial<Record<CpuState, number>>): void {
    const entry = this._registeredComponents.get(id);
    if (!entry) return;

    const normalized: Partial<Record<CpuState, number>> = {};
    for (const [stateKey, rawOrder] of Object.entries(orderByState)) {
      const parsedState = Number(stateKey) as CpuState;
      const parsedOrder = Number(rawOrder);
      if (!Number.isFinite(parsedOrder)) continue;
      normalized[parsedState] = Math.max(0, Math.floor(parsedOrder));
    }

    entry.tickOrderByState = normalized;
  }

  /**
   * Get all registered components.
   */
  getRegisteredComponents(): RegisteredComponent[] {
    return Array.from(this._registeredComponents.values());
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    return {
      in_opcode: this.in_opcode,
      in_flags: this.in_flags,
      in_flagZeroGpr: this.in_flagZeroGpr,
      in_flagNegativeGpr: this.in_flagNegativeGpr,
      out_muxPC: this.out_muxPC,
      out_wrPC: this.out_wrPC,
      out_wrIR: this.out_wrIR,
      out_rdMem: this.out_rdMem,
      out_wrMem: this.out_wrMem,
      out_muxAReg: this.out_muxAReg,
      out_muxDReg: this.out_muxDReg,
      out_wrReg: this.out_wrReg,
      out_opULA: this.out_opULA,
      out_state: this.out_state,
      out_halted: this.out_halted,
    };
  }

  // ── Accessors ────────────────────────────────────────────────

  get state(): CpuState {
    return this._state;
  }
  
  get previousState(): CpuState {
    return this._previousState;
  }

  get halted(): boolean {
    return this._halted;
  }

  get totalTicks(): number {
    return this._totalTicks;
  }

  get fsmIndex(): number {
    return this._FSMindex;
  }

  /**
   * The control unit's flags, what the jumps read. These behave like a status
   * register — cleared at reset, updated when a ULA operation runs (all four)
   * or a LDA/LDAI writes the GPR (Z and N only), and held otherwise — which is
   * what the flag displays should show instead of the ULA's live outputs.
   */
  get latchedFlagZero(): boolean {
    return this._latchedFlagZero;
  }

  get latchedFlagCarry(): boolean {
    return this._latchedFlagCarry;
  }

  get latchedFlagNegative(): boolean {
    return this._latchedFlagNegative;
  }

  get latchedFlagOverflow(): boolean {
    return this._latchedFlagOverflow;
  }

  /** The ULA's own flags, as of its last operation (LDA/LDAI never touch them). */
  get ulaFlags(): Readonly<UlaFlags> {
    return this._ulaFlags;
  }

  /**
   * Returns CPU control output port names that changed on the latest tick.
   * Example values: "out_wrIR", "out_rdMem".
   */
  getChangedControlSignalPorts(): string[] {
    return Array.from(this._changedControlSignalPorts);
  }

  /**
   * Returns CPU control output port names the executed state wrote, whether
   * or not the value changed — a signal the state drives to 0 is still one it
   * drives — except cleanup writes that left the line as it was (see
   * `STATE_CLEANUP_SIGNALS`). This is what the control unit's signal dots show.
   */
  getDrivenControlSignalPorts(): string[] {
    return Array.from(this._drivenControlSignalPorts);
  }

  /** Set testing mode opcode - keeps in_opcode locked to this value. */
  setTestingModeOpcode(opcode: Opcode | null): void {
    this._testingModeOpcode = opcode;
    this._testingModeEnabled = opcode !== null;
    if (opcode !== null) {
      this.in_opcode.set(opcode);
    }
  }

  /** Get the current testing mode opcode, or null if disabled. */
  getTestingModeOpcode(): Opcode | null {
    return this._testingModeOpcode;
  }

  /** Returns opcode source, honoring testing mode override when enabled. */
  private getActiveOpcode(): Opcode {
    if (this._testingModeEnabled && this._testingModeOpcode !== null) {
      return this._testingModeOpcode;
    }
    return this.in_opcode.get() as Opcode;
  }

  /** Keeps the opcode input port aligned with testing mode selection. */
  private syncTestingOpcodeInput(): void {
    if (this._testingModeEnabled && this._testingModeOpcode !== null) {
      this.in_opcode.set(this._testingModeOpcode);
    }
  }

  /** Put every control signal at rest (the RESET configuration) and leave the CPU in FETCH. */
  reset(): void {
    this._state = CpuState.RESET;
    this._previousState = CpuState.RESET;
    this._FSMindex = 0;
    this._halted = false;
    this._totalTicks = 0;
    this._changedControlSignalPorts.clear();
    this.resetLatchedFlags();
    // Apply RESET state control signals immediately
    this.emitSignals(CpuState.RESET, Opcode.HLT, true);
    // RESET only restores defaults — no state has driven anything yet.
    this._drivenControlSignalPorts.clear();
    this.out_state.set(CpuState.RESET);
    this.out_halted.set(false);
    // After reset, the next state should be FETCH
    this._state = CpuState.FETCH;
  }

  /** Restore internal FSM fields for timeline replay without re-ticking. */
  restoreInternalState(snapshot: CpuInternalStateSnapshot): void {
    this._state = snapshot.state;
    this._FSMindex = snapshot.fsmIndex;
    this._halted = snapshot.halted;
    this._totalTicks = snapshot.totalTicks;
    this._previousState = snapshot.previousState;
    this.out_state.set(snapshot.state);
    this.out_halted.set(snapshot.halted);
    // Restore the latched flags from the snapshot rather than re-reading the
    // ULA's live outputs — during replay those reflect whatever is on the wire
    // now, not what was latched on the EXECUTE this frame belongs to.
    this._latchedFlagZero = snapshot.latchedFlagZero ?? false;
    this._latchedFlagCarry = snapshot.latchedFlagCarry ?? false;
    this._latchedFlagNegative = snapshot.latchedFlagNegative ?? false;
    this._latchedFlagOverflow = snapshot.latchedFlagOverflow ?? false;
    this._ulaFlags = { ...(snapshot.ulaFlags ?? NO_FLAGS) };
    this._drivenControlSignalPorts = new Set(snapshot.drivenSignals ?? []);
  }

  /**
   * Restore only the ULA's own flags. The timeline replays a tick with the FSM
   * already on its post-tick state but the flags still on their old values,
   * and moves each flag set forward only when the data that produces it
   * arrives — see `displayMaskStore`.
   */
  restoreUlaFlags(flags: Readonly<UlaFlags> | undefined): void {
    this._ulaFlags = { ...(flags ?? NO_FLAGS) };
  }

  /** Restore only the control unit's flags — same reasoning as `restoreUlaFlags`. */
  restoreLatchedFlags(
    snapshot: Pick<
      CpuInternalStateSnapshot,
      "latchedFlagZero" | "latchedFlagCarry" | "latchedFlagNegative" | "latchedFlagOverflow"
    >,
  ): void {
    this._latchedFlagZero = snapshot.latchedFlagZero ?? false;
    this._latchedFlagCarry = snapshot.latchedFlagCarry ?? false;
    this._latchedFlagNegative = snapshot.latchedFlagNegative ?? false;
    this._latchedFlagOverflow = snapshot.latchedFlagOverflow ?? false;
  }

  /**
   * Set a signal only if it has changed from its previous value.
   *
   * Compares against the port's own current value — not a separately
   * tracked copy — so this can never desync from it. A tracked copy (this
   * used to keep one in `_prevSignals`, initialized to hardcoded defaults)
   * goes stale the moment anything outside this method writes the port
   * directly: loading a project file restores its own saved port values,
   * and the timeline's progressive-reveal system resets ports to older
   * values while animating. Either one leaves the tracked copy pointing at
   * a value the port no longer holds, so the next real signal change that
   * happens to match the *stale tracked* value gets skipped here — the port
   * silently keeps whatever the external write left it at. That is exactly
   * how `out_opULA` could get stuck showing a stale operation: a loaded
   * project's saved value never matched the hardcoded tracked default, so
   * the first real EXECUTE that coincidentally computed that same default
   * value never actually wrote the port.
   */
  private setSignalIfChanged<T extends number | boolean>(
    port: OutputPort<T>,
    value: T,
    force_update: boolean = false
  ): void {
    const prevValue = port.value;
    this._drivenControlSignalPorts.add(port.name);
    if (prevValue !== value) {
      this._changedControlSignalPorts.add(port.name);
    }

    if (prevValue !== value || force_update) {
      port.set(value);
    }
  }

  // ── Tick orchestration ───────────────────────────────────────

  /**
   * Main tick method that advances the CPU state and ticks all components.
   * Execution is phased to avoid order-sensitive race behavior.
   */
  tick(): void {
    this.syncTestingOpcodeInput();
    this._totalTicks++;

    // Refresh decoder outputs before state logic so DECODE reads the latest opcode
    // produced from the IR value latched on the previous tick.
    this.refreshInputsBeforeStateLogic();

    // First, execute the CPU's own state logic (emits signals and transitions to next state)
    this.onTick();

    // HLT cycles affect only the CPU control unit.
    if (this._halted) {
      return;
    }

    // Pipeline registers (A, B) only latch during READREG states.
    // GPR outputs are always combinational; the latches are what is gated.
    const isReadReg =
      this._previousState === CpuState.READREG1 ||
      this._previousState === CpuState.READREG2;
    // A register fed by the ULA result (R) only latches on EXECUTE, so it keeps
    // the result after opULA drops back to ADD in WRITEREG3/FETCH.
    const isExecute = this._previousState === CpuState.EXECUTE;
    const ulaResults = this.ulaResultPorts();
    for (const entry of this._registeredComponents.values()) {
      const gated = entry.component as unknown as {
        setWriteActive?: (a: boolean) => void;
        in_data?: InputPort<number>;
      };
      if (entry.type === "PipelineRegister") {
        gated.setWriteActive?.(isReadReg);
      } else if (entry.type === "Register" && gated.in_data?.source && ulaResults.has(gated.in_data.source)) {
        gated.setWriteActive?.(isExecute);
      }
    }

    this.tickAllComponentsPhased();

    // Latch status flags right after whichever source just produced them.
    this.latchFlagsIfProduced();
  }

  /**
   * Refresh combinational producers that feed CPU input ports used by state logic.
   *
   * Most importantly, the Decoder must run before DECODE so `in_opcode`
   * reflects the current IR value.
   */
  private refreshInputsBeforeStateLogic(): void {
    // In testing mode, opcode is forced directly and does not depend on Decoder output.
    if (this._testingModeEnabled && this._testingModeOpcode !== null) {
      return;
    }

    for (const entry of this._registeredComponents.values()) {
      if (entry.type === "DecoderComponent") {
        this.runEvaluate(entry.component);
      }
    }
  }

  /**
   * Tick all registered components in two phases:
   * 1) evaluate combinational logic (repeated until it settles)
   * 2) commit sequential state updates
   *
   * Components evaluate in registration order, which is the order they appear in
   * the project file and therefore not guaranteed to follow the dataflow — the
   * PC+1 incrementer must run before MuxPC for the PC loop to close within one tick.
   * The evaluate pass is repeated until every output port stops changing, which
   * is safe because all `evaluate()` implementations are pure.
   */
  private tickAllComponentsPhased(): void {
    const entries = Array.from(this._registeredComponents.values());

    let signature = this.outputSignature(entries);
    for (let pass = 0; pass < MAX_EVALUATE_PASSES; pass++) {
      for (const entry of entries) {
        this.runEvaluate(entry.component);
      }

      const settled = this.outputSignature(entries);
      if (settled === signature) break;
      signature = settled;
    }

    for (const entry of entries) {
      this.runCommit(entry.component);
    }
  }

  /**
   * Snapshot of every registered component's output port values, used to detect
   * that the combinational phase has settled.
   */
  private outputSignature(entries: RegisteredComponent[]): string {
    const parts: string[] = [];

    for (const entry of entries) {
      const connectable = entry.component as unknown as { getPorts?: () => PortMap };
      if (typeof connectable.getPorts !== "function") continue;

      for (const [key, port] of Object.entries(connectable.getPorts())) {
        if (port.direction === "output") {
          parts.push(`${entry.id}.${key}=${String(port.value)}`);
        }
      }
    }

    return parts.join("|");
  }

  private runEvaluate(component: Clockable): void {
    const phased = component as Clockable & { evaluate?: () => void; commit?: () => void };

    if (typeof phased.evaluate === "function") {
      phased.evaluate();
      return;
    }

    // Legacy components that only implement onTick continue to work.
    if (typeof phased.commit !== "function") {
      component.onTick();
    }
  }

  private runCommit(component: Clockable): void {
    const phased = component as Clockable & { commit?: () => void };
    if (typeof phased.commit === "function") {
      phased.commit();
    }
  }

  // ── Clockable callback ───────────────────────────────────────

  /**
   * Run the FSM for one tick (called by `tick()` before the components run).
   *
   * The pipeline is:
   *   FETCH → DECODE → (opcode-specific states driven by _FSMindex) → back to FETCH
   *
   * FETCH and DECODE are two fixed ticks.
   * After DECODE the opcode is known; subsequent ticks walk _FSMindex through
   * the per-opcode step array until it is exhausted, then return to FETCH.
   * HLT and invalid opcodes go to HALT, where the CPU stays until reset.
   */
  onTick(): void {
    switch (this._state) {
      case CpuState.FETCH:
        this.doFetch();
        break;

      case CpuState.DECODE:
        this.doDecode();
        break;

      case CpuState.HALT:
        this.doHalt();
        break;

      default:
        this.doStep();
        break;
    }

    this.out_state.set(this._state);
    this.out_halted.set(this._halted);
  }

  // ── Fixed phases ─────────────────────────────────────────────

  /** Tick 1 – IR ← IMem[PC] and PC ← PC+1, both latched on this tick. */
  private doFetch(): void {
    // Emit FETCH state signals
    this.emitSignals(CpuState.FETCH, this.getActiveOpcode(), true);
    // Track that we executed FETCH
    this._previousState = CpuState.FETCH;
    this._state = CpuState.DECODE;
  }

  /**
   * Tick 2 – the instruction is latched in IR (and PC already holds PC+1, from
   * FETCH); the opcode is now visible on `in_opcode`. Decide which first
   * execution state to enter.
   */
  private doDecode(): void {
    // Emit DECODE state signals
    const opcode = this.getActiveOpcode();
    this.emitSignals(CpuState.DECODE, opcode);
    // Track that we executed DECODE
    this._previousState = CpuState.DECODE;

    const sequence = OPCODE_SEQUENCES[opcode];
    
    if (opcode === Opcode.HLT || !sequence || sequence.length === 0) {
      // Enter explicit HALT state; it becomes the executed state on the next tick.
      this._state = CpuState.HALT;
      return;
    }

    // Enter the first execution state from the sequence
    this._FSMindex = 0;
    this._state = sequence[0];
  }

  /**
   * Ticks 3…N – step through the per-opcode state sequence.
   * `_state` already holds the current step's CpuState; `_FSMindex` tracks
   * which step within the sequence we are on.
   */
  private doStep(): void {
    const opcode = this.getActiveOpcode();
    const currentExecutingState = this._state;

    // Emit control signals for the current state
    this.emitSignals(currentExecutingState, opcode);
    // Track that we executed this state
    this._previousState = currentExecutingState;

    // Advance to next step in the sequence
    const sequence = OPCODE_SEQUENCES[opcode];
    const nextIndex = this._FSMindex + 1;

    if (!sequence || nextIndex >= sequence.length) {
      // Sequence finished → back to FETCH
      this._FSMindex = 0;
      this._state = CpuState.FETCH;
    } else {
      this._FSMindex = nextIndex;
      this._state = sequence[nextIndex];
    }
  }

  /** HALT state - CPU remains halted until reset. */
  private doHalt(): void {
    this._changedControlSignalPorts.clear();
    this._drivenControlSignalPorts.clear();
    this._previousState = CpuState.HALT;
    this._halted = true;
    this._state = CpuState.HALT;
  }

  // ── Signal emission ───────────────────────────────────────────

  /**
   * Given the current CpuState and the active opcode, drive the appropriate
   * control signals for this clock tick.
   * 
   * Uses STATE_CONTROL_SIGNALS configuration for most states, with special
   * handling for EXECUTE (opcode-dependent ULA operation) and WRITEPC (conditional jumps).
   */
  private emitSignals(state: CpuState, opcode: Opcode, force_write: boolean = false): void {
    // Recomputed once per CPU tick/state emission.
    this._changedControlSignalPorts.clear();
    this._drivenControlSignalPorts.clear();

    // Get base configuration for this state
    const config = STATE_CONTROL_SIGNALS[state];
    
    if (!config) {
      // No configuration for this state - no signals to emit
      return;
    }

    // Apply all configured signals
    if (config.wrReg !== undefined) {
      this.setSignalIfChanged(this.out_wrReg, config.wrReg, force_write);
    }
    if (config.muxAReg !== undefined) {
      this.setSignalIfChanged(this.out_muxAReg, config.muxAReg, force_write);
    }
    if (config.muxDReg !== undefined) {
      this.setSignalIfChanged(this.out_muxDReg, config.muxDReg, force_write);
    }
    if (config.wrPC !== undefined) {
      this.setSignalIfChanged(this.out_wrPC, config.wrPC, force_write);
    }
    if (config.muxPC !== undefined) {
      this.setSignalIfChanged(this.out_muxPC, config.muxPC, force_write);
    }
    if (config.rdMem !== undefined) {
      this.setSignalIfChanged(this.out_rdMem, config.rdMem, force_write);
    }
    if (config.wrMem !== undefined) {
      this.setSignalIfChanged(this.out_wrMem, config.wrMem, force_write);
    }
    if (config.wrIR !== undefined) {
      this.setSignalIfChanged(this.out_wrIR, config.wrIR, force_write);
    }

    // Special handling for state-specific logic
    switch (state) {
      case CpuState.EXECUTE:
        // EXECUTE: set ULA operation based on opcode
        this.setSignalIfChanged(this.out_opULA, this.opcodeToUlaOp(opcode));
        break;

      case CpuState.WRITEPC: {
        // WRITEPC: conditionally update PC based on opcode and flags
        const taken =
          opcode === Opcode.JMP ||
          (opcode === Opcode.JZ && this._latchedFlagZero) ||
          (opcode === Opcode.JN && this._latchedFlagNegative);

        if (taken) {
          this.setSignalIfChanged(this.out_wrPC, 1);
          this.setSignalIfChanged(this.out_muxPC, 0); // branch target (MAR)
        }
        break;
      }

      default:
        // For other states, apply opULA if configured
        if (config.opULA !== undefined) {
          this.setSignalIfChanged(this.out_opULA, config.opULA);
        }
        break;
    }

    // A cleanup write that found the line already at rest didn't do anything.
    for (const name of STATE_CLEANUP_SIGNALS[state] ?? []) {
      const portName = `out_${name}`;
      if (!this._changedControlSignalPorts.has(portName)) {
        this._drivenControlSignalPorts.delete(portName);
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  /** The result output port of every registered ULA. */
  private ulaResultPorts(): Set<OutputPort<number>> {
    const ports = new Set<OutputPort<number>>();
    for (const entry of this._registeredComponents.values()) {
      if (entry.type !== "UlaComponent") continue;
      const result = (entry.component as unknown as { out_result?: OutputPort<number> }).out_result;
      if (result) ports.add(result);
    }
    return ports;
  }

  private opcodeToUlaOp(opcode: Opcode): UlaOperation {
    return OPCODE_TO_ULA_OP[opcode] ?? UlaOperation.ADD;
  }

  private resetLatchedFlags(): void {
    this._latchedFlagZero = false;
    this._latchedFlagCarry = false;
    this._latchedFlagNegative = false;
    this._latchedFlagOverflow = false;
    this._ulaFlags = { ...NO_FLAGS };
  }

  /**
   * Refreshes the latched Z/C/N/V flags right after whichever operation just
   * produced fresh ones — the ULA after EXECUTE (arithmetic/logic ops), or
   * the GPR after a load commits in WRITEREG1/WRITEREG2 (LDA/LDAI). Each
   * branch only reads the source that just fired, so a flag left over on the
   * *other* input from an earlier, unrelated instruction (the ULA's operands
   * hold their last value between EXECUTEs; the GPR's write bus is whatever
   * was last written) never bleeds into the freshly latched value — which is
   * what makes this equivalent to an OR between the ULA's flag and the
   * GPR's, without either one going stale. The ULA's own flags follow the
   * first branch only.
   */
  private latchFlagsIfProduced(): void {
    if (this._previousState === CpuState.EXECUTE) {
      const bus = this.in_flags.get();
      const bit = (b: number) => ((bus >> b) & 1) === 1;
      this._ulaFlags = {
        zero: bit(FLAG_BITS.zero),
        carry: bit(FLAG_BITS.carry),
        negative: bit(FLAG_BITS.negative),
        overflow: bit(FLAG_BITS.overflow),
      };
      this._latchedFlagZero = this._ulaFlags.zero;
      this._latchedFlagCarry = this._ulaFlags.carry;
      this._latchedFlagNegative = this._ulaFlags.negative;
      this._latchedFlagOverflow = this._ulaFlags.overflow;
    } else if (
      this._previousState === CpuState.WRITEREG1 ||
      this._previousState === CpuState.WRITEREG2
    ) {
      // LDA/LDAI don't touch carry or overflow — only the ULA can set them.
      this._latchedFlagZero = Boolean(this.in_flagZeroGpr.get());
      this._latchedFlagNegative = Boolean(this.in_flagNegativeGpr.get());
    }
  }
}
