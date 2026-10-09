/**
 * helpContent.ts
 *
 * The prose of the Help window. Opcodes, field positions, signal widths and
 * state sequences are read from `lib/simulator` where they are shown, and each
 * instruction's syntax and the opULA values are built from it here, so they
 * cannot drift from what the simulator does. Some numbers are written by hand
 * here, though — the flag lists, the mux values in `SIGNAL_HELP`, the memory
 * and register-bank sizes in `COMPONENT_HELP` — and have to be updated along
 * with the hardware.
 *
 * `INSTRUCTION_HELP` and `SIGNAL_HELP` are `Record`s over every mnemonic and
 * every control signal: adding one to the simulator without documenting it
 * here is a compile error.
 */

import type { ControlSignalName } from "@/lib/simulator";
import { CpuState } from "@/lib/simulator";
import { ULA_OPERATIONS, instructionSyntax, ulaOpName, type Mnemonic } from "@/lib/simulator/ISA";

export interface InstructionHelp {
  /** How it is written in assembly (from the ISA's operand list). */
  syntax: string;
  /** What it does, in register-transfer notation. */
  effect: string;
  /** Which status flags it updates. */
  flags: string;
  /** A one-line example. */
  example: string;
}

/** Hand-written part of each instruction's help; `syntax` is added below. */
const INSTRUCTION_PROSE: Record<Mnemonic, Omit<InstructionHelp, "syntax">> = {
  LDA:  { effect: "Rd ← DMem[M]",             flags: "Z, N",    example: "LDA R1, 5" },
  LDAI: { effect: "Rd ← N (8 bits, com sinal estendido para 16)", flags: "Z, N", example: "LDAI R0, -3" },
  STA:  { effect: "DMem[M] ← Rs",             flags: "—",       example: "STA R2, 0" },
  ADD:  { effect: "Rd ← Ra + Rb",             flags: "Z, C, N, V", example: "ADD R0, R1, R2" },
  SUB:  { effect: "Rd ← Ra − Rb",             flags: "Z, C, N, V", example: "SUB R0, R1, R2" },
  AND:  { effect: "Rd ← Ra e Rb (bit a bit)", flags: "Z, C, N, V", example: "AND R0, R1, R2" },
  OR:   { effect: "Rd ← Ra ou Rb (bit a bit)", flags: "Z, C, N, V", example: "OR R0, R1, R2" },
  NOT:  { effect: "Rd ← não Ra (bit a bit)",  flags: "Z, C, N, V", example: "NOT R0, R1" },
  JZ:   { effect: "se Z = 1: PC ← M",         flags: "—",       example: "JZ 12" },
  JN:   { effect: "se N = 1: PC ← M",         flags: "—",       example: "JN 20" },
  JMP:  { effect: "PC ← M (sempre)",          flags: "—",       example: "JMP 0" },
  HLT:  { effect: "para a execução",          flags: "—",       example: "HLT" },
};

export const INSTRUCTION_HELP = Object.fromEntries(
  (Object.keys(INSTRUCTION_PROSE) as Mnemonic[]).map((m) => [m, { syntax: instructionSyntax(m), ...INSTRUCTION_PROSE[m] }]),
) as Record<Mnemonic, InstructionHelp>;

/** What the control unit does in each state, in one line. */
export const STATE_HELP: Partial<Record<CpuState, string>> = {
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

/** The control signals, in the order they appear on the control unit. */
export const SIGNAL_HELP: Record<ControlSignalName, { does: string; values?: string }> = {
  muxPC:   { does: "De onde vem o próximo PC.", values: "1 = PC+1 · 0 = endereço do desvio" },
  wrPC:    { does: "Habilita a escrita no PC." },
  wrIR:    { does: "Habilita a escrita no IR." },
  rdMem:   { does: "Habilita a leitura da memória de dados." },
  wrMem:   { does: "Habilita a escrita na memória de dados." },
  muxAReg: { does: "Qual campo da instrução endereça a escrita no GPR.", values: "0 = campo do registrador · 1 = campo destino da ULA" },
  muxDReg: { does: "Qual dado é escrito no GPR.", values: "0 = imediato · 1 = memória de dados · 2 = resultado da ULA" },
  wrReg:   { does: "Habilita a escrita no banco de registradores." },
  opULA:   { does: "Qual operação a ULA realiza.", values: ULA_OPERATIONS.map((op) => `${op} ${ulaOpName(op)}`).join(" · ") },
};

export interface ComponentHelp {
  name: string;
  spec: string;
  role: string;
}

export const COMPONENT_HELP: ComponentHelp[] = [
  { name: "IMem", spec: "256 palavras de 16 bits · endereço de 8 bits", role: "Guarda as instruções do programa. É só de leitura durante a execução." },
  { name: "DMem", spec: "256 palavras de 16 bits · endereço de 8 bits", role: "Guarda os dados do programa. Lê com rdMem e escreve com wrMem." },
  { name: "GPR", spec: "8 registradores de 16 bits (R0 a R7) · endereço de 3 bits", role: "Banco de registradores: duas leituras ao mesmo tempo e uma escrita, com wrReg." },
  { name: "ULA", spec: "entradas e saída de 16 bits · função de 3 bits · flags Z, C, N, V", role: "Realiza as operações aritméticas e lógicas escolhidas por opULA." },
  { name: "MUX PC", spec: "2 entradas", role: "O PC recebe PC+1 (fluxo normal) ou o endereço de um desvio." },
  { name: "MUX endereço do GPR", spec: "2 entradas", role: "Escolhe qual campo da instrução endereça a escrita no banco de registradores." },
  { name: "MUX dado do GPR", spec: "3 entradas", role: "Escolhe o dado escrito no GPR: imediato, memória de dados ou resultado da ULA." },
  { name: "PC", spec: "registrador", role: "Endereço da próxima instrução." },
  { name: "IR", spec: "registrador de 16 bits", role: "Guarda a instrução em execução." },
  { name: "MAR", spec: "registrador", role: "Guarda o endereço do operando para acessar a memória de dados e para os desvios." },
  { name: "MDR", spec: "registrador de 16 bits", role: "Guarda o dado lido da memória de dados." },
  { name: "A e B", spec: "registradores de 16 bits", role: "Guardam os operandos lidos do banco de registradores para a ULA." },
  { name: "R", spec: "registrador de 16 bits", role: "Guarda o resultado da ULA até ele ser escrito no banco." },
  { name: "Decodificador", spec: "combinacional", role: "Separa os campos do IR: opcode, endereços de registrador e operando." },
  { name: "PC+1", spec: "combinacional", role: "Incrementa o PC." },
  { name: "UC", spec: "máquina de estados", role: "Unidade de controle: percorre os estados e emite os sinais de controle." },
];

export const SHORTCUTS: Array<{ keys: string; note: string }> = [
  { keys: "Espaço", note: "reproduzir / pausar" },
  { keys: "← →", note: "um tick para trás / para frente" },
  { keys: "Home", note: "ir para o início" },
  { keys: "End", note: "ir para o fim, sem animar" },
  { keys: "F (segurar)", note: "acelerar a animação em andamento" },
  { keys: "Esc", note: "fechar janelas e painéis" },
];

export const CREDITS = {
  project: "CPU Didática",
  institution: "Universidade Federal do Rio Grande — FURG",
  center: "Centro de Ciências Computacionais — C3",
  year: "2026",
  professor: "Ewerson Carvalho",
  student: "Richard de Assis",
  repository: "https://github.com/richassis/cpu-didatica",
} as const;
