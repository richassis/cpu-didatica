import { Encoder } from "@/lib/simulator/Encoder";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { InstructionMemory } from "@/lib/simulator/InstructionMemory";
import { Memory } from "@/lib/simulator/Memory";

/**
 * Full ISA test program.
 *
 * Tests every instruction in the following order:
 *   LDAI, ADD, SUB, AND, OR, NOT, STA, LDA, JZ, JN, JC, JMP, HLT
 *
 * ─────────────────────────────────────────────────────────────────────
 * EXPECTED FINAL STATE (after HLT at address 27)
 * ─────────────────────────────────────────────────────────────────────
 *
 * GPR registers:
 *   R0 =  10  (0x000A)  — base value, loaded by LDAI
 *   R1 =   3  (0x0003)  — base value, loaded by LDAI
 *   R2 =  13  (0x000D)  — ADD R0+R1
 *   R3 =   7  (0x0007)  — SUB R0-R1
 *   R4 =   2  (0x0002)  — AND R0 & R1  (0b1010 & 0b0011 = 0b0010)
 *   R5 =  11  (0x000B)  — OR  R0 | R1  (0b1010 | 0b0011 = 0b1011)
 *   R6 = 65525 (0xFFF5) — NOT R0       (~10 & 0xFFFF = 65525)
 *   R7 =  13  (0x000D)  — LDA from mem[0x00] (which holds ADD result)
 *
 * Memory cells:
 *   mem[0x00] = 13  (0x000D)  — stored by STA R2 → mem[0x00]  (ADD result)
 *   mem[0x01] = 7   (0x0007)  — stored by STA R3 → mem[0x01]  (SUB result)
 *   mem[0x02] = 0   (0x0000)  — untouched (zero by default)
 *   all other cells = 0
 *
 * ─────────────────────────────────────────────────────────────────────
 * PROGRAM (28 instructions, addresses 0x00–0x1B)
 * ─────────────────────────────────────────────────────────────────────
 *
 * Addr  Instruction              Comment
 *  00   LDAI R0, #10             R0 = 10
 *  01   LDAI R1, #3              R1 = 3
 *
 *  -- ULA tests --
 *  02   ADD  R0, R1 → R2         R2 = R0+R1 = 13
 *  03   SUB  R0, R1 → R3         R3 = R0-R1 = 7
 *  04   AND  R0, R1 → R4         R4 = R0&R1 = 2
 *  05   OR   R0, R1 → R5         R5 = R0|R1 = 11
 *  06   NOT  R0     → R6         R6 = ~R0 & 0xFFFF = 65525
 *
 *  -- Memory tests --
 *  07   STA  R2, 0x00            mem[0x00] = 13
 *  08   STA  R3, 0x01            mem[0x01] = 7
 *  09   LDA  R7, 0x00            R7 = mem[0x00] = 13
 *
 *  -- JZ test: zero result path --
 *  10   LDAI R0, #0              R0 = 0  (set zero flag via next SUB)
 *  11   SUB  R0, R0 → R0         R0 = 0-0 = 0  → zero flag set
 *  12   JZ   0x0E                should jump to addr 14 (zero flag IS set)
 *  13   HLT                      MUST NOT execute (would signal JZ failure)
 *
 *  14   LDAI R0, #10             restore R0 = 10 (after successful JZ)
 *
 *  -- JN test: negative result path --
 *  15   LDAI R1, #20             R1 = 20
 *  16   SUB  R0, R1 → R0         R0 = 10-20 → raw=-10 → 65526 (0xFFF6); negative flag set
 *  17   JN   0x13                should jump to addr 19 (negative flag IS set)
 *  18   HLT                      MUST NOT execute (would signal JN failure)
 *
 *  19   LDAI R0, #10             restore R0 = 10 (after successful JN)
 *  20   LDAI R1, #3              restore R1 = 3
 *
 *  -- JC test: carry/overflow path --
 *  21   LDAI R0, #255            R0 = 255
 *  22   LDAI R1, #2              R1 = 2
 *  23   ADD  R0, R1 → R0         R0 = 255+2 = 257, but raw = 257 > 65535? No. 257 ≤ 65535.
 *                                Actually for 16-bit: 257 fits, carry=0.
 *                                Use larger values: R0=65535 (max), R1=2 → sum=65537 > 65535 → carry=1
 *                                BUT LDAI only supports 8-bit immediate (0–255).
 *                                Strategy: LDAI R0, #255, LDAI R1, #255, ADD R0,R1→R0  → 510, no carry.
 *                                We need ADD to overflow 65535. Use NOT to get 0xFFFF first:
 *                                LDAI R0, #0 → NOT R0→R0 → R0=0xFFFF=65535; LDAI R1,#1 → ADD R0,R1→R0
 *                                → raw=65536 > 65535 → result=0, carry=1
 *
 *  -- JC test (revised) --
 *  21   LDAI R0, #0              R0 = 0
 *  22   NOT  R0     → R0         R0 = ~0 & 0xFFFF = 65535  (0xFFFF)
 *  23   LDAI R1, #1              R1 = 1
 *  24   ADD  R0, R1 → R0         R0 = 65535+1 = 65536 → result=0, carry=1
 *  25   JC   0x1B                should jump to addr 27 (carry IS set)
 *  26   HLT                      MUST NOT execute (would signal JC failure)
 *
 *  -- JMP test --
 *  27   JMP  0x1D                jump to addr 29 (unconditional)
 *  28   HLT                      MUST NOT execute (would signal JMP failure)
 *
 *  29   HLT                      normal program end ← execution stops here
 *
 * ─────────────────────────────────────────────────────────────────────
 * NOTE: R0 and R1 are modified by the branch tests.
 * FINAL GPR values reflect state AFTER all instructions execute:
 *   R0 = 0     (0x0000)  ADD overflow result (65535+1)
 *   R1 = 1     (0x0001)  last LDAI R1,#1
 *   R2 = 13    (0x000D)  ADD R0(10)+R1(3)
 *   R3 = 7     (0x0007)  SUB R0(10)-R1(3)
 *   R4 = 2     (0x0002)  AND 10&3
 *   R5 = 11    (0x000B)  OR  10|3
 *   R6 = 65525 (0xFFF5)  NOT 10
 *   R7 = 13    (0x000D)  LDA from mem[0x00]
 *
 * Memory:
 *   mem[0x00] = 13  (ADD result)
 *   mem[0x01] = 7   (SUB result)
 */
