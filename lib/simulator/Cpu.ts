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

  // FSM state - starts in IDLE
  private _state: CpuState = CpuState.IDLE;
  private _FSMindex: number = 0;
  private _halted: boolean = false;
  private _paused: boolean = false;

  // Clock tick counter (moved from Clock class)
  private _totalTicks: number = 0;

  // Registered components for step-based ticking
  private _registeredComponents: Map<string, RegisteredComponent> = new Map();

  // Previous signal values for change detection
  private _prevSignals: Map<string, number | boolean> = new Map();

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
    this.out_state = new OutputPort<number>("out_state", "number", 4, CpuState.IDLE);
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

  // ── Control Methods ──────────────────────────────────────────

  /** Reset the CPU to initial IDLE state. */
  reset(): void {
    this._state = CpuState.IDLE;
    this._FSMindex = 0;
    this._halted = false;
    this._totalTicks = 0;
    this.clearAllSignals();
    this.initPrevSignals();
    this.out_state.set(CpuState.IDLE);
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

  /** Clear all control signals to 0. */
  private clearAllSignals(): void {
    this.out_wrReg.set(0);
    this.out_muxAReg.set(1);
    this.out_muxDReg.set(2);
    this.out_wrPC.set(0);
    this.out_muxPC.set(1);
    this.out_rdMem.set(0);
    this.out_wrMem.set(0);
    this.out_muxAMem.set(1);
    this.out_wrIR.set(0);
    this.out_opULA.set(UlaOperation.ADD);
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

    this._totalTicks++;

    // First, execute the CPU's own state logic
    this.onTick();

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
   *   IDLE → FETCH → DECODE → (opcode-specific states driven by _FSMindex) → back to FETCH
   *
   * IDLE is the initial demonstrative state. On first tick, transitions to FETCH.
   * FETCH and DECODE are two fixed ticks.
   * After DECODE the opcode is known; subsequent ticks walk _FSMindex through
   * the per-opcode step array until it is exhausted, then return to FETCH.
   * If no opcode (or NOP-equivalent), returns to FETCH and loops.
   */
  onTick(): void {
    if (this._halted || this._paused) return;

    switch (this._state) {
      case CpuState.IDLE:
        this.doIdle();
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

  /** IDLE state - initial demonstrative state. Transitions to FETCH on tick. */
  private doIdle(): void {
    // Clear all signals in IDLE state
    this.clearAllSignals();
    // Transition to FETCH on next tick
    this._state = CpuState.FETCH;
  }

  /** Tick 1 – read instruction from memory[PC] into IR. */
  private doFetch(): void {
    this.setSignalIfChanged(this.out_wrPC, "wrPC", 1);
    this.setSignalIfChanged(this.out_wrIR, "wrIR", 1);
    this.setSignalIfChanged(this.out_rdMem, "rdMem", 1);
    this._state = CpuState.DECODE;
  }

  /**
   * Tick 2 – instruction is latched in IR; opcode is now visible on
   * `in_opcode`.  Increment PC so it already points to the next instruction.
   * Then decide which first execution state to enter.
   */
  private doDecode(): void {
    this.setSignalIfChanged(this.out_wrPC, "wrPC", 0);
    this.setSignalIfChanged(this.out_wrIR, "wrIR", 0);
    this.setSignalIfChanged(this.out_rdMem, "rdMem", 0);

    const opcode = this.in_opcode.get() as Opcode;

    // Only HALT if HLT opcode is explicitly sent
    if (opcode === Opcode.HLT) {
      this._halted = true;
      this._state = CpuState.FETCH;
      return;
    }

    const sequence = OPCODE_SEQUENCES[opcode];

    if (!sequence || sequence.length === 0) {
      // Unknown or no-op opcode → return to FETCH (no halt)
      this._state = CpuState.FETCH;
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
    const opcode = this.in_opcode.get() as Opcode;

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
   */
  private emitSignals(state: CpuState, opcode: Opcode): void {
    switch (state) {

      // ── LDA: mem[operand] → GPR ─────────────────────────────
      case CpuState.READMEM:
        this.setSignalIfChanged(this.out_rdMem, "rdMem", 1);
        this.setSignalIfChanged(this.out_muxAMem, "muxAMem", 0); // operand as memory address
        this.setSignalIfChanged(this.out_muxAReg, "muxAReg", 0); // select GPR address for later write
        this.setSignalIfChanged(this.out_muxDReg, "muxDReg", 1); // select memory data for later write
        break;

      case CpuState.WRITEREG1:
        // Used by LDA: write memory data into GPR
        this.setSignalIfChanged(this.out_wrReg, "wrReg", 1);
        this.setSignalIfChanged(this.out_rdMem, "rdMem", 0);
        break;

      // ── LDAI: immediate → GPR ───────────────────────────────
      case CpuState.WRITEREG2:
        // Used by LDAI: write immediate operand into GPR
        this.setSignalIfChanged(this.out_wrReg, "wrReg", 1);
        this.setSignalIfChanged(this.out_muxAReg, "muxAReg", 0); // select GPR address for later write
        this.setSignalIfChanged(this.out_muxDReg, "muxDReg", 0); // immediate operand
        break;

      // ── STA: GPR → mem[operand] ─────────────────────────────
      case CpuState.READREG1:
        // Used by STA: assert GPR value on bus (muxAReg selects GPR address)
        this.setSignalIfChanged(this.out_muxAMem, "muxAMem", 0);
        break;

      case CpuState.WRITEMEM:
        // Used by STA: write GPR data to memory[operand]
        this.setSignalIfChanged(this.out_wrMem, "wrMem", 1);
        break;

      // ── ULA ops: read operands, execute, write result ────────
      case CpuState.READREG2:
        // Read second source operand into ULA input B
        break;

      case CpuState.EXECUTE:
        // Perform the ULA operation
        this.setSignalIfChanged(this.out_opULA, "opULA", this.opcodeToUlaOp(opcode));
        break;

      case CpuState.WRITEREG3:
        // Write ULA result into destination register
        this.setSignalIfChanged(this.out_wrReg, "wrReg", 1);
        this.setSignalIfChanged(this.out_opULA, "opULA", UlaOperation.ADD); // default to ADD for non-ULA ops
        break;

      // ── Jumps ────────────────────────────────────────────────
      case CpuState.WRITEPC: {
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
        break;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private opcodeToUlaOp(opcode: Opcode): UlaOperation {
    return OPCODE_TO_ULA_OP[opcode] ?? UlaOperation.ADD;
  }
}
