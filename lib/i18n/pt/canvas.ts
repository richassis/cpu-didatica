export const canvas = {
  /**
   * Display names for component labels, keyed by the label stored in the
   * project file. A label left out shows as stored.
   */
  labels: {} as Readonly<Record<string, string>>,

  /** Full names of the status flags, for the Z/C/N/V pills' tooltips. */
  flags: {
    zero: "Zero",
    carry: "Carry (vai-um)",
    negative: "Negativo",
    overflow: "Overflow (estouro)",
  },

  memory: {
    viewAll: "Ver toda a memória",
  },

  instructionMemory: {
    viewAll: "Ver o programa inteiro",
  },

  /** The control unit's state diagram. */
  fsm: {
    diagram: "Diagrama de estados da unidade de controle",
    next: (state: string) => `próx.: ${state}`,
  },

  wires: {
    none: "Nenhum fio conectado",
  },
};
