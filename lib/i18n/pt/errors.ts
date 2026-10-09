export const errors = {
  tickLimit: (maxTicks: number) =>
    `A execução parou depois de ${maxTicks} ticks (possível laço infinito).`,
  fileUnreadable: "Não foi possível ler o arquivo como texto.",
  fileNotText: (fileName: string) =>
    `"${fileName}" não parece ser um arquivo de texto. Escolha um arquivo com o código-fonte.`,
  fileOpenFailed: "Falha ao abrir o arquivo.",
};
