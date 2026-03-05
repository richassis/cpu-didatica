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

// Standard format fields
export const OPCODE_SHIFT    = ISA_WORD_SIZE - OPCODE_BITS;       // 11
export const GPR_ADDR_SHIFT  = OPCODE_SHIFT - GPR_ADDR_BITS;      // 8  – bits [10:8]
export const OPERAND_SHIFT   = 0;

export const OPCODE_MASK     = ((1 << OPCODE_BITS)   - 1) << OPCODE_SHIFT;   // 0b1111100000000000
export const GPR_ADDR_MASK   = ((1 << GPR_ADDR_BITS) - 1) << GPR_ADDR_SHIFT; // 0b0000011100000000
export const OPERAND_MASK    = ((1 << OPERAND_BITS)  - 1) << OPERAND_SHIFT;  // 0b0000000011111111

// ULA format fields
export const ULA_SRC_A_SHIFT = OPCODE_SHIFT - GPR_ADDR_BITS;      // 8  – bits [10:8]
export const ULA_SRC_B_SHIFT = ULA_SRC_A_SHIFT - GPR_ADDR_BITS;   // 5  – bits [7:5]
export const ULA_DST_SHIFT   = 0;                                  //      bits [2:0]

export const ULA_SRC_A_MASK  = ((1 << GPR_ADDR_BITS) - 1) << ULA_SRC_A_SHIFT; // 0b0000011100000000
export const ULA_SRC_B_MASK  = ((1 << GPR_ADDR_BITS) - 1) << ULA_SRC_B_SHIFT; // 0b0000000011100000
export const ULA_DST_MASK    = ((1 << GPR_ADDR_BITS) - 1) << ULA_DST_SHIFT;   // 0b0000000000000111

// ── Opcode enumeration ───────────────────────────────────────────────────────

/**
 * Numeric opcodes occupying bits [15:11].
 * Values 0–12 are assigned sequentially; the remaining 19 encodings are
 * reserved for future extensions.
 */
export enum Opcode {
  LDA  = 0b00000, // Load register from memory address
  LDAI = 0b00010, // Load register with immediate value
  STA  = 0b00011, // Store register to memory address
  ADD  = 0b00100, // GPR[dst] = GPR[dst] + mem[addr]
  SUB  = 0b00101, // GPR[dst] = GPR[dst] - mem[addr]
  AND  = 0b00110, // GPR[dst] = GPR[dst] & mem[addr]
  OR   = 0b00111, // GPR[dst] = GPR[dst] | mem[addr]
  NOT  = 0b01000, // GPR[dst] = ~GPR[dst]
  JZ   = 0b01001, // Jump if zero flag
  JC   = 0b01010, // Jump if carry flag
  JN   = 0b01011, // Jump if negative flag
  JMP  = 0b01100, // Unconditional jump
  HLT  = 0b01101, // Halt execution
}

// ── Instruction format ───────────────────────────────────────────────────────

/**
 * Discriminates between the two encoding formats:
 * - `"standard"` – opcode | gprAddr | operand(8)
 * - `"ula"`      – opcode | srcA(3) | srcB(3) | pad(2) | dst(3)
 */
export type InstructionFormat = "standard" | "ula";

// ── Instruction descriptor ───────────────────────────────────────────────────

