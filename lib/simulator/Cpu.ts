import type { Clockable } from "./Clockable";
import { Opcode, UlaOperation, OPCODE_TO_ULA_OP } from "./ISA";
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

export const CONTROL_SIGNAL_DEFS: ControlSignalDef[] = [
  { name: "wrReg", bitWidth: 1, description: "Write enable for GPR" },
  { name: "muxAReg", bitWidth: 1, description: "GPR address mux select" },
  { name: "muxDReg", bitWidth: 2, description: "GPR data mux select" },
  { name: "wrPC", bitWidth: 1, description: "Write enable for PC" },
  { name: "muxPC", bitWidth: 1, description: "PC source mux select" },
  { name: "rdMem", bitWidth: 1, description: "Memory read enable" },
  { name: "wrMem", bitWidth: 1, description: "Memory write enable" },
  { name: "muxAMem", bitWidth: 1, description: "Memory address mux select" },
  { name: "wrIR", bitWidth: 1, description: "Write enable for IR" },
  { name: "opULA", bitWidth: 3, description: "ULA operation select" },
];

/**
 * Maps each opcode to its ordered sequence of CpuState steps that execute
 * after FETCH+DECODE.
 *
 * - `null`  → no extra states needed (instruction finishes inside DECODE tick)
 * - array   → steps executed one per clock tick, in order; CPU returns to FETCH
 *             when the last step is done.
 */
export const OPCODE_SEQUENCES: Readonly<Partial<Record<Opcode, CpuState[]>>> = {
  [Opcode.LDA]:  [CpuState.READMEM,  CpuState.WRITEREG1],
  [Opcode.LDAI]: [CpuState.WRITEREG2],
  [Opcode.STA]:  [CpuState.READREG1, CpuState.WRITEMEM],
  [Opcode.ADD]:  [CpuState.READREG2, CpuState.EXECUTE,  CpuState.WRITEREG3],
  [Opcode.SUB]:  [CpuState.READREG2, CpuState.EXECUTE,  CpuState.WRITEREG3],
  [Opcode.AND]:  [CpuState.READREG2, CpuState.EXECUTE,  CpuState.WRITEREG3],
  [Opcode.OR]:   [CpuState.READREG2, CpuState.EXECUTE,  CpuState.WRITEREG3],
  [Opcode.NOT]:  [CpuState.EXECUTE,  CpuState.WRITEREG3],
  [Opcode.JZ]:   [CpuState.WRITEPC],
  [Opcode.JC]:   [CpuState.WRITEPC],
  [Opcode.JN]:   [CpuState.WRITEPC],
  [Opcode.JMP]:  [CpuState.WRITEPC],
  // HLT and unknown opcodes handled specially in doDecode()
};

/**
 * Control signal configuration for each CPU state.
 * Defines which control signals are active and their values for each state.
 * 
 * Signal values:
 * - wrReg: 0=no write, 1=write to GPR
 * - muxAReg: 0=use GPR address from IR, 1=other source
 * - muxDReg: 0=immediate operand, 1=memory data, 2=ULA result
 * - wrPC: 0=no write, 1=write to PC
 * - muxPC: 0=PC+1 (adder), 1=operand (jump target)
 * - rdMem: 0=no read, 1=read from memory
 * - wrMem: 0=no write, 1=write to memory
 * - muxAMem: 0=operand as address, 1=PC as address
 * - wrIR: 0=no write, 1=write to IR
 * - opULA: ULA operation code (see UlaOperation enum)
 */
export interface ControlSignals {
  wrReg?: number;
  muxAReg?: number;
  muxDReg?: number;
  wrPC?: number;
  muxPC?: number;
  rdMem?: number;
  wrMem?: number;
  muxAMem?: number;
  wrIR?: number;
  opULA?: number;
}

/**
 * Default control signal values (inactive/reset state).
 * These values define the RESET state configuration.
 * Note: Mux signals have non-zero defaults to select appropriate data paths.
 */
