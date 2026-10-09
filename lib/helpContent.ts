/**
 * helpContent.ts
 *
 * The language-neutral data of the Help window; its prose lives in the
 * catalog (`reference` in `lib/i18n`). Opcodes, field positions, signal widths
 * and state sequences are read from `lib/simulator` where they are shown, and
 * each instruction's syntax and the opULA values are built from it here, so
 * they cannot drift from what the simulator does. Some numbers are written by
 * hand, though — the flag lists here, the mux values in `reference.signals`,
 * the memory and register-bank sizes in `reference.components` — and have to
 * be updated along with the hardware.
 *
 * `INSTRUCTION_HELP` here, and `reference.instructions` and
 * `reference.signals` in the catalog, are `Record`s over every mnemonic and
 * every control signal: adding one to the simulator without documenting it is
 * a compile error.
 */

import type { ControlSignalName } from "@/lib/simulator";
import { ULA_OPERATIONS, instructionSyntax, ulaOpName, type Mnemonic } from "@/lib/simulator/ISA";

export interface InstructionHelp {
  /** How it is written in assembly (from the ISA's operand list). */
  syntax: string;
  /** Which status flags it updates. */
  flags: string;
  /** A one-line example, in assembly (assembled once by the ISA tab). */
  example: string;
}

/** Hand-written part of each instruction's help; `syntax` is added below. */
const INSTRUCTION_DATA: Record<Mnemonic, Omit<InstructionHelp, "syntax">> = {
  LDA:  { flags: "Z, N",       example: "LDA R1, 5" },
  LDAI: { flags: "Z, N",       example: "LDAI R0, -3" },
  STA:  { flags: "—",          example: "STA R2, 0" },
  ADD:  { flags: "Z, C, N, V", example: "ADD R0, R1, R2" },
  SUB:  { flags: "Z, C, N, V", example: "SUB R0, R1, R2" },
  AND:  { flags: "Z, C, N, V", example: "AND R0, R1, R2" },
  OR:   { flags: "Z, C, N, V", example: "OR R0, R1, R2" },
  NOT:  { flags: "Z, C, N, V", example: "NOT R0, R1" },
  JZ:   { flags: "—",          example: "JZ 12" },
  JN:   { flags: "—",          example: "JN 20" },
  JMP:  { flags: "—",          example: "JMP 0" },
  HLT:  { flags: "—",          example: "HLT" },
};

export const INSTRUCTION_HELP = Object.fromEntries(
  (Object.keys(INSTRUCTION_DATA) as Mnemonic[]).map((m) => [m, { syntax: instructionSyntax(m), ...INSTRUCTION_DATA[m] }]),
) as Record<Mnemonic, InstructionHelp>;

/**
 * Signal values that are not words, built from the simulator. A signal's
 * `values` in the catalog, when it has one, is shown instead.
 */
export const SIGNAL_VALUES: Partial<Record<ControlSignalName, string>> = {
  opULA: ULA_OPERATIONS.map((op) => `${op} ${ulaOpName(op)}`).join(" · "),
};

/** The blocks of the datapath, in the order the Help lists them. */
export const COMPONENT_IDS = [
  "imem", "dmem", "gpr", "ula", "muxPc", "muxGprAddr", "muxGprData", "pc",
  "ir", "mar", "mdr", "ab", "r", "decoder", "pcInc", "uc",
] as const;

export type ComponentId = (typeof COMPONENT_IDS)[number];

export const CREDITS = {
  project: "CPU Didática",
  university: "Universidade Federal do Rio Grande",
  universityShort: "FURG",
  center: "Centro de Ciências Computacionais — C3",
  year: "2026",
  professor: "Ewerson Carvalho",
  student: "Richard de Assis",
  repository: "https://github.com/richassis/cpu-didatica",
} as const;
