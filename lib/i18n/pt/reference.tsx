import type { ControlSignalName } from "@/lib/simulator";
import { CpuState } from "@/lib/simulator/CpuState";
import type { FieldSpec, InstructionFormat, Mnemonic } from "@/lib/simulator/ISA";
import type { ComponentId } from "@/lib/helpContent";

/** The instruction-format drawings of the ISA tab, one per group of instructions. */
type FormatGroupId = "loadStore" | "ldai" | "branches" | "hlt" | "alu" | "not";

const groups: Record<FormatGroupId, { title: string; registerMeaning?: string }> = {
  loadStore: { title: "LDA e STA", registerMeaning: "destino (LDA) · fonte (STA)" },
  ldai:      { title: "LDAI" },
  branches:  { title: "Desvios — JZ, JN e JMP" },
  hlt:       { title: "HLT" },
  alu:       { title: "ULA — ADD, SUB, AND e OR" },
  not:       { title: "NOT" },
};

const formats: Record<InstructionFormat, string> = { ula: "ULA", standard: "padrão" };

const instructions: Record<Mnemonic, { effect: string }> = {
  LDA:  { effect: "Rd ← DMem[M]" },
  LDAI: { effect: "Rd ← N (8 bits, com sinal estendido para 16)" },
  STA:  { effect: "DMem[M] ← Rs" },
  ADD:  { effect: "Rd ← Ra + Rb" },
  SUB:  { effect: "Rd ← Ra − Rb" },
  AND:  { effect: "Rd ← Ra e Rb (bit a bit)" },
  OR:   { effect: "Rd ← Ra ou Rb (bit a bit)" },
  NOT:  { effect: "Rd ← não Ra (bit a bit)" },
  JZ:   { effect: "se Z = 1: PC ← M" },
  JN:   { effect: "se N = 1: PC ← M" },
  JMP:  { effect: "PC ← M (sempre)" },
  HLT:  { effect: "para a execução" },
};

const fieldLabels: Record<FieldSpec["name"], string> = {
  opcode:  "Opcode",
  gprAddr: "R",
  operand: "Operando (M ou N)",
  srcA:    "Ra",
  srcB:    "Rb",
  pad:     "—",
  dst:     "Rd",
};

const states: Record<CpuState, string> = {
  [CpuState.RESET]:     "Zera os sinais de controle e volta para BUSCA.",
  [CpuState.FETCH]:     "Lê IMem[PC] para o IR e o PC passa para PC+1.",
  [CpuState.DECODE]:    "O decodificador separa os campos do IR e a UC escolhe o próximo estado pelo opcode (HLT para).",
  [CpuState.READMEM]:   "LDA: lê DMem[M] para o MDR.",
  [CpuState.WRITEREG1]: "LDA: grava o dado lido (MDR) no registrador destino.",
  [CpuState.WRITEREG2]: "LDAI: grava o imediato no registrador destino.",
  [CpuState.READREG1]:  "STA: lê o registrador fonte para o A.",
  [CpuState.WRITEMEM]:  "STA: grava o A em DMem[M].",
  [CpuState.READREG2]:  "Instruções da ULA: lê os dois registradores fonte para A e B.",
  [CpuState.EXECUTE]:   "A ULA calcula A op B e as flags Z, C, N e V são capturadas.",
  [CpuState.WRITEREG3]: "Grava o resultado da ULA (R) no registrador destino.",
  [CpuState.WRITEPC]:   "Desvios: se a condição vale, carrega o endereço M no PC.",
  [CpuState.HALT]:      "A execução terminou.",
};

const signals: Record<ControlSignalName, { does: string; values?: string }> = {
  muxPC:   { does: "De onde vem o próximo PC.", values: "1 = PC+1 · 0 = endereço do desvio" },
  wrPC:    { does: "Habilita a escrita no PC." },
  wrIR:    { does: "Habilita a escrita no IR." },
  rdMem:   { does: "Habilita a leitura da memória de dados." },
  wrMem:   { does: "Habilita a escrita na memória de dados." },
  muxAReg: { does: "Qual campo da instrução endereça a escrita no GPR.", values: "0 = campo do registrador · 1 = campo destino da ULA" },
  muxDReg: { does: "Qual dado é escrito no GPR.", values: "0 = imediato · 1 = memória de dados · 2 = resultado da ULA" },
  wrReg:   { does: "Habilita a escrita no banco de registradores." },
  opULA:   { does: "Qual operação a ULA realiza." },
};