export const DEFAULT_CONTROL_SIGNALS: Readonly<ControlSignals> = {
  wrReg: 0,
  muxAReg: 1,              // Default mux selection
  muxDReg: 2,              // Default mux selection
  wrPC: 0,
  muxPC: 1,                // Default mux selection
  rdMem: 0,
  wrMem: 0,
  muxAMem: 1,              // Default mux selection
  wrIR: 0,
  opULA: UlaOperation.ADD, // Default ULA operation
};

/**
 * Control signal configurations for each CPU state.
 * Only non-zero signals need to be specified; undefined signals default to 0.
 * 
 * Complete CPU State Machine Control Signal Map:
 * ┌──────────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────┬─────┬─────┐
 * │ State        │wrReg│muxAR│muxDR│wrPC │muxPC│rdMem│wrMem│muxAMem│wrIR │opULA│
 * ├──────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼───────┼─────┼─────┤
 * │ RESET        │  0  │  1  │  2  │  0  │  1  │  0  │  0  │   1   │  0  │ ADD │
 * │ FETCH        │  -  │  1  │  2  │  1  │  1  │  1  │  0  │   -   │  1  │  -  │
 * │ DECODE       │  -  │  -  │  -  │  0  │  -  │  -  │  -  │   -   │  0  │  -  │
 * │ READMEM      │  -  │  0  │  1  │  -  │  -  │  1  │  -  │   0   │  -  │  -  │
 * │ WRITEREG1    │  1  │  -  │  -  │  -  │  -  │  0  │  -  │   -   │  -  │  -  │
 * │ WRITEREG2    │  1  │  0  │  0  │  -  │  -  │  -  │  -  │   -   │  -  │  -  │
 * │ READREG1     │  -  │  -  │  -  │  -  │  -  │  -  │  -  │   0   │  -  │  -  │
 * │ WRITEMEM     │  -  │  -  │  -  │  -  │  -  │  -  │  1  │   -   │  -  │  -  │
 * │ READREG2     │  -  │  -  │  -  │  -  │  -  │  -  │  -  │   -   │  -  │  -  │
 * │ EXECUTE      │  -  │  -  │  -  │  -  │  -  │  -  │  -  │   -   │  -  │ dyn │
 * │ WRITEREG3    │  1  │  -  │  -  │  -  │  -  │  -  │  -  │   -   │  -  │ ADD │
 * │ WRITEPC      │  -  │  -  │  -  │cond │cond │  -  │  -  │   -   │  -  │  -  │
 * └──────────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴───────┴─────┴─────┘
 * Legend: - = not set (defaults to 0), dyn = dynamic (opcode-dependent), 
 *         cond = conditional (flag-dependent), ADD = UlaOperation.ADD
 * 
 * Special cases:
 * - RESET: Uses DEFAULT_CONTROL_SIGNALS for inactive state
 *          Mux signals are set to their default positions, not zero
 * - FETCH: Handled by doFetch(), reads instruction from memory into IR
 * - DECODE: Handled by doDecode(), determines next state based on opcode
 * - EXECUTE: opULA value set dynamically based on instruction opcode
 * - WRITEPC: wrPC and muxPC set conditionally based on opcode and flags
 */
