import type { Clockable } from "./Clockable";
import { Opcode, UlaOperation, OPCODE_TO_ULA_OP } from "./ISA";
import { InputPort, OutputPort, type Connectable, type PortMap } from "./Port";

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
 * FSM states for instruction execution.
 */
export enum CpuState {
    FETCH = 0,
    DECODE = 1,
    EXECUTE = 2,
    READMEM = 3,
    WRITEMEM = 4,
    READREG1 = 5,
    READREG2 = 6,
    WRITEREG1 = 7,
    WRITEREG2 = 8,
    WRITEREG3 = 9,
    WRITEPC = 10,
}


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
 * CPU control unit.
 *
 * Implements a finite state machine that sequences through instruction phases
 * and drives control signals to other components via output ports.
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

  // FSM state
  private _state: CpuState = CpuState.FETCH;
  private _FSMindex: number = 0;
  private _halted: boolean = false;
  private _paused: boolean = false;

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
    this.out_state = new OutputPort<number>("out_state", "number", 3, CpuState.FETCH);
    this.out_halted = new OutputPort<boolean>("out_halted", "boolean", 1, false);
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

  /** Pause or resume the CPU without affecting halted state. */
  setPaused(paused: boolean): void {
    this._paused = paused;
  }

  // ── Control Methods ──────────────────────────────────────────

  /** Reset the CPU to initial state. */
  reset(): void {
    this._state = CpuState.FETCH;
    this._halted = false;
    this.clearAllSignals();
    this.out_state.set(CpuState.FETCH);
    this.out_halted.set(false);
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

  // ── Clockable callback ───────────────────────────────────────

  /**
   * Called by the global clock on each tick.
   *
   * The pipeline is:
   *   FETCH → DECODE → (opcode-specific states driven by _FSMindex) → back to FETCH
   *
   * FETCH and DECODE are always two fixed ticks.
   * After DECODE the opcode is known; subsequent ticks walk _FSMindex through
   * the per-opcode step array until it is exhausted, then return to FETCH.
   */
  onTick(): void {
    if (this._halted || this._paused) return;

    // this.clearAllSignals();

    switch (this._state) {
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

  /** Tick 1 – read instruction from memory[PC] into IR. */
  private doFetch(): void {
    this.out_wrPC.set(1);
    this.out_wrIR.set(1);
    this.out_rdMem.set(1);
    // this.out_wrMem.set(0);
    // this.out_muxPC.set(1); 
    // this.out_muxAMem.set(1);
    // this.out_muxAReg.set(1);
    // this.out_muxDReg.set(2); 
    this._state = CpuState.DECODE;
  }

  /**
   * Tick 2 – instruction is latched in IR; opcode is now visible on
   * `in_opcode`.  Increment PC so it already points to the next instruction.
   * Then decide which first execution state to enter.
   */
  private doDecode(): void {
    this.out_wrPC.set(0);
    this.out_wrIR.set(0);
    this.out_rdMem.set(0);

    const opcode = this.in_opcode.get() as Opcode;

    if (opcode === Opcode.HLT) {
      this._halted = true;
      this._state = CpuState.FETCH;
      return;
    }

    const sequence = OPCODE_SEQUENCES[opcode];

    if (!sequence || sequence.length === 0) {
      // Unknown opcode → halt
      this._halted = true;
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
        this.out_rdMem.set(1);
        this.out_muxAMem.set(0); // operand as memory address
        this.out_muxAReg.set(0); // select GPR address for later write
        this.out_muxDReg.set(1); // select memory data for later write
        break;

      case CpuState.WRITEREG1:
        // Used by LDA: write memory data into GPR
        this.out_wrReg.set(1);
        this.out_rdMem.set(0);
        break;

      // ── LDAI: immediate → GPR ───────────────────────────────
      case CpuState.WRITEREG2:
        // Used by LDAI: write immediate operand into GPR
        this.out_wrReg.set(1);
        this.out_muxAReg.set(0); // select GPR address for later write
        this.out_muxDReg.set(0); // immediate operand
        break;

      // ── STA: GPR → mem[operand] ─────────────────────────────
      case CpuState.READREG1:
        // Used by STA: assert GPR value on bus (muxAReg selects GPR address)
        this.out_muxAMem.set(0);
        break;

      case CpuState.WRITEMEM:
        // Used by STA: write GPR data to memory[operand]
        this.out_wrMem.set(1);
        break;

      // ── ULA ops: read operands, execute, write result ────────
      case CpuState.READREG2:
        // Read second source operand into ULA input B
        // this.out_muxAReg.set(1); // select srcB address
        break;

      case CpuState.EXECUTE:
        // Perform the ULA operation
        this.out_opULA.set(this.opcodeToUlaOp(opcode));
        break;

      case CpuState.WRITEREG3:
        // Write ULA result into destination register
        this.out_wrReg.set(1);
        this.out_opULA.set(UlaOperation.ADD); // default to ADD for non-ULA ops

        break;

      // ── Jumps ────────────────────────────────────────────────
      case CpuState.WRITEPC: {
        const taken =
          opcode === Opcode.JMP ||
          (opcode === Opcode.JZ && this.in_flagZero.get()) ||
          (opcode === Opcode.JC && this.in_flagCarry.get()) ||
          (opcode === Opcode.JN && this.in_flagNegative.get());

        if (taken) {
          this.out_wrPC.set(1);
          this.out_muxPC.set(1); // jump target from operand
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
