import { common } from "./common";

export const program = {
  /**
   * Shown in place of the stored default name (`DEFAULT_PROGRAM_BASENAME`),
   * which is what a program nobody has named yet is saved as.
   */
  defaultName: "programa",

  /** Column headers of the listings (Ling. Máquina, the memory panel). */
  columns: {
    addr: "End",
    word: "Palavra",
    opcode: "Opcode",
    name: "Nome",
  },

  layout: {
    expand: (panel: string) => `Expandir ${panel}`,
    resize: "Redimensionar painel de códigos",
  },

  /** Ling. Montagem: the editor. */
  assembly: {
    collapse: `Recolher ${common.ui.assemblyPanel}`,
    locked: "travado",
    custom: "Personalizado",
    source: "Código-fonte assembly",
    errors: (n: number) => `Erros de montagem (${n})`,
    empty: "Código vazio — nada a montar",
  },

  /** Ling. Máquina: the listing. */
  assembled: {
    collapse: `Recolher ${common.ui.machinePanel}`,
    outdated: "desatualizado",
    notAssembled: `Pressione ${common.ui.assemble} para ver o código montado`,
    failed: (n: number) => `Montagem falhou (${n})`,
    seeErrors: `Veja os erros em ${common.ui.assemblyPanel}.`,
    programSection: "Programa",
    dataSection: "Dados",
  },

  /** The "Salvar programa" dialog. */
  save: {
    title: "Salvar programa",
    name: "Nome",
    savedAs: "Será salvo como",
    type: "Tipo",
    stats: (lines: number, bytes: number) =>
      `${lines} ${lines === 1 ? "linha" : "linhas"} · ${bytes} bytes`,
    cancel: "Cancelar",
  },

  memoryPanel: {
    back: "Voltar ao código",
  },
};
