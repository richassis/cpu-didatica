/**
 * Decoder.ts – Instruction decoder component.
 *
 * The Decoder sits between the Instruction Register (IR) and the rest of the
 * datapath. On each tick it reads the raw 16-bit instruction word loaded into
 * it, decodes all fields, and exposes them to the appropriate consumers:
 *
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │                              DECODER                               │
 *   │                                                                    │
 *   │  raw word ──▶  opcode        ──▶  UC                               │
 *   │                gprAddrA      ──▶  GPR read address A, muxAReg in 0 │
 *   │                gprAddrB      ──▶  GPR read address B               │
 *   │                dst           ──▶  muxAReg in 1                     │
 *   │                operand       ──▶  MAR                              │
 *   │                operandSigned ──▶  muxDReg in 0                     │
 *   └────────────────────────────────────────────────────────────────────┘
 *   (wiring of the default project)
 *
 * The control unit only receives the opcode.
 * All other fields are consumed by the components that need them.
 */

import { Clockable } from "./Clockable";
import {
  Opcode,
  ISA_WORD_MAX,
  ISA_WORD_SIZE,
  OPCODE_BITS,
  GPR_ADDR_BITS,
  OPERAND_BITS,
  extractFields,
  lookupInstruction,
  signExtend,
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

  /** Output: shared GPR address field [10:8] (standard / ULA srcA). */
  readonly out_gprAddrA: OutputPort<number>;

  /** Output: 8-bit operand/immediate [7:0] (standard format). */
  readonly out_operand: OutputPort<number>;

  /**
   * Output: the same [7:0] field, sign-extended to the full word width.
   * `operand` feeds address consumers (LDA/STA's MAR, unsigned); this feeds
   * LDAI's immediate-data mux, where the field is a signed byte and needs
   * bit 7 replicated into bits 15:8 before it reaches a 16-bit register.
   */
  readonly out_operandSigned: OutputPort<number>;

  /** Output: ULA source B / second GPR address [7:5]. */
  readonly out_gprAddrB: OutputPort<number>;

  /** Output: ULA destination [2:0]. */
  readonly out_dst: OutputPort<number>;

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

    this.out_gprAddrA = new OutputPort<number>(
      "gprAddrA", "number", GPR_ADDR_BITS, 0,
      "Shared GPR address field [10:8] for standard instructions and ULA srcA"
    );

    this.out_operand = new OutputPort<number>(
      "operand", "number", OPERAND_BITS, 0,
      "8-bit immediate/address [7:0] for standard instructions"
    );

    this.out_operandSigned = new OutputPort<number>(
      "operandSigned", "number", ISA_WORD_SIZE, 0,
      "operand, sign-extended to the full word — feeds LDAI's immediate mux"
    );

    this.out_gprAddrB = new OutputPort<number>(
      "gprAddrB", "number", GPR_ADDR_BITS, 0,
      "ULA source B / second GPR address [7:5]"
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
      gprAddrA: this.out_gprAddrA,
      gprAddrB: this.out_gprAddrB,
      dst: this.out_dst,
      operand: this.out_operand,
      operandSigned: this.out_operandSigned,
    };
  }

  // ── Convenience accessors (read from ports) ────────────────────────────────

  /** The decoded opcode (from output port). */
  get opcode(): Opcode {
    return this.out_opcode.value as Opcode;
  }

  // ── Clockable ──────────────────────────────────────────────────────────────

  /** Decodes the instruction from the input port and updates all output ports. */
  onTick(): void {
    this.evaluate();
  }

  /**
   * Combinational phase: decode current instruction and drive outputs.
   */
  evaluate(): void {
    this._decode();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _decode(): void {
    const raw    = this.in_instruction.value & ISA_WORD_MAX;
    const fields = extractFields(raw);
    const opcode = fields.opcode as Opcode;
    const desc   = lookupInstruction(opcode);

    // Always update the opcode output
    this.out_opcode.set(opcode);

    // Unknown opcode – update opcode output only
    if (!desc) return;

    if (desc.format === "ula") {
      this.out_gprAddrA.set(fields.srcA);
      this.out_gprAddrB.set(fields.srcB);
      this.out_dst.set(fields.dst);

      // Clear standard outputs
      this.out_operand.set(0);
      this.out_operandSigned.set(0);
    } else {
      this.out_gprAddrA.set(fields.gprAddr);
      this.out_operand.set(fields.operand);

      // Sign-extend bit 7 into bits 15:8. `& ISA_WORD_MAX` is required, not
      // cosmetic: OutputPort.set() clamps a raw negative number to 0 instead
      // of wrapping it, so the two's-complement bit pattern must already be
      // non-negative by the time it reaches `.set()`.
      this.out_operandSigned.set(signExtend(fields.operand, OPERAND_BITS) & ISA_WORD_MAX);

      // Clear ULA outputs
      this.out_gprAddrB.set(0);
      this.out_dst.set(0);
    }
  }
}
