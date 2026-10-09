/**
 * ISA.ts – Instruction Set Architecture definition for the 16-bit didactic CPU.
 *
 * Two instruction formats are supported:
 *
 * STANDARD format  (memory/branch/immediate instructions):
 * ┌──────────────────────────────────────────────────────────────┐
 * │ 15  14  13  12  11 │  10   9   8 │  7   6   5   4   3   2   1   0 │
 * │      OPCODE (5)    │  GPR ADR(3) │           OPERAND (8)           │
 * └──────────────────────────────────────────────────────────────┘
 * • OPCODE   → bits [15:11] – identifies the instruction
 * • GPR ADDR → bits [10:8]  – source/destination GPR address
 * • OPERAND  → bits [7:0]   – memory address or 8-bit immediate
 *
 * ULA format  (ADD, SUB, AND, OR, NOT):
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ 15  14  13  12  11 │  10   9   8 │   7   6   5 │  4   3 │   2   1   0 │
 * │      OPCODE (5)    │  SRC A (3)  │   SRC B (3) │  ---   │   DST  (3)  │
 * └───────────────────────────────────────────────────────────────────────┘
 * • OPCODE → bits [15:11] – identifies the instruction
 * • SRC A  → bits [10:8]  – first  operand GPR address
 * • SRC B  → bits [7:5]   – second operand GPR address
 * • (pad)  → bits [4:3]   – unused / zero
 * • DST    → bits [2:0]   – result destination GPR address
 */

// ── Bit-field constants ──────────────────────────────────────────────────────

export const ISA_WORD_SIZE   = 16; // total instruction bits
export const OPCODE_BITS     = 5;  // bits [15:11]
export const GPR_ADDR_BITS   = 3;
export const OPERAND_BITS    = 8;  // bits [7:0]

export const OPCODE_SHIFT    = ISA_WORD_SIZE - OPCODE_BITS;       // 11

// Standard format fields
const GPR_ADDR_SHIFT  = OPCODE_SHIFT - GPR_ADDR_BITS;             // 8  – bits [10:8]
const OPERAND_SHIFT   = 0;

// ULA format fields
const ULA_SRC_A_SHIFT = OPCODE_SHIFT - GPR_ADDR_BITS;             // 8  – bits [10:8]
const ULA_SRC_B_SHIFT = ULA_SRC_A_SHIFT - GPR_ADDR_BITS;          // 5  – bits [7:5]
const ULA_DST_SHIFT   = 0;                                         //      bits [2:0]
const ULA_PAD_SHIFT   = ULA_DST_SHIFT + GPR_ADDR_BITS;             // 3  – bits [4:3]

// ── Opcode enumeration ───────────────────────────────────────────────────────

/**
 * Numeric opcodes occupying bits [15:11].
 * The ISA defines 12 instructions. 0b01010 is unassigned (it once held JC,
 * which the ISA does not define); the gap is kept so JN/JMP/HLT keep their
 * encodings. Every other unassigned encoding is reserved.
 */
export enum Opcode {
  LDA  = 0b00001, // Rd ← mem[addr]
  LDAI = 0b00010, // Rd ← sign-extended 8-bit immediate
  STA  = 0b00011, // mem[addr] ← Rs
  ADD  = 0b00100, // Rd ← Ra + Rb
  SUB  = 0b00101, // Rd ← Ra - Rb
  AND  = 0b00110, // Rd ← Ra & Rb
  OR   = 0b00111, // Rd ← Ra | Rb
  NOT  = 0b01000, // Rd ← ~Ra
  JZ   = 0b01001, // Jump if zero flag
  JN   = 0b01011, // Jump if negative flag
  JMP  = 0b01100, // Unconditional jump
  HLT  = 0b01101, // Halt execution
}

export type Mnemonic = keyof typeof Opcode;

// ── Instruction format ───────────────────────────────────────────────────────

/**
 * Discriminates between the two encoding formats:
 * - `"standard"` – opcode | gprAddr | operand(8)
 * - `"ula"`      – opcode | srcA(3) | srcB(3) | pad(2) | dst(3)
 */