const components: Record<ComponentId, { name: string; spec: string; role: string }> = {
  imem:       { name: "IMem", spec: "256 palavras de 16 bits · endereço de 8 bits", role: "Guarda as instruções do programa. É só de leitura durante a execução." },
  dmem:       { name: "DMem", spec: "256 palavras de 16 bits · endereço de 8 bits", role: "Guarda os dados do programa. Lê com rdMem e escreve com wrMem." },
  gpr:        { name: "GPR", spec: "8 registradores de 16 bits (R0 a R7) · endereço de 3 bits", role: "Banco de registradores: duas leituras ao mesmo tempo e uma escrita, com wrReg." },
  ula:        { name: "ULA", spec: "entradas e saída de 16 bits · função de 3 bits · flags Z, C, N, V", role: "Realiza as operações aritméticas e lógicas escolhidas por opULA." },
  muxPc:      { name: "MUX PC", spec: "2 entradas", role: "O PC recebe PC+1 (fluxo normal) ou o endereço de um desvio." },
  muxGprAddr: { name: "MUX endereço do GPR", spec: "2 entradas", role: "Escolhe qual campo da instrução endereça a escrita no banco de registradores." },
  muxGprData: { name: "MUX dado do GPR", spec: "3 entradas", role: "Escolhe o dado escrito no GPR: imediato, memória de dados ou resultado da ULA." },
  pc:         { name: "PC", spec: "registrador", role: "Endereço da próxima instrução." },
  ir:         { name: "IR", spec: "registrador de 16 bits", role: "Guarda a instrução em execução." },
  mar:        { name: "MAR", spec: "registrador", role: "Guarda o endereço do operando para acessar a memória de dados e para os desvios." },
  mdr:        { name: "MDR", spec: "registrador de 16 bits", role: "Guarda o dado lido da memória de dados." },
  ab:         { name: "A e B", spec: "registradores de 16 bits", role: "Guardam os operandos lidos do banco de registradores para a ULA." },
  r:          { name: "R", spec: "registrador de 16 bits", role: "Guarda o resultado da ULA até ele ser escrito no banco." },
  decoder:    { name: "Decodificador", spec: "combinacional", role: "Separa os campos do IR: opcode, endereços de registrador e operando." },
  pcInc:      { name: "PC+1", spec: "combinacional", role: "Incrementa o PC." },
  uc:         { name: "UC", spec: "máquina de estados", role: "Unidade de controle: percorre os estados e emite os sinais de controle." },
};