/**
 * Assembly source text displayed in the editor on startup.
 * Mirrors the binary program loaded by loadTestProgram() exactly.
 * (Assembler not yet implemented — execution uses the binary loader.)
 */
export const TEST_PROGRAM_SOURCE = `\
; ── ISA Full Test Program ──────────────────────────────────────────────────
; Tests all 13 instructions: LDAI, ADD, SUB, AND, OR, NOT,
;                             STA, LDA, JZ, JN, JC, JMP, HLT
;
; Expected final state (CPU halts at 0x1B):
;   R0=0  R1=1  R2=13  R3=7  R4=2  R5=11  R6=65525  R7=13
;   mem[0x00]=13  mem[0x01]=7
; ────────────────────────────────────────────────────────────────────────────

; Phase 1 — Load base values
LDAI R0, #10        ; [0x00] R0 = 10
LDAI R1, #3         ; [0x01] R1 = 3

; Phase 2 — ULA operations
ADD  R0, R1, R2     ; [0x02] R2 = R0+R1 = 13
SUB  R0, R1, R3     ; [0x03] R3 = R0-R1 = 7
AND  R0, R1, R4     ; [0x04] R4 = R0&R1 = 2  (0b1010 & 0b0011)
OR   R0, R1, R5     ; [0x05] R5 = R0|R1 = 11 (0b1010 | 0b0011)
NOT  R0,     R6     ; [0x06] R6 = ~R0  = 65525 (0xFFF5)

; Phase 3 — Memory store / load
STA  R2, 0x00       ; [0x07] mem[0x00] = 13
STA  R3, 0x01       ; [0x08] mem[0x01] = 7
LDA  R7, 0x00       ; [0x09] R7 = mem[0x00] = 13

; Phase 4 — JZ (jump if zero flag)
LDAI R0, #0         ; [0x0A] R0 = 0
SUB  R0, R0, R0     ; [0x0B] R0 = 0-0 = 0  → zero flag set
JZ   0x0E           ; [0x0C] ✓ jumps to 0x0E
HLT                 ; [0x0D] ⛔ MUST NOT REACH — JZ failed

; Phase 5 — JN (jump if negative flag)
LDAI R0, #10        ; [0x0E] R0 = 10  (restore)
LDAI R1, #20        ; [0x0F] R1 = 20
SUB  R0, R1, R0     ; [0x10] R0 = 10-20 = 65526  → negative flag set
JN   0x13           ; [0x11] ✓ jumps to 0x13
HLT                 ; [0x12] ⛔ MUST NOT REACH — JN failed

; Phase 6 — JC (jump if carry flag)
LDAI R0, #0         ; [0x13] R0 = 0
NOT  R0,     R0     ; [0x14] R0 = ~0 = 65535 (0xFFFF)
LDAI R1, #1         ; [0x15] R1 = 1
ADD  R0, R1, R0     ; [0x16] R0 = 65535+1 → 0  carry flag set
JC   0x19           ; [0x17] ✓ jumps to 0x19
HLT                 ; [0x18] ⛔ MUST NOT REACH — JC failed

; Phase 7 — JMP (unconditional jump)
JMP  0x1B           ; [0x19] ✓ unconditional jump to 0x1B
HLT                 ; [0x1A] ⛔ MUST NOT REACH — JMP failed

; All tests passed
HLT                 ; [0x1B] ✅ Normal end
`;