export type InstructionFormat = "standard" | "ula";

/** The operand fields of both formats (`gprAddr` and `srcA` share bits [10:8]). */
export type InstructionField = "gprAddr" | "operand" | "srcA" | "srcB" | "dst";

/** One bit field of an instruction word. */
export interface FieldSpec {
  name : "opcode" | InstructionField | "pad";
  shift: number;
  bits : number;
}

/** Bit layout of each format, most significant field first. */
export const FIELD_LAYOUT: Readonly<Record<InstructionFormat, readonly FieldSpec[]>> = {
  standard: [
    { name: "opcode",  shift: OPCODE_SHIFT,   bits: OPCODE_BITS   },
    { name: "gprAddr", shift: GPR_ADDR_SHIFT, bits: GPR_ADDR_BITS },
    { name: "operand", shift: OPERAND_SHIFT,  bits: OPERAND_BITS  },
  ],
  ula: [
    { name: "opcode",  shift: OPCODE_SHIFT,    bits: OPCODE_BITS   },
    { name: "srcA",    shift: ULA_SRC_A_SHIFT, bits: GPR_ADDR_BITS },
    { name: "srcB",    shift: ULA_SRC_B_SHIFT, bits: GPR_ADDR_BITS },
    { name: "pad",     shift: ULA_PAD_SHIFT,   bits: ULA_SRC_B_SHIFT - ULA_PAD_SHIFT },
    { name: "dst",     shift: ULA_DST_SHIFT,   bits: GPR_ADDR_BITS },
  ],
};

const fieldMask = (bits: number) => (1 << bits) - 1;

/** The layout entry of `field` in `format`. */
export function fieldSpec(format: InstructionFormat, field: FieldSpec["name"]): FieldSpec {
  const spec = FIELD_LAYOUT[format].find((f) => f.name === field);
  if (!spec) throw new RangeError(`Field "${field}" is not part of the ${format} format`);
  return spec;
}

/** Every named field of a word, read under both formats (they overlap). */
export type DecodedFields = Record<"opcode" | InstructionField, number>;

const NAMED_FIELDS = [...FIELD_LAYOUT.standard, ...FIELD_LAYOUT.ula].filter(
  (f): f is FieldSpec & { name: keyof DecodedFields } => f.name !== "pad",
);

/**
 * Slice a word into its fields. Both formats are read at once — which ones
 * mean something depends on the opcode, and the caller knows that.
 */
export function extractFields(word: number): DecodedFields {
  const out = {} as DecodedFields;
  for (const spec of NAMED_FIELDS) {
    out[spec.name] = (word >>> spec.shift) & fieldMask(spec.bits);
  }
  return out;
}

/** Read the low `bits` of `value` as a two's-complement number. */
export function signExtend(value: number, bits: number): number {
  const v = value & fieldMask(bits);
  return v & (1 << (bits - 1)) ? v - (1 << bits) : v;
}

/** An opcode as the binary digits of its field, e.g. `00100`. */
export function formatOpcodeBits(opcode: number): string {
  return opcode.toString(2).padStart(OPCODE_BITS, "0");
}

// ── Instruction descriptor ───────────────────────────────────────────────────

/**
 * One assembly operand. `label` is the notation the help uses (Rd destination,
 * Rs/Ra/Rb sources, M address, N immediate); `signed` widens the accepted
 * range to the field's two's-complement values as well.
 */
export interface OperandSpec {
  field : InstructionField;
  label : "Rd" | "Rs" | "Ra" | "Rb" | "M" | "N";
  kind  : "register" | "address" | "immediate";
  signed?: boolean;
}

/** Base fields shared by all instruction descriptors. */
interface BaseDescriptor {
  mnemonic   : Mnemonic;
  opcode     : Opcode;
  format     : InstructionFormat;
  /** Operands in assembly order — the source the flags below are derived from. */
  operands   : readonly OperandSpec[];
  description: string;
}

