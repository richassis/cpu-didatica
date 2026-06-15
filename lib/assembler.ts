/**
 * assembler.ts — Two-pass assembler for the 16-bit didactic CPU.
 *
 * Pass 1: scan all lines, collect label→address mappings, record pending instructions.
 * Pass 2: resolve label references, validate operand ranges, encode to 16-bit words.
 *
 * Instruction syntax (from TEST_PROGRAM_SOURCE):
 *   LDAI Rdst, #imm          — load immediate
 *   LDA  Rdst, addr          — load from data memory
 *   STA  Rsrc, addr          — store to data memory
 *   ADD  Rsrc_a, Rsrc_b, Rdst — ULA: dst = a + b
 *   SUB  Rsrc_a, Rsrc_b, Rdst — ULA: dst = a - b
 *   AND  Rsrc_a, Rsrc_b, Rdst — ULA: dst = a & b
 *   OR   Rsrc_a, Rsrc_b, Rdst — ULA: dst = a | b
 *   NOT  Rsrc_a, Rdst         — ULA: dst = ~a
 *   JZ/JC/JN/JMP  addr_or_label
 *   HLT
 *
 * Labels:
 *   LOOP:            — code label → resolves to instruction address
 *   LOOP: LDAI ...   — code label on same line as instruction
 *
 * Data section (optional):
 *   .data
 *   VAR1:            — assigns data memory address 0
 *   VAR2:            — assigns data memory address 1
 *   .text / .code    — returns to code section
 *
 * Mnemonics, registers, and label names are case-insensitive.
 * Comments start with `;` and extend to end of line.
 */

import { Encoder } from "@/lib/simulator/Encoder";
import { INSTRUCTION_SET } from "@/lib/simulator/ISA";

// ── Public types ─────────────────────────────────────────────────────────────

export interface AssemblyError {
  line: number;
  message: string;
}

export interface AssembleResult {
  words: number[];
  /** Initial values for data memory (index = data address). */
  dataWords: number[];
  errors: AssemblyError[];
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

/** Parse a numeric literal: `0xNN` hex or plain decimal → number, or null. */
function parseNumber(token: string): number | null {
  if (/^0[xX][0-9a-fA-F]+$/.test(token)) return parseInt(token, 16);
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return null;
}

/** Parse an immediate operand: `#decimal` or `#0xHH` → number, or null. */
function parseImmediate(token: string): number | null {
  if (!token.startsWith("#")) return null;
  return parseNumber(token.slice(1));
}

/**
 * Parse a data value for DB declarations.
 * Accepts: Intel hex `#00h`/`#FFh`, our format `#10`/`#0xFF`, or plain decimal `5`.
 */
function parseDataValue(token: string): number | null {
  const intelHex = token.match(/^#([0-9A-Fa-f]+)[hH]$/);
  if (intelHex) return parseInt(intelHex[1], 16);
  const imm = parseImmediate(token);
  if (imm !== null) return imm;
  return parseNumber(token);
}

/**
 * Parse a generic operand token that may be:
 *   - A register literal  →  number (0–7)
 *   - A hex literal       →  number
 *   - A decimal literal   →  number
 *   - An immediate (#N)   →  number
 *   - A label reference   →  string (UPPERCASED, to be resolved in pass 2)
 */
function parseOperandToken(token: string): Operand {
  const reg = parseRegister(token);
  if (reg !== null) return reg;

  const imm = parseImmediate(token);
  if (imm !== null) return imm;

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
}

function pass1(lines: string[]): Pass1Result {
  const labels = new Map<string, number>();
  const pending: PendingInstruction[] = [];
  const errors: AssemblyError[] = [];
  const dataWords: number[] = [];

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
        errors.push({ line: lineNum, message: `Declaração inválida na seção .data: "${line}"` });
        continue;
      }
      const name = m[1].toUpperCase();
      if (labels.has(name)) {
        errors.push({ line: lineNum, message: `Label duplicado: "${name}"` });
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
          errors.push({ line: lineNum, message: `Valor inválido na declaração DB: "${rest}"` });
        }
      }
      dataWords[dataAddr] = initialValue;
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
        errors.push({ line: lineNum, message: `Label duplicado: "${name}"` });
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
      errors.push({ line: lineNum, message: `Mnemônico desconhecido: "${tokens[0]}"` });
      codeAddr++; // still reserve an address slot
      continue;
    }

    const operands = tokens.slice(1).map(parseOperandToken);
    pending.push({ lineNum, codeAddr, mnemonic, operands });
    codeAddr++;
  }

  return { labels, pending, errors, dataWords };
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
    errors.push({ line: lineNum, message: `Label não encontrado: "${op}"` });
    return null;
  }
  return addr;
}

/** Validate that a value fits in a given bit-width field (unsigned). */
function checkRange(
  value: number,
  bits: number,
  fieldName: string,
  lineNum: number,
  errors: AssemblyError[],
): boolean {
  const max = (1 << bits) - 1;
  if (value < 0 || value > max) {
    errors.push({ line: lineNum, message: `${fieldName} fora do range 0–${max}: ${value}` });
    return false;
  }
  return true;
}