/** The Help's reference tabs: the instruction set and the datapath. */
export const reference = {
  isa: {
    formatHeading: "Uma instrução tem 16 bits",
    formatIntro: () => (
      <>
        Os 5 primeiros bits são sempre o <b className="text-fg">opcode</b>, que diz qual instrução é.
        O resto depende do formato de cada instrução: um registrador e um endereço{" "}
        <b className="text-fg">M</b>, um registrador e um valor <b className="text-fg">N</b>, só um
        endereço, três registradores da ULA — ou nada, no HLT. Campos marcados com{" "}
        <span className="font-mono text-fg">—</span> não são usados.
      </>
    ),
    groups,

    instructionsHeading: (n: number) => `As ${n} instruções`,
    instructionsIntro: () => (
      <>
        <b className="text-fg">Rd</b> é o destino, <b className="text-fg">Rs</b>, <b className="text-fg">Ra</b> e{" "}
        <b className="text-fg">Rb</b> são fontes, <b className="text-fg">M</b> é um endereço de memória
        (0 a 255) ou label, e <b className="text-fg">N</b> é um valor de −128 a 127 (de 128 a 255 é o mesmo
        byte, lido como negativo). Clique numa linha
        para ver a instrução codificada abaixo.
      </>
    ),
    columns: {
      opcode: "Opcode",
      syntax: "Sintaxe",
      exampleWord: "Palavra do exemplo",
      effect: "Efeito",
      format: "Formato",
      flags: "Flags",
      ticks: "Ticks",
    },
    formats,
    ticksNote:
      "Ticks: quantos ciclos de clock a instrução leva, contando BUSCA e DECODIFICA. As " +
      "operações da ULA atualizam as flags Z (zero), C (vai-um), N (negativo) e V (overflow) da " +
      "ULA e da UC; LDA e LDAI atualizam só Z e N da UC. " +
      "Os desvios leem a última flag capturada.",

    encoderHeading: "Codificador",
    encoderIntro: () => (
      <>
        Digite uma instrução (<span className="font-mono">LDAI R0, -3</span>) ou uma palavra de
        máquina em hexadecimal (<span className="font-mono">0x2143</span>) ou binário, e veja os bits
        divididos em campos.
      </>
    ),
    encoderInput: "Instrução ou palavra de máquina",
    tooManyHexDigits: "Uma palavra tem até 4 dígitos hexadecimais (16 bits).",
    oneInstruction: "Digite uma instrução por vez.",
    unknownOpcode: "opcode desconhecido",
  },

  /** What each instruction does, in register-transfer notation. */
  instructions,

  /** The fields of an instruction word, and what each one means for a given instruction. */
  bitFields: {
    labels: fieldLabels,
    meanings: {
      firstOperand:        "primeiro operando",
      secondOperand:       "segundo operando",
      unusedByNot:         "não usado (NOT)",
      resultDestination:   "destino do resultado",
      unused:              "não usado",
      sourceRegister:      "registrador fonte",
      destinationRegister: "registrador destino",
      immediate:           "valor imediato N",
      address:             "endereço M",
    },
  },

  datapath: {
    heading: "O caminho de dados",
    intro:
      "Um esquema simplificado. As linhas azuis são fios de dados; a unidade de controle (UC) manda " +
      "os sinais de controle para todos os blocos. O desenho completo, com todos os fios, é o que " +
      "você vê ao lado do código.",
    componentsHeading: "Componentes",

    signalsHeading: "Sinais de controle",
    signalsIntro:
      "A UC não calcula nada: ela liga e desliga estes sinais, estado a estado, e os blocos " +
      "fazem o resto.",
    signalColumns: { signal: "Sinal", bits: "Bits", does: "O que faz", values: "Valores" },

    fsmHeading: "Máquina de estados",
    fsmIntro: () => (
      <>
        Toda instrução começa com <b className="text-fg">BUSCA</b> (FETCH) e{" "}
        <b className="text-fg">DECODIFICA</b> (DECODE). Depois, o opcode escolhe o caminho. Cada
        estado dura um tick de clock e, ao terminar, a UC volta para a BUSCA.
      </>
    ),
    sequenceColumns: { instruction: "Instrução", states: "Estados" },
    statesHeading: "O que cada estado faz e quais sinais define",
    stateColumns: { state: "Estado", does: "O que faz" },
    /** Cell of opULA in EXECUTE: the value comes from the instruction. */
    fromInstruction: "da instrução",
    statesNote:
      "· o estado não mexe no sinal, que mantém o valor de antes. * só se o desvio é tomado: JMP " +
      "sempre; JZ e JN quando a flag correspondente está ligada. No estado RESET todos os " +
      "sinais voltam ao valor inicial.",

    /** The simplified schematic. Its boxes have fixed widths: keep each label as short as these. */
    schematic: {
      label: "Esquema simplificado do caminho de dados",
      decoder: "Decodif.",
      gprData: "dado",
      alu: "ULA",
      controlUnit: "UC — máquina de estados que emite os sinais de controle para todos os blocos",
      irOperand: "operando M do IR",
      gprDataSources: "imediato · memória · ULA",
    },
  },

  /** What the control unit does in each state, in one line. */
  states,

  /**
   * The control signals. `values` lists what each value selects; opULA's
   * values are built from the simulator (`SIGNAL_VALUES` in helpContent).
   */
  signals,

  /** The blocks of the datapath, listed in the order of `COMPONENT_IDS`. */
  components,
};