export const STATE_CONTROL_SIGNALS: Readonly<Partial<Record<CpuState, ControlSignals>>> = {
  // RESET state - all signals inactive (cleared)
  [CpuState.RESET]: DEFAULT_CONTROL_SIGNALS,

  // FETCH state - read instruction from memory[PC] into IR
  [CpuState.FETCH]: {
    wrPC: 1,      // Enable PC write (PC will increment)
    wrIR: 1,      // Enable IR write (latch instruction)
    wrMem: 0,     // Disable memory write
    muxPC: 1,     // Select PC as source (for next instruction)
    muxAReg: 1,   // Select address for register
    muxDReg: 2,   // Select data for register
    rdMem: 1,     // Enable memory read (implicit from setting rdMem port)
  },

  // DECODE state - instruction latched, PC incremented
  [CpuState.DECODE]: {
    wrPC: 0,      // Disable PC write
    wrIR: 0,      // Disable IR write
  },
  
  // READMEM state - read from memory (used by LDA)
  [CpuState.READMEM]: {
    rdMem: 1,
    muxAMem: 0,   // operand as memory address
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

  // READREG1 state - read from GPR (used by STA)
  [CpuState.READREG1]: {
    muxAMem: 0,   // operand as memory address
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
    opULA: UlaOperation.ADD, // default to ADD for non-ULA ops
  },

  // WRITEPC state - update PC for jumps
  // Note: wrPC and muxPC are set conditionally based on opcode and flags
  [CpuState.WRITEPC]: {
    // Signals set conditionally in emitSignals
  },
};

/**
 * Component registry entry for step-based ticking.
 */
export interface RegisteredComponent {
  id: string;
  type: string;
  component: Clockable;
  tickSteps: CpuState[];
}


/**
 * CPU control unit.
 *
 * Implements a finite state machine that sequences through instruction phases
 * and drives control signals to other components via output ports.
 * 
 * The CPU now owns the clock and controls when each registered component ticks
 * based on the current execution state.
 *
 * Ports:
 * - in_opcode (5-bit): The decoded opcode from the Decoder
 * - in_flagZero (1-bit): Zero flag from ULA
 * - in_flagCarry (1-bit): Carry flag from ULA
 * - in_flagNegative (1-bit): Negative flag from ULA
 * - out_wrReg, out_muxAReg, out_muxDReg, etc.: Control signal outputs
 * - out_state (3-bit): Current FSM state (for debugging/UI)
 */
export class CPU implements Clockable, Connectable {
  readonly id: string;
  name: string;

  // FSM state - starts in RESET
  private _state: CpuState = CpuState.RESET;
  private _FSMindex: number = 0;
  private _halted: boolean = false;
  private _paused: boolean = false;

  // Clock tick counter (moved from Clock class)
  private _totalTicks: number = 0;

  // Registered components for step-based ticking
  private _registeredComponents: Map<string, RegisteredComponent> = new Map();

  // Previous signal values for change detection
  private _prevSignals: Map<string, number | boolean> = new Map();

  // Testing mode: force a specific opcode
  private _testingModeOpcode: Opcode | null = null;
  private _testingModeEnabled: boolean = false;

  // ── Input Ports ──────────────────────────────────────────────
  readonly in_opcode: InputPort<number>;
  readonly in_flagZero: InputPort<number>;
  readonly in_flagCarry: InputPort<number>;
  readonly in_flagNegative: InputPort<number>;

  // ── Output Ports (Control Signals) ───────────────────────────
  readonly out_wrReg: OutputPort<number>;
  readonly out_muxAReg: OutputPort<number>;
  readonly out_muxDReg: OutputPort<number>;
  readonly out_wrPC: OutputPort<number>;
  readonly out_muxPC: OutputPort<number>;
  readonly out_rdMem: OutputPort<number>;
  readonly out_wrMem: OutputPort<number>;
  readonly out_muxAMem: OutputPort<number>;
  readonly out_wrIR: OutputPort<number>;
  readonly out_opULA: OutputPort<number>;
  readonly out_state: OutputPort<number>;
  readonly out_halted: OutputPort<boolean>;

  constructor(id: string, name: string = "CPU") {
    this.id = id;
    this.name = name;

    // Input ports
    this.in_opcode = new InputPort<number>("in_opcode", "opcode", 5, Opcode.HLT);
    this.in_flagZero = new InputPort<number>("in_flagZero", "number", 1, 0);
    this.in_flagCarry = new InputPort<number>("in_flagCarry", "number", 1, 0);
    this.in_flagNegative = new InputPort<number>("in_flagNegative", "number", 1, 0);

    // Control signal output ports
    this.out_wrReg = new OutputPort<number>("out_wrReg", "number", 1, 0);
    this.out_muxAReg = new OutputPort<number>("out_muxAReg", "number", 1, 1);
    this.out_muxDReg = new OutputPort<number>("out_muxDReg", "number", 2, 2);
    this.out_wrPC = new OutputPort<number>("out_wrPC", "number", 1, 0);
    this.out_muxPC = new OutputPort<number>("out_muxPC", "number", 1, 1);
    this.out_rdMem = new OutputPort<number>("out_rdMem", "number", 1, 0);
    this.out_wrMem = new OutputPort<number>("out_wrMem", "number", 1, 1);
    this.out_muxAMem = new OutputPort<number>("out_muxAMem", "number", 1, 0);
    this.out_wrIR = new OutputPort<number>("out_wrIR", "number", 1, 0);
    this.out_opULA = new OutputPort<number>("out_opULA", "number", 3, UlaOperation.ADD);
    this.out_state = new OutputPort<number>("out_state", "number", 4, CpuState.RESET);
    this.out_halted = new OutputPort<boolean>("out_halted", "boolean", 1, false);

    // Initialize previous signal values
    this.initPrevSignals();
  }

  // ── Component Registration ───────────────────────────────────

  /**
   * Register a component for step-based ticking.
   * @param id Component ID
   * @param type Component type string (e.g., "Register", "GprComponent")
   * @param component The Clockable component instance
   * @param customTickSteps Optional custom tick steps (uses defaults if not provided)
   */
  registerComponent(
    id: string,
    type: string,
    component: Clockable,
    customTickSteps?: CpuState[]
  ): void {
    const defaultSteps = DEFAULT_TICK_STEPS[type] ?? ALL_CPU_STATES;
    this._registeredComponents.set(id, {
      id,
      type,
      component,
      tickSteps: customTickSteps ?? [...defaultSteps],
    });
  }

  /**
   * Unregister a component.
   */
  unregisterComponent(id: string): void {
    this._registeredComponents.delete(id);
  }

  /**
   * Get the tick steps for a registered component.
   */
  getComponentTickSteps(id: string): CpuState[] | undefined {
    return this._registeredComponents.get(id)?.tickSteps;
  }

  /**
   * Set the tick steps for a registered component.
   */
  setComponentTickSteps(id: string, steps: CpuState[]): void {
    const entry = this._registeredComponents.get(id);
    if (entry) {
      entry.tickSteps = [...steps];
    }
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
      in_flagZero: this.in_flagZero,
      in_flagCarry: this.in_flagCarry,
      in_flagNegative: this.in_flagNegative,
      out_wrReg: this.out_wrReg,
      out_muxAReg: this.out_muxAReg,
      out_muxDReg: this.out_muxDReg,
      out_wrPC: this.out_wrPC,
      out_muxPC: this.out_muxPC,
      out_rdMem: this.out_rdMem,
      out_wrMem: this.out_wrMem,
      out_muxAMem: this.out_muxAMem,
      out_wrIR: this.out_wrIR,
      out_opULA: this.out_opULA,
      out_state: this.out_state,
      out_halted: this.out_halted,
    };
  }

  // ── Accessors ────────────────────────────────────────────────

  get state(): CpuState {
    return this._state;
  }

  get halted(): boolean {
    return this._halted;
  }

  get paused(): boolean {
    return this._paused;
  }

  get totalTicks(): number {
    return this._totalTicks;
  }

  /** Pause or resume the CPU without affecting halted state. */
  setPaused(paused: boolean): void {
    this._paused = paused;
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

  /** Check if testing mode is enabled. */
  isTestingModeEnabled(): boolean {
    return this._testingModeEnabled;
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

  /** Reset the CPU to initial RESET state. */
  reset(): void {
    this._state = CpuState.RESET;
    this._FSMindex = 0;
    this._halted = false;
    this._totalTicks = 0;
    this.initPrevSignals();
    // Apply RESET state control signals
    this.emitSignals(CpuState.RESET, Opcode.HLT);
    this.out_state.set(CpuState.RESET);
    this.out_halted.set(false);
  }

  /** Initialize previous signal values for change detection. */
  private initPrevSignals(): void {
    this._prevSignals.set("wrReg", 0);
    this._prevSignals.set("muxAReg", 1);
    this._prevSignals.set("muxDReg", 2);
    this._prevSignals.set("wrPC", 0);
    this._prevSignals.set("muxPC", 1);
    this._prevSignals.set("rdMem", 0);
    this._prevSignals.set("wrMem", 0);
    this._prevSignals.set("muxAMem", 1);
    this._prevSignals.set("wrIR", 0);
    this._prevSignals.set("opULA", UlaOperation.ADD);
  }

  /**
   * Set a signal only if it has changed from its previous value.
   * This reduces unnecessary propagation.
   */
  private setSignalIfChanged<T extends number | boolean>(
    port: OutputPort<T>,
    signalName: string,
    value: T
  ): void {
    const prevValue = this._prevSignals.get(signalName);
    if (prevValue !== value) {
      port.set(value);
      this._prevSignals.set(signalName, value);
    }
  }

  // ── Tick orchestration ───────────────────────────────────────

  /**
   * Main tick method that advances the CPU state and ticks appropriate components.
   * This replaces the old global clock tick.
   */
  tick(): void {
    if (this._halted || this._paused) return;

    this.syncTestingOpcodeInput();
    this._totalTicks++;

    // First, execute the CPU's own state logic
    this.onTick();

    // HLT cycles affect only the CPU control unit.
    if (this._halted) {
      return;
    }

    // Then, tick all registered components that should tick on this state
    this.tickComponentsForState(this._state);
  }

  /**
   * Tick all components registered for the given state.
   */
  private tickComponentsForState(state: CpuState): void {
    for (const entry of this._registeredComponents.values()) {
      if (entry.tickSteps.includes(state)) {
        entry.component.onTick();
      }
    }
  }

  /**
   * Tick a single component by ID, regardless of current state.
   * Useful for manual testing from ConfigModal.
   */
  tickSingleComponent(id: string): void {
    const entry = this._registeredComponents.get(id);
    if (entry) {
      entry.component.onTick();
    }
  }

  // ── Clockable callback ───────────────────────────────────────

  /**
   * Called by the global clock on each tick.
   *
   * The pipeline is:
   *   RESET → FETCH → DECODE → (opcode-specific states driven by _FSMindex) → back to FETCH
   *
   * RESET is the initial state that clears all control signals. On first tick, transitions to FETCH.
   * FETCH and DECODE are two fixed ticks.
   * After DECODE the opcode is known; subsequent ticks walk _FSMindex through
   * the per-opcode step array until it is exhausted, then return to FETCH.
   * After HALT or invalid instructions, CPU returns to RESET.
   */
  onTick(): void {
    if (this._halted || this._paused) return;

    switch (this._state) {
      case CpuState.RESET:
        this.doReset();
        break;

      case CpuState.FETCH:
        this.doFetch();
        break;

      case CpuState.DECODE:
        this.doDecode();
        break;

      default:
        this.doStep();
        break;
    }

    this.out_state.set(this._state);
    this.out_halted.set(this._halted);
  }

  // ── Fixed phases ─────────────────────────────────────────────

  /** RESET state - clears all control signals. Transitions to FETCH on tick. */
  private doReset(): void {
    // Emit RESET state signals (clears all signals)
    this.emitSignals(CpuState.RESET, this.getActiveOpcode());
    // Transition to FETCH on next tick
    this._state = CpuState.FETCH;
  }

  /** Tick 1 – read instruction from memory[PC] into IR. */
  private doFetch(): void {
    // Emit FETCH state signals
    this.emitSignals(CpuState.FETCH, this.getActiveOpcode());
    this._state = CpuState.DECODE;
  }

  /**
   * Tick 2 – instruction is latched in IR; opcode is now visible on
   * `in_opcode`.  Increment PC so it already points to the next instruction.
   * Then decide which first execution state to enter.
   */
  private doDecode(): void {
    // Emit DECODE state signals
    const opcode = this.getActiveOpcode();
    this.emitSignals(CpuState.DECODE, opcode);

    const sequence = OPCODE_SEQUENCES[opcode];
    
    if (opcode === Opcode.HLT || !sequence || sequence.length === 0) {
      this._halted = true;
      this._state = CpuState.RESET;
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

    // Emit control signals for the current state
    this.emitSignals(this._state, opcode);

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

  // ── Signal emission ───────────────────────────────────────────

  /**
   * Given the current CpuState and the active opcode, drive the appropriate
   * control signals for this clock tick.
   * 
   * Uses STATE_CONTROL_SIGNALS configuration for most states, with special
   * handling for EXECUTE (opcode-dependent ULA operation) and WRITEPC (conditional jumps).
   */
  private emitSignals(state: CpuState, opcode: Opcode): void {
    // Get base configuration for this state
    const config = STATE_CONTROL_SIGNALS[state];
    
    if (!config) {
      // No configuration for this state - no signals to emit
      return;
    }

    // Apply all configured signals
    if (config.wrReg !== undefined) {
      this.setSignalIfChanged(this.out_wrReg, "wrReg", config.wrReg);
    }
    if (config.muxAReg !== undefined) {
      this.setSignalIfChanged(this.out_muxAReg, "muxAReg", config.muxAReg);
    }
    if (config.muxDReg !== undefined) {
      this.setSignalIfChanged(this.out_muxDReg, "muxDReg", config.muxDReg);
    }
    if (config.wrPC !== undefined) {
      this.setSignalIfChanged(this.out_wrPC, "wrPC", config.wrPC);
    }
    if (config.muxPC !== undefined) {
      this.setSignalIfChanged(this.out_muxPC, "muxPC", config.muxPC);
    }
    if (config.rdMem !== undefined) {
      this.setSignalIfChanged(this.out_rdMem, "rdMem", config.rdMem);
    }
    if (config.wrMem !== undefined) {
      this.setSignalIfChanged(this.out_wrMem, "wrMem", config.wrMem);
    }
    if (config.muxAMem !== undefined) {
      this.setSignalIfChanged(this.out_muxAMem, "muxAMem", config.muxAMem);
    }
    if (config.wrIR !== undefined) {
      this.setSignalIfChanged(this.out_wrIR, "wrIR", config.wrIR);
    }

    // Special handling for state-specific logic
    switch (state) {
      case CpuState.EXECUTE:
        // EXECUTE: set ULA operation based on opcode
        this.setSignalIfChanged(this.out_opULA, "opULA", this.opcodeToUlaOp(opcode));
        break;

      case CpuState.WRITEPC: {
        // WRITEPC: conditionally update PC based on opcode and flags
        const taken =
          opcode === Opcode.JMP ||
          (opcode === Opcode.JZ && this.in_flagZero.get()) ||
          (opcode === Opcode.JC && this.in_flagCarry.get()) ||
          (opcode === Opcode.JN && this.in_flagNegative.get());

        if (taken) {
          this.setSignalIfChanged(this.out_wrPC, "wrPC", 1);
          this.setSignalIfChanged(this.out_muxPC, "muxPC", 1); // jump target from operand
        }
        break;
      }

      default:
        // For other states, apply opULA if configured
        if (config.opULA !== undefined) {
          this.setSignalIfChanged(this.out_opULA, "opULA", config.opULA);
        }
        break;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private opcodeToUlaOp(opcode: Opcode): UlaOperation {
    return OPCODE_TO_ULA_OP[opcode] ?? UlaOperation.ADD;
  }
}
