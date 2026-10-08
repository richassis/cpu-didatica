/**
 * disassemble.ts — Pure decode of a raw 16-bit instruction word back to its
 * mnemonic, for display only (no execution semantics).
 *
 * The CPU's own `Decoder` component decodes for the datapath, port-driven and
 * private. This is the read side: turning a word already sitting in memory
 * into text, used by the instruction-memory widget and the memory side panel.
 * The assembled-program listing does not need it: it carries the mnemonic the
 * assembler already knew.
 */

import { OPCODE_SHIFT, INSTRUCTION_SET } from "@/lib/simulator/ISA";

/**
 * Decode a raw word into its mnemonic.
 * Unknown opcodes (including the all-zero NOP word) decode to a placeholder
 * rather than throwing — memory is full of unassembled zeros before a program
 * loads, and the memory views have to render those cells too.
 */
export function decodeMnemonic(word: number): string {
  const opcode = (word >>> OPCODE_SHIFT) & 0b11111;
  const entry = Object.values(INSTRUCTION_SET).find((d) => d.opcode === opcode);
  if (!entry) return word === 0 ? "NOP" : "???";
  return entry.mnemonic;
}