function pass2(
  pending: PendingInstruction[],
  labels: Map<string, number>,
): { words: number[]; errors: AssemblyError[] } {
  const errors: AssemblyError[] = [];

  // Determine the total instruction count (max codeAddr + 1)
  const size = pending.length > 0
    ? Math.max(...pending.map((p) => p.codeAddr)) + 1
    : 0;
  const words = new Array<number>(size).fill(0);

  for (const instr of pending) {
    const { lineNum, codeAddr, mnemonic, operands } = instr;

    const resolve = (op: Operand) => resolveOperand(op, labels, lineNum, errors);

    let word: number | null = null;

    switch (mnemonic) {
      // ── Standard: LDAI Rdst, #imm ─────────────────────────────────────────
      case "LDAI": {
        if (operands.length !== 2) {
          errors.push({ line: lineNum, message: `LDAI: esperado 2 operandos (Rdst, #imm), recebeu ${operands.length}` });
          break;
        }
        const dst = resolve(operands[0]);
        const imm = resolve(operands[1]);
        if (dst === null || imm === null) break;
        if (!checkRange(dst, 3, "Registrador", lineNum, errors)) break;
        if (!checkRange(imm, 8, "Imediato", lineNum, errors)) break;
        word = Encoder.assemble("LDAI", { gprAddr: dst, operand: imm });
        break;
      }

      // ── Standard: LDA Rdst, addr ──────────────────────────────────────────
      case "LDA": {
        if (operands.length !== 2) {
          errors.push({ line: lineNum, message: `LDA: esperado 2 operandos (Rdst, addr), recebeu ${operands.length}` });
          break;
        }
        const dst = resolve(operands[0]);
        const addr = resolve(operands[1]);
        if (dst === null || addr === null) break;
        if (!checkRange(dst, 3, "Registrador", lineNum, errors)) break;
        if (!checkRange(addr, 8, "Endereço", lineNum, errors)) break;
        word = Encoder.assemble("LDA", { gprAddr: dst, operand: addr });
        break;
      }

      // ── Standard: STA Rsrc, addr ──────────────────────────────────────────
      case "STA": {
        if (operands.length !== 2) {
          errors.push({ line: lineNum, message: `STA: esperado 2 operandos (Rsrc, addr), recebeu ${operands.length}` });
          break;
        }
        const src = resolve(operands[0]);
        const addr = resolve(operands[1]);
        if (src === null || addr === null) break;
        if (!checkRange(src, 3, "Registrador", lineNum, errors)) break;
        if (!checkRange(addr, 8, "Endereço", lineNum, errors)) break;
        word = Encoder.assemble("STA", { gprAddr: src, operand: addr });
        break;
      }

      // ── ULA: ADD/SUB/AND/OR  Rsrc_a, Rsrc_b, Rdst ────────────────────────
      case "ADD":
      case "SUB":
      case "AND":
      case "OR": {
        if (operands.length !== 3) {
          errors.push({ line: lineNum, message: `${mnemonic}: esperado 3 operandos (Rsrc_a, Rsrc_b, Rdst), recebeu ${operands.length}` });
          break;
        }
        const srcA = resolve(operands[0]);
        const srcB = resolve(operands[1]);
        const dst  = resolve(operands[2]);
        if (srcA === null || srcB === null || dst === null) break;
        if (!checkRange(srcA, 3, "SrcA", lineNum, errors)) break;
        if (!checkRange(srcB, 3, "SrcB", lineNum, errors)) break;
        if (!checkRange(dst,  3, "Dst",  lineNum, errors)) break;
        word = Encoder.assemble(mnemonic as "ADD" | "SUB" | "AND" | "OR", { srcA, srcB, dst });
        break;
      }

      // ── ULA: NOT Rsrc_a, Rdst ─────────────────────────────────────────────
      case "NOT": {
        if (operands.length !== 2) {
          errors.push({ line: lineNum, message: `NOT: esperado 2 operandos (Rsrc_a, Rdst), recebeu ${operands.length}` });
          break;
        }
        const srcA = resolve(operands[0]);
        const dst  = resolve(operands[1]);
        if (srcA === null || dst === null) break;
        if (!checkRange(srcA, 3, "SrcA", lineNum, errors)) break;
        if (!checkRange(dst,  3, "Dst",  lineNum, errors)) break;
        // srcB is unused for NOT (pass 0)
        word = Encoder.assemble("NOT", { srcA, srcB: 0, dst });
        break;
      }

      // ── Jumps: JZ/JC/JN/JMP  addr_or_label ───────────────────────────────
      case "JZ":
      case "JC":
      case "JN":
      case "JMP": {
        if (operands.length !== 1) {
          errors.push({ line: lineNum, message: `${mnemonic}: esperado 1 operando (endereço ou label), recebeu ${operands.length}` });
          break;
        }
        const target = resolve(operands[0]);
        if (target === null) break;
        if (!checkRange(target, 8, "Endereço de jump", lineNum, errors)) break;
        word = Encoder.assemble(mnemonic as "JZ" | "JC" | "JN" | "JMP", { operand: target });
        break;
      }

      // ── HLT ───────────────────────────────────────────────────────────────
      case "HLT": {
        if (operands.length !== 0) {
          errors.push({ line: lineNum, message: `HLT: não aceita operandos` });
          break;
        }
        word = Encoder.assemble("HLT");
        break;
      }

      default:
        errors.push({ line: lineNum, message: `Mnemônico desconhecido: "${mnemonic}"` });
    }

    if (word !== null) {
      words[codeAddr] = word;
    }
  }

  return { words, errors };
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Assemble the given source string into an array of 16-bit instruction words.
 *
 * @returns `null` if source is empty/whitespace-only.
 *          Otherwise returns `{ words, errors }`.
 *          When `errors` is empty the assembly succeeded.
 *          When `errors` is non-empty the words array may be partially filled.
 */
export function assemble(source: string): AssembleResult | null {
  if (!source.trim()) return null;

  const lines = source.split("\n");

  const p1 = pass1(lines);
  const p2 = pass2(p1.pending, p1.labels);

  return {
    words: p2.words,
    dataWords: p1.dataWords,
    errors: [...p1.errors, ...p2.errors],
  };
}
