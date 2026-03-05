/**
 * Encoder.ts – Assembles 16-bit instruction words from mnemonics and fields.
 *
 * This is a pure utility (no state, no clock participation).
 * Use it to build programs / test fixtures by turning human-readable
 * mnemonics into raw binary words that can be loaded into memory.
 */

import {
  Opcode,
  INSTRUCTION_SET,
  ISA_WORD_SIZE,
  ISA_WORD_MAX,
  OPCODE_BITS,
  OPCODE_SHIFT,
  GPR_ADDR_SHIFT,
  OPERAND_SHIFT,
  ULA_SRC_A_SHIFT,
  ULA_SRC_B_SHIFT,
  ULA_DST_SHIFT,
} from "./ISA";

export class Encoder {
  /** Number of bits in an instruction word. */
  static readonly WORD_SIZE = ISA_WORD_SIZE;
  static readonly WORD_MAX  = ISA_WORD_MAX;

  // ── Standard format ────────────────────────────────────────────────────────

  /**
   * Encode a **standard-format** instruction word.
   *
   * Layout: `OPCODE(5) | GPR_ADDR(3) | OPERAND(8)`
   *
   * @param opcode  - The {@link Opcode} value.
   * @param gprAddr - GPR address (0–7).
   * @param operand - 8-bit immediate or memory address (0–255).
   */
  static encode(opcode: Opcode, gprAddr = 0, operand = 0): number {
    const op  = (opcode  & 0b11111) << OPCODE_SHIFT;
    const gpr = (gprAddr & 0b111)   << GPR_ADDR_SHIFT;
    const imm = (operand & 0xFF)    << OPERAND_SHIFT;
    return (op | gpr | imm) >>> 0;
  }

  // ── ULA format ─────────────────────────────────────────────────────────────

  /**
   * Encode a **ULA-format** instruction word.
   *
   * Layout: `OPCODE(5) | SRC_A(3) | SRC_B(3) | pad(2) | DST(3)`
   *
   * @param opcode - The {@link Opcode} value (must be a ULA instruction).
   * @param srcA   - First source GPR address (0–7).
   * @param srcB   - Second source GPR address (0–7). Pass 0 for NOT.
   * @param dst    - Destination GPR address (0–7).
   */
  static encodeULA(opcode: Opcode, srcA = 0, srcB = 0, dst = 0): number {
    const op = (opcode & 0b11111) << OPCODE_SHIFT;
    const a  = (srcA   & 0b111)   << ULA_SRC_A_SHIFT;
    const b  = (srcB   & 0b111)   << ULA_SRC_B_SHIFT;
    const d  = (dst    & 0b111)   << ULA_DST_SHIFT;
    return (op | a | b | d) >>> 0;
  }

  // ── By mnemonic ────────────────────────────────────────────────────────────

  /**
   * Encode by mnemonic – automatically selects the correct format.
   *
   * @example
   * Encoder.assemble("LDAI", { gprAddr: 2, operand: 0x42 }) // → 0x1242
   * Encoder.assemble("ADD",  { srcA: 1, srcB: 2, dst: 3 })  // → ULA word
   * Encoder.assemble("HLT")                                  // → 0x6800
   */
  static assemble(
    mnemonic : keyof typeof Opcode,
    fields   : { gprAddr?: number; operand?: number; srcA?: number; srcB?: number; dst?: number } = {}
  ): number {
    const desc = INSTRUCTION_SET[mnemonic];
    if (!desc) throw new RangeError(`Unknown mnemonic: "${mnemonic}"`);

    if (desc.format === "ula") {
      return Encoder.encodeULA(desc.opcode, fields.srcA ?? 0, fields.srcB ?? 0, fields.dst ?? 0);
    }
    return Encoder.encode(desc.opcode, fields.gprAddr ?? 0, fields.operand ?? 0);
  }

  // ── Formatting helpers ─────────────────────────────────────────────────────

  /**
   * Return a raw word as a zero-padded 4-digit hex string.
   * @example Encoder.toHex(0x1242) → "0x1242"
   */
  static toHex(word: number): string {
    const digits = Math.ceil(ISA_WORD_SIZE / 4);
    return "0x" + (word & ISA_WORD_MAX).toString(16).padStart(digits, "0").toUpperCase();
  }

  /**
   * Return a raw word as a zero-padded 16-bit binary string,
   * optionally grouped by fields.
   *
   * Standard: `OOOOO GGG IIIIIIII`
   * ULA:      `OOOOO AAA BBB -- DDD`
   *
   * @example
   * Encoder.toBinary(0x1242)         → "0001001001000010"
   * Encoder.toBinary(0x1242, true)   → "00010 010 01000010"
   */
  static toBinary(word: number, grouped = false): string {
    const bits = (word & ISA_WORD_MAX).toString(2).padStart(ISA_WORD_SIZE, "0");
    if (!grouped) return bits;

    const opPart = bits.slice(0, OPCODE_BITS);
    // Peek at the opcode to know which grouping to apply
    const opcode = (word >>> OPCODE_SHIFT) & 0b11111;
    const desc   = Object.values(INSTRUCTION_SET).find(d => d.opcode === opcode);

    if (desc?.format === "ula") {
      const srcAPart = bits.slice(5, 8);
      const srcBPart = bits.slice(8, 11);
      const padPart  = bits.slice(11, 13);
      const dstPart  = bits.slice(13);
      return `${opPart} ${srcAPart} ${srcBPart} ${padPart} ${dstPart}`;
    }

    const gprPart = bits.slice(5, 8);
    const immPart = bits.slice(8);
    return `${opPart} ${gprPart} ${immPart}`;
  }
}
