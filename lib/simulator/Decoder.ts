/**
 * Decoder.ts – Instruction decoder component.
 *
 * The Decoder sits between the Instruction Register (IR) and the rest of the
 * datapath. On each tick it reads the raw 16-bit instruction word loaded into
 * it, decodes all fields, and exposes them to the appropriate consumers:
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │                         DECODER                              │
 *   │                                                              │
 *   │  raw word ──▶  opcode  ──────────────────────────▶  CPU      │
 *   │                gprAddr / srcA ──────────────────▶  GPR mux   │
 *   │                srcB          ──────────────────▶  GPR mux   │
 *   │                dst           ──────────────────▶  GPR mux   │
 *   │                operand       ──────────────────▶  Imm / MAR │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * The CPU only ever reads `decoder.opcode`.
 * All other fields are consumed by the components that need them.
 */

import { Clockable } from "./Clockable";
import {
  Opcode,
  INSTRUCTION_SET,
  ISA_WORD_MAX,
  ISA_WORD_SIZE,
  OPCODE_BITS,
  GPR_ADDR_BITS,
  OPERAND_BITS,
  OPCODE_MASK,
  OPCODE_SHIFT,
  GPR_ADDR_MASK,
  GPR_ADDR_SHIFT,
  OPERAND_MASK,
  OPERAND_SHIFT,
  ULA_SRC_A_MASK,
  ULA_SRC_A_SHIFT,
  ULA_SRC_B_MASK,
  ULA_SRC_B_SHIFT,
  ULA_DST_MASK,
  ULA_DST_SHIFT,
  DecodedInstruction,
  opcodeToMnemonic,
} from "./ISA";
import { Connectable, type PortMap, InputPort, OutputPort } from "./Port";

export class Decoder implements Clockable, Connectable {
  /** Unique ID matching the ComponentInstance id on the canvas. */
  readonly id: string;
  /** Human-readable name, e.g. "DEC". */
  name: string;

  // ── Ports ──────────────────────────────────────────────────────────────────

  /** Input: raw 16-bit instruction word (from IR). */
  readonly in_instruction: InputPort<number>;

  /** Output: 5-bit opcode (to CPU). */
  readonly out_opcode: OutputPort<number>;

  /** Output: GPR address field [10:8] (standard format). */
  readonly out_gprAddr: OutputPort<number>;

  /** Output: 8-bit operand/immediate [7:0] (standard format). */
  readonly out_operand: OutputPort<number>;

  /** Output: ULA source A [10:8]. */
  readonly out_srcA: OutputPort<number>;

  /** Output: ULA source B [7:5]. */
  readonly out_srcB: OutputPort<number>;

  /** Output: ULA destination [2:0]. */
  readonly out_dst: OutputPort<number>;

  // ── Internal ───────────────────────────────────────────────────────────────

  /** The last fully decoded instruction (updated every tick). */
  private _decoded: DecodedInstruction | null = null;

  constructor(id: string, name = "DEC") {
    this.id   = id;
    this.name = name;

    // Create ports
    this.in_instruction = new InputPort<number>(
      "instruction", "number", ISA_WORD_SIZE, 0,
      "Raw 16-bit instruction word from IR"
    );

    this.out_opcode = new OutputPort<number>(
      "opcode", "opcode", OPCODE_BITS, Opcode.HLT,
      "5-bit opcode sent to CPU"
    );

    this.out_gprAddr = new OutputPort<number>(
      "gprAddr", "number", GPR_ADDR_BITS, 0,
      "GPR address field [10:8] for standard instructions"
    );

    this.out_operand = new OutputPort<number>(
      "operand", "number", OPERAND_BITS, 0,
      "8-bit immediate/address [7:0] for standard instructions"
    );

    this.out_srcA = new OutputPort<number>(
      "srcA", "number", GPR_ADDR_BITS, 0,
      "ULA source A register address [10:8]"
    );

    this.out_srcB = new OutputPort<number>(
      "srcB", "number", GPR_ADDR_BITS, 0,
      "ULA source B register address [7:5]"
    );

    this.out_dst = new OutputPort<number>(
      "dst", "number", GPR_ADDR_BITS, 0,
      "ULA destination register address [2:0]"
    );
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    return {
      instruction: this.in_instruction,
      opcode: this.out_opcode,
      gprAddr: this.out_gprAddr,
      operand: this.out_operand,
      srcA: this.out_srcA,
      srcB: this.out_srcB,
      dst: this.out_dst,
    };
  }

