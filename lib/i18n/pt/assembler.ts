import type { AssemblerMessage, OperandRole } from "@/lib/assembler";

/** How each operand is named: `usage` in the operand-count message, `range` in the out-of-range one. */
const ROLES: Readonly<Record<OperandRole, { usage: string; range: string }>> = {
  rd:         { usage: "Rdst",              range: "Registrador" },
  rs:         { usage: "Rsrc",              range: "Registrador" },
  imm:        { usage: "imm",               range: "Imediato" },
  addr:       { usage: "addr",              range: "Endereço" },
  srcA:       { usage: "Rsrc_a",            range: "SrcA" },
  srcB:       { usage: "Rsrc_b",            range: "SrcB" },
  dst:        { usage: "Rdst",              range: "Dst" },
  jumpTarget: { usage: "endereço ou label", range: "Endereço de jump" },
};

export const assembler = {
  format(m: AssemblerMessage): string {
    switch (m.code) {
      case "invalidDataLine": return `Declaração inválida na seção .data: "${m.line}"`;
      case "duplicateLabel":  return `Label duplicado: "${m.name}"`;
      case "invalidDbValue":  return `Valor inválido na declaração DB: "${m.text}"`;
      case "unknownMnemonic": return `Mnemônico desconhecido: "${m.token}"`;
      case "labelNotFound":   return `Label não encontrado: "${m.name}"`;
      case "outOfRange":
        return `${ROLES[m.role].range} fora do range ${m.min}–${m.max}: ${m.value}`;
      case "noOperands":
        return `${m.mnemonic}: não aceita operandos`;
      case "wrongArity": {
        const n = m.roles.length;
        const usage = m.roles.map((r) => ROLES[r].usage).join(", ");
        return `${m.mnemonic}: esperado ${n} ${n === 1 ? "operando" : "operandos"} (${usage}), recebeu ${m.got}`;
      }
    }
  },
};