export function loadTestProgram(): void {
  const sim = useSimulatorStore.getState();

  const imemEntry = Array.from(sim.objects.entries()).find(([, obj]) => obj instanceof InstructionMemory);
  if (!imemEntry) {
    console.warn("[testProgram] No InstructionMemory found");
    return;
  }

  const imem = imemEntry[1] as InstructionMemory;

  // ── Phase 1: Load base values ───────────────────────────────────────────
  // R0=10, R1=3
  const instructions = [
    /* 00 */ Encoder.assemble("LDAI", { gprAddr: 0, operand: 10 }),   // R0 = 10
    /* 01 */ Encoder.assemble("LDAI", { gprAddr: 1, operand: 3 }),    // R1 = 3

    // ── Phase 2: ULA tests ─────────────────────────────────────────────────
    /* 02 */ Encoder.assemble("ADD",  { srcA: 0, srcB: 1, dst: 2 }),  // R2 = R0+R1 = 13
    /* 03 */ Encoder.assemble("SUB",  { srcA: 0, srcB: 1, dst: 3 }),  // R3 = R0-R1 = 7
    /* 04 */ Encoder.assemble("AND",  { srcA: 0, srcB: 1, dst: 4 }),  // R4 = R0&R1 = 2
    /* 05 */ Encoder.assemble("OR",   { srcA: 0, srcB: 1, dst: 5 }),  // R5 = R0|R1 = 11
    /* 06 */ Encoder.assemble("NOT",  { srcA: 0, srcB: 0, dst: 6 }),  // R6 = ~R0 = 65525

    // ── Phase 3: Memory tests ──────────────────────────────────────────────
    /* 07 */ Encoder.assemble("STA",  { gprAddr: 2, operand: 0x00 }), // mem[0x00] = R2 = 13
    /* 08 */ Encoder.assemble("STA",  { gprAddr: 3, operand: 0x01 }), // mem[0x01] = R3 = 7
    /* 09 */ Encoder.assemble("LDA",  { gprAddr: 7, operand: 0x00 }), // R7 = mem[0x00] = 13

    // ── Phase 4: JZ test ───────────────────────────────────────────────────
    /* 10 */ Encoder.assemble("LDAI", { gprAddr: 0, operand: 0 }),    // R0 = 0
    /* 11 */ Encoder.assemble("SUB",  { srcA: 0, srcB: 0, dst: 0 }),  // R0 = 0-0 = 0 (zero flag set)
    /* 12 */ Encoder.assemble("JZ",   { operand: 14 }),               // if ZF: jump to 14
    /* 13 */ Encoder.assemble("HLT"),                                 // MUST NOT REACH (JZ failure)

    // ── Phase 5: JN test ───────────────────────────────────────────────────
    /* 14 */ Encoder.assemble("LDAI", { gprAddr: 0, operand: 10 }),   // R0 = 10  (restore)
    /* 15 */ Encoder.assemble("LDAI", { gprAddr: 1, operand: 20 }),   // R1 = 20
    /* 16 */ Encoder.assemble("SUB",  { srcA: 0, srcB: 1, dst: 0 }),  // R0 = 10-20 → 65526 (NF set)
    /* 17 */ Encoder.assemble("JN",   { operand: 19 }),               // if NF: jump to 19
    /* 18 */ Encoder.assemble("HLT"),                                 // MUST NOT REACH (JN failure)

    // ── Phase 6: JC test ───────────────────────────────────────────────────
    /* 19 */ Encoder.assemble("LDAI", { gprAddr: 0, operand: 0 }),    // R0 = 0
    /* 20 */ Encoder.assemble("NOT",  { srcA: 0, srcB: 0, dst: 0 }),  // R0 = ~0 = 65535 (0xFFFF)
    /* 21 */ Encoder.assemble("LDAI", { gprAddr: 1, operand: 1 }),    // R1 = 1
    /* 22 */ Encoder.assemble("ADD",  { srcA: 0, srcB: 1, dst: 0 }),  // R0 = 65535+1 → 0 (carry set)
    /* 23 */ Encoder.assemble("JC",   { operand: 25 }),               // if CF: jump to 25
    /* 24 */ Encoder.assemble("HLT"),                                 // MUST NOT REACH (JC failure)

    // ── Phase 7: JMP test ──────────────────────────────────────────────────
    /* 25 */ Encoder.assemble("JMP",  { operand: 27 }),               // unconditional jump to 27
    /* 26 */ Encoder.assemble("HLT"),                                 // MUST NOT REACH (JMP failure)

    // ── End ────────────────────────────────────────────────────────────────
    /* 27 */ Encoder.assemble("HLT"),                                 // normal end — ALL TESTS PASSED
  ];

  imem.load(instructions);

  // Reset data memory to known-zero state
  const memEntry = Array.from(sim.objects.entries()).find(([, obj]) => obj instanceof Memory);
  if (memEntry) {
    (memEntry[1] as Memory).reset();
  }

  sim.touch();

  console.log(
    "[testProgram] ISA test program loaded (%d instructions):",
    instructions.length,
    instructions.map((w) => `0x${w.toString(16).padStart(4, "0")}`),
  );
}