/** Base fields shared by all instruction descriptors. */
interface BaseDescriptor {
  mnemonic   : keyof typeof Opcode;
  opcode     : Opcode;
  format     : InstructionFormat;
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

/** Full descriptor table, one entry per mnemonic. */
export const INSTRUCTION_SET: Readonly<Record<keyof typeof Opcode, InstructionDescriptor>> = {
  LDA  : { mnemonic: "LDA",  opcode: Opcode.LDA,  format: "standard", usesGPR: true,  usesOperand: true,  description: "Load GPR from memory address"           },
  LDAI : { mnemonic: "LDAI", opcode: Opcode.LDAI, format: "standard", usesGPR: true,  usesOperand: true,  description: "Load GPR with 8-bit immediate value"     },
  STA  : { mnemonic: "STA",  opcode: Opcode.STA,  format: "standard", usesGPR: true,  usesOperand: true,  description: "Store GPR to memory address"             },
  ADD  : { mnemonic: "ADD",  opcode: Opcode.ADD,  format: "ula",      usesSrcB: true,                     description: "DST = SRC_A + SRC_B"                    },
  SUB  : { mnemonic: "SUB",  opcode: Opcode.SUB,  format: "ula",      usesSrcB: true,                     description: "DST = SRC_A - SRC_B"                    },
  AND  : { mnemonic: "AND",  opcode: Opcode.AND,  format: "ula",      usesSrcB: true,                     description: "DST = SRC_A & SRC_B"                    },
  OR   : { mnemonic: "OR",   opcode: Opcode.OR,   format: "ula",      usesSrcB: true,                     description: "DST = SRC_A | SRC_B"                    },
  NOT  : { mnemonic: "NOT",  opcode: Opcode.NOT,  format: "ula",      usesSrcB: false,                    description: "DST = ~SRC_A"                           },
  JZ   : { mnemonic: "JZ",   opcode: Opcode.JZ,   format: "standard", usesGPR: false, usesOperand: true,  description: "Jump to address if zero flag is set"     },
  JC   : { mnemonic: "JC",   opcode: Opcode.JC,   format: "standard", usesGPR: false, usesOperand: true,  description: "Jump to address if carry flag is set"    },
  JN   : { mnemonic: "JN",   opcode: Opcode.JN,   format: "standard", usesGPR: false, usesOperand: true,  description: "Jump to address if negative flag is set" },
  JMP  : { mnemonic: "JMP",  opcode: Opcode.JMP,  format: "standard", usesGPR: false, usesOperand: true,  description: "Unconditional jump to address"           },
  HLT  : { mnemonic: "HLT",  opcode: Opcode.HLT,  format: "standard", usesGPR: false, usesOperand: false, description: "Halt the CPU"                           },
};

// ── Decoded instruction ───────────────────────────────────────────────────────

/** Decoded standard-format instruction. */
export interface DecodedStandardInstruction {
  format  : "standard";
  raw     : number;
  opcode  : Opcode;
  mnemonic: keyof typeof Opcode;
  /** GPR address (bits [10:8]); only valid when descriptor.usesGPR === true */
  gprAddr : number;
  /** 8-bit operand (bits [7:0]); only valid when descriptor.usesOperand === true */
  operand : number;
}

/** Decoded ULA-format instruction. */
export interface DecodedULAInstruction {
  format  : "ula";
  raw     : number;
  opcode  : Opcode;
  mnemonic: keyof typeof Opcode;
  /** First source GPR address (bits [10:8]) */
  srcA    : number;
  /** Second source GPR address (bits [7:5]); only valid when descriptor.usesSrcB === true */
  srcB    : number;
  /** Destination GPR address (bits [2:0]) */
  dst     : number;
}

export type DecodedInstruction = DecodedStandardInstruction | DecodedULAInstruction;

// ── ISA helpers ──────────────────────────────────────────────────────────────

/** Maximum unsigned value that fits in a word. */
export const ISA_WORD_MAX = (1 << ISA_WORD_SIZE) - 1; // 65535

/**
 * Resolve an opcode number to its mnemonic.
 * @throws {RangeError} for unknown opcodes.
 */
export function opcodeToMnemonic(opcode: Opcode): keyof typeof Opcode {
  const entry = Object.values(INSTRUCTION_SET).find(d => d.opcode === opcode);
  if (!entry) throw new RangeError(`Unknown opcode: 0b${opcode.toString(2).padStart(OPCODE_BITS, "0")} (${opcode})`);
  return entry.mnemonic;
}

/** Return the {@link InstructionDescriptor} for a given mnemonic. */
export function getDescriptor(mnemonic: keyof typeof Opcode): InstructionDescriptor {
  const desc = INSTRUCTION_SET[mnemonic];
  if (!desc) throw new RangeError(`Unknown mnemonic: "${mnemonic}"`);
  return desc;
}

// ── ULA operation encoding ───────────────────────────────────────────────────

/**
 * Numeric operation codes understood by the ULA.
 * These are the values written to the `out_opULA` control signal by the CPU
 * and read from the `in_operation` port by the ULA.
 */
export enum UlaOperation {
  ADD = 0,
  SUB = 1,
  AND = 4,
  OR  = 5,
  NOT = 6,
}

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
