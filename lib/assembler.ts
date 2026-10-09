/**
 * assembler.ts — Two-pass assembler for the 16-bit didactic CPU.
 *
 * Pass 1: scan all lines, collect label→address mappings, record pending instructions.
 * Pass 2: resolve label references, validate operand ranges, encode to 16-bit words.
 *
 * Instruction syntax:
 *   LDAI Rdst, imm           — load immediate (-128..255; negatives are two's complement)
 *   LDA  Rdst, addr          — load from data memory
 *   STA  Rsrc, addr          — store to data memory
 *   ADD  Rsrc_a, Rsrc_b, Rdst — ULA: dst = a + b
 *   SUB  Rsrc_a, Rsrc_b, Rdst — ULA: dst = a - b
 *   AND  Rsrc_a, Rsrc_b, Rdst — ULA: dst = a & b
 *   OR   Rsrc_a, Rsrc_b, Rdst — ULA: dst = a | b
 *   NOT  Rsrc_a, Rdst         — ULA: dst = ~a
 *   JZ/JN/JMP  addr_or_label
 *   HLT
 *
 * Operands are separated by commas and/or whitespace. Each one is a register
 * (`R0`..`R7`), a number (`0x1F` hex, `0b0101` binary, decimal, optionally
 * negative) or a label. Operands are only range-checked: the R/number split
 * above is the intended spelling, not something the assembler enforces.
 *
 * Labels:
 *   LOOP:            — code label → resolves to instruction address
 *   LOOP: LDAI ...   — code label on same line as instruction
 *
 * Data section (optional):
 *   .data
 *   VAR1:            — assigns data memory address 0, initial value 0
 *   VAR2: DB 05h     — assigns data memory address 1, initial value 5
 *   .text / .code    — returns to code section (`.enddata`/`.endcode` too)
 *
 * In `.data` the colon after the name and the `DB` keyword are both optional.
 * Initial values accept everything an operand number does, plus Intel-style
 * hex (`05h`, `FFh`), and are stored as 16-bit words. Code and data labels
 * share one namespace.
 *
 * Mnemonics, registers, directives and label names are case-insensitive.
 * Comments start with `;` and extend to end of line.
 */

import {
  INSTRUCTION_SET,
  encodeInstruction,
  fieldSpec,
  type InstructionDescriptor,
  type InstructionFields,
  type Mnemonic,
  type OperandSpec,
} from "@/lib/simulator/ISA";

// ── Messages ─────────────────────────────────────────────────────────────────

/**
 * How a message names an operand. Keyed by the ISA's field and help label
 * (`Rd` reads differently as a standard register and as the ULA's
 * destination); a lone address operand is a jump target.
 */
export type OperandRole = "rd" | "rs" | "imm" | "addr" | "srcA" | "srcB" | "dst" | "jumpTarget";

const OPERAND_ROLES: Readonly<Record<string, OperandRole>> = {
  "gprAddr:Rd": "rd",
  "gprAddr:Rs": "rs",
  "operand:N":  "imm",
  "operand:M":  "addr",
  "srcA:Ra":    "srcA",
  "srcB:Rb":    "srcB",
  "dst:Rd":     "dst",
};

function operandRole(desc: InstructionDescriptor, spec: OperandSpec): OperandRole {
  if (desc.operands.length === 1 && spec.kind === "address") return "jumpTarget";
  const role = OPERAND_ROLES[`${spec.field}:${spec.label}`];
  if (!role) throw new Error(`No message role for operand ${spec.field}:${spec.label}`);
  return role;
}

/**
 * Every message the assembler reports, as data: the text is written by the
 * interface in the active language (`assembler.format` in lib/i18n), so a
 * message already on screen follows a language switch.
 */
export type AssemblerMessage =
  | { code: "invalidDataLine"; line: string }
  | { code: "duplicateLabel"; name: string }
  | { code: "invalidDbValue"; text: string }
  | { code: "unknownMnemonic"; token: string }
  | { code: "labelNotFound"; name: string }
  | { code: "outOfRange"; role: OperandRole; min: number; max: number; value: number }
  | { code: "noOperands"; mnemonic: string }
  | { code: "wrongArity"; mnemonic: string; roles: OperandRole[]; got: number };

// ── Public types ─────────────────────────────────────────────────────────────

export interface AssemblyError {
  line: number;
  message: AssemblerMessage;
}

/** One assembled instruction, for the bytecode listing. */
export interface AssembledLine {
  /** 1-based source line number. */
  line: number;
  /** Address in instruction memory. */
  addr: number;
  /** Assembled 16-bit word. */
  word: number;
  mnemonic: string;
}

/** A named data-section entry, for the bytecode listing's data table. */
export interface DataSymbol {
  name: string;
  addr: number;
  value: number;
}

export interface AssembleResult {
  words: number[];
  /** Initial values for data memory (index = data address). */
  dataWords: number[];
  errors: AssemblyError[];
  /** One entry per assembled instruction, ordered by address. */
  listing: AssembledLine[];
  /** Instruction address → source line, sparse (index only where an instruction was assembled). */
  lineForAddress: number[];
  /** .data section entries in declaration order. */
  dataSymbols: DataSymbol[];
}