/** Descriptor for standard-format instructions. */
export interface StandardDescriptor extends BaseDescriptor {
  format      : "standard";
  /** Whether this instruction uses the GPR address field (bits [10:8]) */
  usesGPR     : boolean;
  /** Whether this instruction uses the operand field (bits [7:0]) */
  usesOperand : boolean;
}

/** Descriptor for ULA-format instructions. */
export interface ULADescriptor extends BaseDescriptor {
  format  : "ula";
  /** Whether SRC B is used (NOT only has srcA and dst) */
  usesSrcB: boolean;
}

export type InstructionDescriptor = StandardDescriptor | ULADescriptor;

const RD : OperandSpec = { field: "gprAddr", label: "Rd", kind: "register" };
const RS : OperandSpec = { field: "gprAddr", label: "Rs", kind: "register" };
const M  : OperandSpec = { field: "operand", label: "M",  kind: "address" };
const N  : OperandSpec = { field: "operand", label: "N",  kind: "immediate", signed: true };
const RA : OperandSpec = { field: "srcA",    label: "Ra", kind: "register" };
const RB : OperandSpec = { field: "srcB",    label: "Rb", kind: "register" };
const RDU: OperandSpec = { field: "dst",     label: "Rd", kind: "register" };

const uses = (operands: readonly OperandSpec[], field: InstructionField) => operands.some((o) => o.field === field);

function standard(mnemonic: Mnemonic, operands: OperandSpec[], description: string): StandardDescriptor {
  return {
    mnemonic, opcode: Opcode[mnemonic], format: "standard", operands, description,
    usesGPR: uses(operands, "gprAddr"),
    usesOperand: uses(operands, "operand"),
  };
}

function ula(mnemonic: Mnemonic, operands: OperandSpec[], description: string): ULADescriptor {
  return {
    mnemonic, opcode: Opcode[mnemonic], format: "ula", operands, description,
    usesSrcB: uses(operands, "srcB"),
  };
}

/** Full descriptor table, one entry per mnemonic. */
export const INSTRUCTION_SET: Readonly<Record<Mnemonic, InstructionDescriptor>> = {
  LDA  : standard("LDA",  [RD, M],       "Load GPR from memory address"),
  LDAI : standard("LDAI", [RD, N],       "Load GPR with sign-extended 8-bit immediate"),
  STA  : standard("STA",  [RS, M],       "Store GPR to memory address"),
  ADD  : ula     ("ADD",  [RA, RB, RDU], "DST = SRC_A + SRC_B"),
  SUB  : ula     ("SUB",  [RA, RB, RDU], "DST = SRC_A - SRC_B"),
  AND  : ula     ("AND",  [RA, RB, RDU], "DST = SRC_A & SRC_B"),
  OR   : ula     ("OR",   [RA, RB, RDU], "DST = SRC_A | SRC_B"),
  NOT  : ula     ("NOT",  [RA, RDU],     "DST = ~SRC_A"),
  JZ   : standard("JZ",   [M],           "Jump to address if zero flag is set"),
  JN   : standard("JN",   [M],           "Jump to address if negative flag is set"),
  JMP  : standard("JMP",  [M],           "Unconditional jump to address"),
  HLT  : standard("HLT",  [],            "Halt the CPU"),
};

// ── ISA helpers ──────────────────────────────────────────────────────────────

/** Maximum unsigned value that fits in a word. */
export const ISA_WORD_MAX = (1 << ISA_WORD_SIZE) - 1; // 65535

/** Every instruction, ordered by opcode. */
export const INSTRUCTIONS_BY_OPCODE: readonly InstructionDescriptor[] =
  Object.values(INSTRUCTION_SET).sort((a, b) => a.opcode - b.opcode);

const BY_OPCODE = new Map<number, InstructionDescriptor>(INSTRUCTIONS_BY_OPCODE.map((d) => [d.opcode, d]));

/**
 * The instruction an opcode encodes, or `undefined` for an unassigned one —
 * memory full of zeros and reserved encodings are normal, not errors.
 */
export function lookupInstruction(opcode: number): InstructionDescriptor | undefined {
  return BY_OPCODE.get(opcode);
}