/**
 * Expected final state after the test program completes (CPU halted at addr 27).
 *
 * Use this as a reference to verify the simulator is working correctly.
 */
export const TEST_PROGRAM_EXPECTED = {
  /** GPR register values [R0..R7] */
  gpr: [
    0,      // R0 = 0      — 65535+1 overflowed to 0 (JC carry test)
    1,      // R1 = 1      — last LDAI R1,#1 before carry test
    13,     // R2 = 13     — ADD: 10+3
    7,      // R3 = 7      — SUB: 10-3
    2,      // R4 = 2      — AND: 10&3  (0b1010 & 0b0011 = 0b0010)
    11,     // R5 = 11     — OR:  10|3  (0b1010 | 0b0011 = 0b1011)
    65525,  // R6 = 65525  — NOT: ~10 & 0xFFFF (0xFFF5)
    13,     // R7 = 13     — LDA from mem[0x00]
  ],

  /** Data memory cells (only non-zero entries shown) */
  memory: {
    0x00: 13,  // STA R2 (ADD result)
    0x01: 7,   // STA R3 (SUB result)
  },

  /** Program counter at halt */
  haltAddress: 27,

  /** Human-readable test description */
  description: [
    "LDAI R0,#10 → R0=10",
    "LDAI R1,#3  → R1=3",
    "ADD  R0,R1→R2 → R2=13",
    "SUB  R0,R1→R3 → R3=7",
    "AND  R0,R1→R4 → R4=2",
    "OR   R0,R1→R5 → R5=11",
    "NOT  R0→R6   → R6=65525 (0xFFF5)",
    "STA  R2,0x00 → mem[0]=13",
    "STA  R3,0x01 → mem[1]=7",
    "LDA  R7,0x00 → R7=13",
    "JZ:  SUB R0,R0→R0=0; JZ→14 (skip HLT at 13)",
    "JN:  SUB R0(10),R1(20)→65526; JN→19 (skip HLT at 18)",
    "JC:  NOT R0→65535; ADD+1→0,carry; JC→25 (skip HLT at 24)",
    "JMP: JMP→27 (skip HLT at 26)",
    "HLT at addr 27 — all instructions tested",
  ],
} as const;