// ── Internal types ───────────────────────────────────────────────────────────

/** A raw operand token: either a resolved number or an unresolved label name. */
type Operand = number | string;

interface PendingInstruction {
  lineNum: number;
  codeAddr: number;
  mnemonic: string;
  operands: Operand[];
}

// ── Operand parsers ──────────────────────────────────────────────────────────

/** Parse `R0`..`R7` (case-insensitive) → 0–7, or null if not a register. */
function parseRegister(token: string): number | null {
  const m = token.match(/^[Rr]([0-7])$/);
  return m ? parseInt(m[1], 10) : null;
}

/** Parse a numeric literal: `0xNN` hex, `0b0101` binary or plain (optionally negative) decimal → number, or null. */
function parseNumber(token: string): number | null {
  if (/^0[xX][0-9a-fA-F]+$/.test(token)) return parseInt(token, 16);
  if (/^0[bB][01]+$/.test(token)) return parseInt(token.slice(2), 2);
  if (/^-?\d+$/.test(token)) return parseInt(token, 10);
  return null;
}

/**
 * Parse a data value for DB declarations.
 * Accepts: Intel hex `00h`/`FFh`, our format `0xFF`, binary `0b0101`, or
 * plain (optionally negative) decimal `5` / `-5`.
 */
function parseDataValue(token: string): number | null {
  const intelHex = token.match(/^([0-9A-Fa-f]+)[hH]$/);
  if (intelHex) return parseInt(intelHex[1], 16);
  return parseNumber(token);
}

/**
 * Parse a generic operand token that may be:
 *   - A register literal  →  number (0–7)
 *   - A numeric literal   →  number (see `parseNumber`)
 *   - A label reference   →  string (UPPERCASED, to be resolved in pass 2)
 */
function parseOperandToken(token: string): Operand {
  const reg = parseRegister(token);
  if (reg !== null) return reg;

  const num = parseNumber(token);
  if (num !== null) return num;

  // Treat as label reference
  return token.toUpperCase();
}

// ── Pass 1 ───────────────────────────────────────────────────────────────────

interface Pass1Result {
  labels: Map<string, number>;
  pending: PendingInstruction[];
  errors: AssemblyError[];
  dataWords: number[];
  dataSymbols: DataSymbol[];
}

function pass1(lines: string[]): Pass1Result {
  const labels = new Map<string, number>();
  const pending: PendingInstruction[] = [];
  const errors: AssemblyError[] = [];
  const dataWords: number[] = [];
  const dataSymbols: DataSymbol[] = [];

  let codeAddr = 0;
  let dataAddr = 0;
  let inDataSection = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;

    // Strip comment and trim
    let line = lines[i];
    const ci = line.indexOf(";");
    if (ci !== -1) line = line.slice(0, ci);
    line = line.trim();
    if (!line) continue;

    // Section directives (including Cleopatra-style .enddata / .endcode)
    const upper = line.toUpperCase();
    if (upper === ".DATA") { inDataSection = true; continue; }
    if (upper === ".TEXT" || upper === ".CODE") { inDataSection = false; continue; }
    if (upper === ".ENDDATA" || upper === ".ENDCODE") { inDataSection = false; continue; }

    // ── Data section: assign sequential data memory addresses ────────────────
    if (inDataSection) {
      // Match: LABEL or LABEL: optionally followed by DB value
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):?\s*(.*)/);
      if (!m) {
        errors.push({ line: lineNum, message: { code: "invalidDataLine", line } });
        continue;
      }
      const name = m[1].toUpperCase();
      if (labels.has(name)) {
        errors.push({ line: lineNum, message: { code: "duplicateLabel", name } });
      } else {
        labels.set(name, dataAddr);
      }

      // Optional initial value: DB <value> or just <value>
      let initialValue = 0;
      let rest = m[2].trim();
      if (rest) {
        if (rest.toUpperCase().startsWith("DB")) rest = rest.slice(2).trim();
        const val = rest ? parseDataValue(rest) : null;
        if (val !== null) {
          initialValue = val & 0xFFFF;
        } else if (rest) {
          errors.push({ line: lineNum, message: { code: "invalidDbValue", text: rest } });
        }
      }
      dataWords[dataAddr] = initialValue;
      dataSymbols.push({ name, addr: dataAddr, value: initialValue });
      dataAddr++;
      continue;
    }

    // ── Code section ─────────────────────────────────────────────────────────

    // Check for label prefix: "LABEL: [rest...]"
    const labelMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)/);
    let rest = line;
    if (labelMatch) {
      const name = labelMatch[1].toUpperCase();
      if (labels.has(name)) {
        errors.push({ line: lineNum, message: { code: "duplicateLabel", name } });
      } else {
        labels.set(name, codeAddr);
      }
      rest = labelMatch[2].trim();
      if (!rest) continue; // label-only line, no instruction
    }

    // Split into tokens (delimiters: whitespace and commas)
    const tokens = rest.split(/[\s,]+/).filter(Boolean);
    if (tokens.length === 0) continue;

    const mnemonic = tokens[0].toUpperCase();

    // Validate mnemonic
    if (!(mnemonic in INSTRUCTION_SET)) {
      errors.push({ line: lineNum, message: { code: "unknownMnemonic", token: tokens[0] } });
      codeAddr++; // still reserve an address slot
      continue;
    }

    const operands = tokens.slice(1).map(parseOperandToken);
    pending.push({ lineNum, codeAddr, mnemonic, operands });
    codeAddr++;
  }

  return { labels, pending, errors, dataWords, dataSymbols };
}