/**
 * Resolve an opcode number to its mnemonic.
 * @throws {RangeError} for unknown opcodes.
 */
export function opcodeToMnemonic(opcode: Opcode): Mnemonic {
  const entry = lookupInstruction(opcode);
  if (!entry) throw new RangeError(`Unknown opcode: 0b${formatOpcodeBits(opcode)} (${opcode})`);
  return entry.mnemonic;
}

/** Return the {@link InstructionDescriptor} for a given mnemonic. */
export function getDescriptor(mnemonic: Mnemonic): InstructionDescriptor {
  const desc = INSTRUCTION_SET[mnemonic];
  if (!desc) throw new RangeError(`Unknown mnemonic: "${mnemonic}"`);
  return desc;
}

/** How an instruction is written in assembly, e.g. `ADD Ra, Rb, Rd`. */
export function instructionSyntax(mnemonic: Mnemonic): string {
  const labels = INSTRUCTION_SET[mnemonic].operands.map((o) => o.label).join(", ");
  return labels ? `${mnemonic} ${labels}` : mnemonic;
}

// ── ULA operation encoding ───────────────────────────────────────────────────

/** Width of the ULA's operation selector (`opULA` / `in_operation`). */
export const ULA_OP_BITS = 3;

/**
 * Numeric operation codes understood by the ULA.
 * These are the values written to the `out_opULA` control signal by the CPU
 * and read from the `in_operation` port by the ULA.
 */
export enum UlaOperation {
  ADD = 0,
  SUB = 1,
  AND = 4,
  OR  = 6,
  NOT = 7,
}

/** Every ULA operation, by code. */
export const ULA_OPERATIONS: readonly UlaOperation[] = (Object.values(UlaOperation)
  .filter((v) => typeof v === "number") as UlaOperation[])
  .sort((a, b) => a - b);

/** The operation's name (`ADD`…), or `?` for a code the ULA doesn't define. */
export function ulaOpName(op: number): string {
  return ULA_OPERATIONS.includes(op) ? UlaOperation[op] : "?";
}

/**
 * Bit positions in the ULA's 4-bit flags bus (`Ula.out_flags` → CPU
 * `in_flags`): Z C N V, most significant first.
 */
export const FLAG_BITS = { zero: 3, carry: 2, negative: 1, overflow: 0 } as const;

/** Width of the flags bus. */
export const FLAG_COUNT = Object.keys(FLAG_BITS).length;

/**
 * Maps each ALU-class opcode to the corresponding {@link UlaOperation}.
 * Only opcodes that actually drive the ULA are present; others are absent.
 */
export const OPCODE_TO_ULA_OP: Readonly<Partial<Record<Opcode, UlaOperation>>> = {
  [Opcode.ADD]: UlaOperation.ADD,
  [Opcode.SUB]: UlaOperation.SUB,
  [Opcode.AND]: UlaOperation.AND,
  [Opcode.OR]:  UlaOperation.OR,
  [Opcode.NOT]: UlaOperation.NOT,
};

// ── Instruction encoding ─────────────────────────────────────────────────────

/** Field values for {@link encodeInstruction}; a missing one encodes as 0. */
export type InstructionFields = Partial<Record<InstructionField, number>>;

/**
 * Encode an instruction into a 16-bit word. Each value is truncated to its
 * field's width (so a negative immediate lands as its two's-complement byte),
 * and fields the instruction doesn't use are left zero whatever is passed.
 *
 * @example
 * encodeInstruction("LDAI", { gprAddr: 2, operand: 0x42 }) // → 0x1242
 * encodeInstruction("HLT")                                  // → 0x6800
 */
export function encodeInstruction(mnemonic: Mnemonic, fields: InstructionFields = {}): number {
  const desc = getDescriptor(mnemonic);
  let word = (desc.opcode & fieldMask(OPCODE_BITS)) << OPCODE_SHIFT;
  for (const { field } of desc.operands) {
    const spec = fieldSpec(desc.format, field);
    word |= ((fields[field] ?? 0) & fieldMask(spec.bits)) << spec.shift;
  }
  return word;
}