  // ── Convenience accessors (read from ports) ────────────────────────────────

  /** The raw instruction word (from input port). */
  get instruction(): number {
    return this.in_instruction.value;
  }

  /** Set instruction directly (for testing or manual use). */
  set instruction(v: number) {
    // Note: normally this comes from a wired connection, but allow direct set
    this.in_instruction.set(v & ISA_WORD_MAX);
  }

  /** The decoded opcode (from output port). */
  get opcode(): Opcode {
    return this.out_opcode.value as Opcode;
  }

  /** GPR address field. */
  get gprAddr(): number {
    return this.out_gprAddr.value;
  }

  /** Operand/immediate field. */
  get operand(): number {
    return this.out_operand.value;
  }

  /** ULA source A. */
  get srcA(): number {
    return this.out_srcA.value;
  }

  /** ULA source B. */
  get srcB(): number {
    return this.out_srcB.value;
  }

  /** ULA destination. */
  get dst(): number {
    return this.out_dst.value;
  }

  // ── Clockable ──────────────────────────────────────────────────────────────

  /**
   * Called by the global clock on every tick.
   * Decodes the instruction from the input port and updates all output ports.
   */
  onTick(): void {
    this._decode();
  }

  // ── Manual decode ──────────────────────────────────────────────────────────

  /**
   * Decode the current instruction immediately (without waiting for a tick).
   * Useful when loading a new instruction word outside the clock cycle.
   */
  decodeNow(): void {
    this._decode();
  }

  // ── Read-only view of the last decoded result ──────────────────────────────

  /** The last decoded instruction, or `null` if no decode has run yet. */
  get decoded(): DecodedInstruction | null {
    return this._decoded;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _decode(): void {
    const raw    = this.in_instruction.value & ISA_WORD_MAX;
    const opcode = ((raw & OPCODE_MASK) >>> OPCODE_SHIFT) as Opcode;

    let mnemonic: keyof typeof Opcode;
    try {
      mnemonic = opcodeToMnemonic(opcode);
    } catch {
      // Unknown opcode – update opcode output only
      this.out_opcode.set(opcode);
      return;
    }

    const desc = INSTRUCTION_SET[mnemonic];

    // Always update the opcode output
    this.out_opcode.set(opcode);

    if (desc.format === "ula") {
      const srcA = (raw & ULA_SRC_A_MASK) >>> ULA_SRC_A_SHIFT;
      const srcB = (raw & ULA_SRC_B_MASK) >>> ULA_SRC_B_SHIFT;
      const dst  = (raw & ULA_DST_MASK)   >>> ULA_DST_SHIFT;

      this.out_srcA.set(srcA);
      this.out_srcB.set(srcB);
      this.out_dst.set(dst);

      // Clear standard outputs
      this.out_gprAddr.set(0);
      this.out_operand.set(0);

      this._decoded = {
        format: "ula", raw, opcode, mnemonic,
        srcA, srcB, dst,
      };
    } else {
      const gprAddr = (raw & GPR_ADDR_MASK) >>> GPR_ADDR_SHIFT;
      const operand = (raw & OPERAND_MASK)  >>> OPERAND_SHIFT;

      this.out_gprAddr.set(gprAddr);
      this.out_operand.set(operand);

      // Clear ULA outputs
      this.out_srcA.set(0);
      this.out_srcB.set(0);
      this.out_dst.set(0);

      this._decoded = {
        format: "standard", raw, opcode, mnemonic,
        gprAddr, operand,
      };
    }
  }
}
