import { CpuState } from "@/lib/simulator/CpuState";
import type { Messages } from "../index";

export const reference: Messages["reference"] = {
  isa: {
    formatHeading: "An instruction is 16 bits wide",
    formatIntro: () => (
      <>
        The first 5 bits are always the <b className="text-fg">opcode</b>, which says which instruction it is.
        The rest depends on each instruction&apos;s format: a register and an address{" "}
        <b className="text-fg">M</b>, a register and a value <b className="text-fg">N</b>, just an
        address, three ALU registers — or nothing, for HLT. Fields marked{" "}
        <span className="font-mono text-fg">—</span> are unused.
      </>
    ),
    groups: {
      loadStore: { title: "LDA and STA", registerMeaning: "dest. (LDA) · source (STA)" },
      ldai:      { title: "LDAI" },
      branches:  { title: "Branches — JZ, JN and JMP" },
      hlt:       { title: "HLT" },
      alu:       { title: "ALU — ADD, SUB, AND and OR" },
      not:       { title: "NOT" },
    },

    instructionsHeading: (n: number) => `The ${n} instructions`,
    instructionsIntro: () => (
      <>
        <b className="text-fg">Rd</b> is the destination; <b className="text-fg">Rs</b>, <b className="text-fg">Ra</b> and{" "}
        <b className="text-fg">Rb</b> are sources; <b className="text-fg">M</b> is a memory address
        (0 to 255) or label; and <b className="text-fg">N</b> is a value from −128 to 127 (128 to 255 is the
        same byte, read as negative). Click a row to see the instruction encoded below.
      </>
    ),
    columns: {
      opcode: "Opcode",
      syntax: "Syntax",
      exampleWord: "Example word",
      effect: "Effect",
      format: "Format",
      flags: "Flags",
      ticks: "Ticks",
    },
    formats: { ula: "ALU", standard: "default" },
    ticksNote:
      "Ticks: how many clock cycles the instruction takes, counting FETCH and DECODE. " +
      "ALU operations update the Z (zero), C (carry), N (negative) and V (overflow) flags in both " +
      "the ALU and the CU; LDA and LDAI update only Z and N in the CU. " +
      "Branches read the most recently captured flag.",

    encoderHeading: "Encoder",
    encoderIntro: () => (
      <>
        Type an instruction (<span className="font-mono">LDAI R0, -3</span>) or a machine word in
        hexadecimal (<span className="font-mono">0x2143</span>) or binary, and see its bits split into
        fields.
      </>
    ),
    encoderInput: "Instruction or machine word",
    tooManyHexDigits: "A word has at most 4 hexadecimal digits (16 bits).",
    oneInstruction: "Type one instruction at a time.",
    unknownOpcode: "unknown opcode",
  },

  instructions: {
    LDA:  { effect: "Rd ← DMem[M]" },
    LDAI: { effect: "Rd ← N (8 bits, sign-extended to 16)" },
    STA:  { effect: "DMem[M] ← Rs" },
    ADD:  { effect: "Rd ← Ra + Rb" },
    SUB:  { effect: "Rd ← Ra − Rb" },
    AND:  { effect: "Rd ← Ra and Rb (bitwise)" },
    OR:   { effect: "Rd ← Ra or Rb (bitwise)" },
    NOT:  { effect: "Rd ← not Ra (bitwise)" },
    JZ:   { effect: "if Z = 1: PC ← M" },
    JN:   { effect: "if N = 1: PC ← M" },
    JMP:  { effect: "PC ← M (always)" },
    HLT:  { effect: "halts execution" },
  },

  bitFields: {
    labels: {
      opcode:  "Opcode",
      gprAddr: "R",
      operand: "Operand (M or N)",
      srcA:    "Ra",
      srcB:    "Rb",
      pad:     "—",
      dst:     "Rd",
    },
    meanings: {
      firstOperand:        "first operand",
      secondOperand:       "second operand",
      unusedByNot:         "unused (NOT)",
      resultDestination:   "result destination",
      unused:              "unused",
      sourceRegister:      "source register",
      destinationRegister: "destination register",
      immediate:           "immediate value N",
      address:             "address M",
    },
  },

  datapath: {
    heading: "The datapath",
    intro:
      "A simplified schematic. The blue lines are data wires; the control unit (CU) sends the " +
      "control signals to every block. The full drawing, with every wire, is the one you see " +
      "next to the code.",
    componentsHeading: "Components",

    signalsHeading: "Control signals",
    signalsIntro:
      "The CU computes nothing: it turns these signals on and off, state by state, and the blocks " +
      "do the rest.",
    signalColumns: { signal: "Signal", bits: "Bits", does: "What it does", values: "Values" },

    fsmHeading: "State machine",
    fsmIntro: () => (
      <>
        Every instruction starts with <b className="text-fg">FETCH</b> and{" "}
        <b className="text-fg">DECODE</b>. Then the opcode picks the path. Each state lasts one
        clock tick and, when the instruction ends, the CU returns to FETCH.
      </>
    ),
    sequenceColumns: { instruction: "Instruction", states: "States" },
    statesHeading: "What each state does and which signals it sets",
    stateColumns: { state: "State", does: "What it does" },
    fromInstruction: "from the instruction",
    statesNote:
      "· the state leaves the signal alone, so it keeps its previous value. * only if the branch is " +
      "taken: JMP always; JZ and JN when the corresponding flag is set. In the RESET state every " +
      "signal returns to its initial value.",

    schematic: {
      label: "Simplified datapath schematic",
      decoder: "Decoder",
      gprData: "data",
      alu: "ALU",
      controlUnit: "CU — state machine that issues the control signals to every block",
      irOperand: "IR operand M",
      gprDataSources: "immediate · memory · ALU",
    },
  },

  states: {
    [CpuState.RESET]:     "Clears the control signals and returns to FETCH.",
    [CpuState.FETCH]:     "Reads IMem[PC] into the IR, and the PC advances to PC+1.",
    [CpuState.DECODE]:    "The decoder splits the IR into its fields and the CU picks the next state from the opcode (HLT stops).",
    [CpuState.READMEM]:   "LDA: reads DMem[M] into the MDR.",
    [CpuState.WRITEREG1]: "LDA: writes the data read (MDR) to the destination register.",
    [CpuState.WRITEREG2]: "LDAI: writes the immediate to the destination register.",
    [CpuState.READREG1]:  "STA: reads the source register into A.",
    [CpuState.WRITEMEM]:  "STA: writes A to DMem[M].",
    [CpuState.READREG2]:  "ALU instructions: read both source registers into A and B.",
    [CpuState.EXECUTE]:   "The ALU computes A op B, and the Z, C, N and V flags are captured.",
    [CpuState.WRITEREG3]: "Writes the ALU result (R) to the destination register.",
    [CpuState.WRITEPC]:   "Branches: if the condition holds, loads address M into the PC.",
    [CpuState.HALT]:      "Execution has finished.",
  },

  signals: {
    muxPC:   { does: "Where the next PC comes from.", values: "1 = PC+1 · 0 = branch address" },
    wrPC:    { does: "Enables writing to the PC." },
    wrIR:    { does: "Enables writing to the IR." },
    rdMem:   { does: "Enables reading from data memory." },
    wrMem:   { does: "Enables writing to data memory." },
    muxAReg: { does: "Which instruction field addresses the GPR write.", values: "0 = register field · 1 = ALU destination field" },
    muxDReg: { does: "Which data is written to the GPR.", values: "0 = immediate · 1 = data memory · 2 = ALU result" },
    wrReg:   { does: "Enables writing to the register file." },
    opULA:   { does: "Which operation the ALU performs." },
  },

  components: {
    imem:       { name: "IMem", spec: "256 16-bit words · 8-bit address", role: "Holds the program's instructions. It is read-only during execution." },
    dmem:       { name: "DMem", spec: "256 16-bit words · 8-bit address", role: "Holds the program's data. Read with rdMem, written with wrMem." },
    gpr:        { name: "GPR", spec: "8 16-bit registers (R0 to R7) · 3-bit address", role: "Register file: two reads at once and one write, with wrReg." },
    ula:        { name: "ALU", spec: "16-bit inputs and output · 3-bit function · flags Z, C, N, V", role: "Performs the arithmetic and logic operations selected by opULA." },
    muxPc:      { name: "PC MUX", spec: "2 inputs", role: "The PC receives PC+1 (normal flow) or a branch address." },
    muxGprAddr: { name: "GPR address MUX", spec: "2 inputs", role: "Selects which instruction field addresses the register-file write." },
    muxGprData: { name: "GPR data MUX", spec: "3 inputs", role: "Selects the data written to the GPR: immediate, data memory or ALU result." },
    pc:         { name: "PC", spec: "register", role: "Address of the next instruction." },
    ir:         { name: "IR", spec: "16-bit register", role: "Holds the instruction being executed." },
    mar:        { name: "MAR", spec: "register", role: "Holds the operand address, for data-memory accesses and for branches." },
    mdr:        { name: "MDR", spec: "16-bit register", role: "Holds the data read from data memory." },
    ab:         { name: "A and B", spec: "16-bit registers", role: "Hold the operands read from the register file for the ALU." },
    r:          { name: "R", spec: "16-bit register", role: "Holds the ALU result until it is written to the register file." },
    decoder:    { name: "Decoder", spec: "combinational", role: "Splits the IR into its fields: opcode, register addresses and operand." },
    pcInc:      { name: "PC+1", spec: "combinational", role: "Increments the PC." },
    uc:         { name: "CU", spec: "state machine", role: "Control unit: steps through the states and issues the control signals." },
  },
};
