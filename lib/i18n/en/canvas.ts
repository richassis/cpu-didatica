import type { Messages } from "../index";

export const canvas: Messages["canvas"] = {
  labels: { ULA: "ALU", UC: "CU" },

  flags: {
    zero: "Zero",
    carry: "Carry",
    negative: "Negative",
    overflow: "Overflow",
  },

  memory: {
    viewAll: "See the whole memory",
  },

  instructionMemory: {
    viewAll: "See the whole program",
  },

  fsm: {
    diagram: "Control unit state diagram",
    next: (state: string) => `next: ${state}`,
  },

  wires: {
    none: "No wire connections",
  },
};
