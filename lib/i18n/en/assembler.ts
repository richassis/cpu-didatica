import type { AssemblerMessage, OperandRole } from "@/lib/assembler";
import type { Messages } from "../index";

const ROLES: Readonly<Record<OperandRole, { usage: string; range: string }>> = {
  rd:         { usage: "Rdst",              range: "Register" },
  rs:         { usage: "Rsrc",              range: "Register" },
  imm:        { usage: "imm",               range: "Immediate" },
  addr:       { usage: "addr",              range: "Address" },
  srcA:       { usage: "Rsrc_a",            range: "SrcA" },
  srcB:       { usage: "Rsrc_b",            range: "SrcB" },
  dst:        { usage: "Rdst",              range: "Dst" },
  jumpTarget: { usage: "address or label",  range: "Jump address" },
};

export const assembler: Messages["assembler"] = {
  format(m: AssemblerMessage): string {
    switch (m.code) {
      case "invalidDataLine": return `Invalid declaration in the .data section: "${m.line}"`;
      case "duplicateLabel":  return `Duplicate label: "${m.name}"`;
      case "invalidDbValue":  return `Invalid value in DB declaration: "${m.text}"`;
      case "unknownMnemonic": return `Unknown mnemonic: "${m.token}"`;
      case "labelNotFound":   return `Label not found: "${m.name}"`;
      case "outOfRange":
        return `${ROLES[m.role].range} out of range ${m.min}–${m.max}: ${m.value}`;
      case "noOperands":
        return `${m.mnemonic}: takes no operands`;
      case "wrongArity": {
        const n = m.roles.length;
        const usage = m.roles.map((r) => ROLES[r].usage).join(", ");
        return `${m.mnemonic}: expected ${n} ${n === 1 ? "operand" : "operands"} (${usage}), got ${m.got}`;
      }
    }
  },
};
