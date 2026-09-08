/**
 * disassemble.ts — Pure decode of a raw 16-bit instruction word back to its
 * mnemonic and fields, for display only (no execution semantics).
 *
 * The CPU's own `Decoder` component decodes for the datapath, port-driven and
 * private. This is the read side: turning a word already sitting in memory
 * into text, used by the instruction-memory widget and the assembled-program
 * listing.
 */

import {
  OPCODE_SHIFT,
  GPR_ADDR_SHIFT,
  OPERAND_MASK,
  ULA_SRC_A_SHIFT,
  ULA_SRC_B_SHIFT,
  ULA_DST_MASK,
  GPR_ADDR_BITS,
  INSTRUCTION_SET,
} from "@/lib/simulator/ISA";

export interface DisassembledWord {
  mnemonic: string;
  /** Human-readable operand list, e.g. "R2, #66" or "R0, R1, R3". */
  operandText: string;
}

/**
 * Decode a raw word into a mnemonic and formatted operands.
 * Unknown opcodes (including the all-zero NOP word) decode to a placeholder
 * rather than throwing — memory is full of unassembled zeros before a program
 * loads, and a listing has to render those cells too.
 */
export function disassemble(word: number): DisassembledWord {
  const opcode = (word >>> OPCODE_SHIFT) & 0b11111;
  const entry = Object.values(INSTRUCTION_SET).find((d) => d.opcode === opcode);

  if (!entry) {
    return { mnemonic: word === 0 ? "NOP" : "???", operandText: "" };
  }

  if (entry.format === "ula") {
    const srcA = (word >>> ULA_SRC_A_SHIFT) & ((1 << GPR_ADDR_BITS) - 1);
    const srcB = (word >>> ULA_SRC_B_SHIFT) & ((1 << GPR_ADDR_BITS) - 1);
    const dst = word & ULA_DST_MASK;
    const operandText = entry.usesSrcB ? `R${srcA}, R${srcB}, R${dst}` : `R${srcA}, R${dst}`;
    return { mnemonic: entry.mnemonic, operandText };
  }

  const gprAddr = (word >>> GPR_ADDR_SHIFT) & ((1 << GPR_ADDR_BITS) - 1);
  const operand = word & OPERAND_MASK;

  if (!entry.usesGPR && !entry.usesOperand) {
    return { mnemonic: entry.mnemonic, operandText: "" };
  }
  if (!entry.usesGPR) {
    return { mnemonic: entry.mnemonic, operandText: `0x${operand.toString(16).toUpperCase().padStart(2, "0")}` };
  }
  const operandText = entry.mnemonic === "LDAI"
    ? `R${gprAddr}, #${operand}`
    : `R${gprAddr}, 0x${operand.toString(16).toUpperCase().padStart(2, "0")}`;
  return { mnemonic: entry.mnemonic, operandText };
}

/** Just the mnemonic — what the instruction-memory widget showed before. */
export function decodeMnemonic(word: number): string {
  return disassemble(word).mnemonic;
}