// ── Pass 2 ───────────────────────────────────────────────────────────────────

/** Resolve a single operand: if it's a label string, look it up in the table. */
function resolveOperand(
  op: Operand,
  labels: Map<string, number>,
  lineNum: number,
  errors: AssemblyError[],
): number | null {
  if (typeof op === "number") return op;
  const addr = labels.get(op);
  if (addr === undefined) {
    errors.push({ line: lineNum, message: { code: "labelNotFound", name: op } });
    return null;
  }
  return addr;
}

/**
 * Validate that a value fits in a given bit-width field.
 * By default the field is unsigned (0..max) — right for register indices,
 * addresses, and jump targets. Pass `allowNegative` for a field that also
 * accepts the field's signed range (-(max+1)/2..max) — e.g. LDAI's immediate,
 * where `-5` and its two's-complement byte `0xFB` are both valid spellings.
 */
function checkRange(
  value: number,
  bits: number,
  role: OperandRole,
  lineNum: number,
  errors: AssemblyError[],
  allowNegative = false,
): boolean {
  const max = (1 << bits) - 1;
  const min = allowNegative ? -(1 << (bits - 1)) : 0;
  if (value < min || value > max) {
    errors.push({ line: lineNum, message: { code: "outOfRange", role, min, max, value } });
    return false;
  }
  return true;
}

/**
 * Check and encode one instruction's operands against its ISA descriptor:
 * operand count, then label resolution (all operands, so every missing label
 * is reported), then each value's range in order, stopping at the first bad one.
 * @returns the encoded word, or `null` after pushing the error.
 */
function encodeOperands(
  desc: InstructionDescriptor,
  operands: Operand[],
  lineNum: number,
  errors: AssemblyError[],
  resolve: (op: Operand) => number | null,
): number | null {
  const specs = desc.operands;
  if (operands.length !== specs.length) {
    const message: AssemblerMessage = specs.length === 0
      ? { code: "noOperands", mnemonic: desc.mnemonic }
      : { code: "wrongArity", mnemonic: desc.mnemonic, roles: specs.map((spec) => operandRole(desc, spec)), got: operands.length };
    errors.push({ line: lineNum, message });
    return null;
  }

  const values = operands.map(resolve);
  const fields: InstructionFields = {};
  for (let i = 0; i < specs.length; i++) {
    const value = values[i];
    if (value === null) return null;
    fields[specs[i].field] = value;
  }

  for (const spec of specs) {
    const { bits } = fieldSpec(desc.format, spec.field);
    if (!checkRange(fields[spec.field]!, bits, operandRole(desc, spec), lineNum, errors, spec.signed)) {
      return null;
    }
  }

  return encodeInstruction(desc.mnemonic, fields);
}

function pass2(
  pending: PendingInstruction[],
  labels: Map<string, number>,
): { words: number[]; errors: AssemblyError[]; listing: AssembledLine[] } {
  const errors: AssemblyError[] = [];
  const listing: AssembledLine[] = [];

  // Determine the total instruction count (max codeAddr + 1)
  const size = pending.length > 0
    ? Math.max(...pending.map((p) => p.codeAddr)) + 1
    : 0;
  const words = new Array<number>(size).fill(0);

  for (const instr of pending) {
    const { lineNum, codeAddr, mnemonic, operands } = instr;

    const resolve = (op: Operand) => resolveOperand(op, labels, lineNum, errors);

    const desc = INSTRUCTION_SET[mnemonic as Mnemonic];
    const word = encodeOperands(desc, operands, lineNum, errors, resolve);

    if (word !== null) {
      words[codeAddr] = word;
      listing.push({ line: lineNum, addr: codeAddr, word, mnemonic });
    }
  }

  listing.sort((a, b) => a.addr - b.addr);
  return { words, errors, listing };
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Assemble the given source string into instruction words, initial data and
 * the listing the UI shows.
 *
 * @returns `null` if source is empty/whitespace-only, otherwise an
 *          `AssembleResult`. When `errors` is empty the assembly succeeded;
 *          when it is non-empty the other fields may be partially filled.
 */
export function assemble(source: string): AssembleResult | null {
  if (!source.trim()) return null;

  const lines = source.split("\n");

  const p1 = pass1(lines);
  const p2 = pass2(p1.pending, p1.labels);

  const lineForAddress: number[] = [];
  for (const entry of p2.listing) {
    lineForAddress[entry.addr] = entry.line;
  }

  return {
    words: p2.words,
    dataWords: p1.dataWords,
    errors: [...p1.errors, ...p2.errors],
    listing: p2.listing,
    lineForAddress,
    dataSymbols: p1.dataSymbols,
  };
}
