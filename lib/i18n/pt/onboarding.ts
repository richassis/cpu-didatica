import { common } from "./common";

/** The text of one tour step. `hint` belongs to steps that wait for a click. */
export interface TourStepText {
  title: string;
  body: string;
  hint?: string;
}

/**
 * Keeps the step ids as the literal keys (they type `TourStepId` in
 * lib/tourSteps.ts) while every step shares the `TourStepText` shape.
 */
function defineSteps<K extends string>(steps: Record<K, TourStepText>): Record<K, TourStepText> {
  return steps;
}

const ui = common.ui;

export const onboarding = {
  splash: {
    subtitle: "Simulador de caminho de dados",
    /** Followed by the university's short name. */
    projectOf: "Projeto da",
    professor: "Professor",
    student: "Aluno",
    continue: "Continuar",
    continueHint: "clique ou pressione Enter",
  },

  welcome: {
    ariaLabel: "Boas-vindas",
    title: "Bem-vindo à CPU Didática",
    intro:
      "Um simulador para ver, tick a tick, como uma CPU executa um programa: da instrução na memória até o resultado gravado no registrador.",
    points: {
      write: { title: "Escreva em assembly", body: "Um programa curto, ou um dos exemplos prontos." },
      assemble: { title: "Monte e simule", body: "Veja o texto virar palavras de 16 bits e o programa rodar." },
      follow: { title: "Acompanhe cada tick", body: "Os valores viajam pelo caminho de dados, passo a passo." },
    },
    takeTour: "Fazer o tutorial",
    explore: "Explorar sozinho",
    openHelp: "Abrir a ajuda",
  },

  tour: {
    ariaLabel: (title: string) => `Tutorial: ${title}`,
    stepOf: (n: number, total: number) => `${n} de ${total}`,
    skip: "Pular tutorial",
    back: "Voltar",
    finish: "Concluir",
    doItForMe: "Fazer por mim",
    steps: defineSteps({
      intro: {
        title: "Vamos dar uma volta",
        body: `Em poucos passos você vê onde escrever um programa, como executá-lo e como acompanhar cada tick no caminho de dados. Use ${ui.next}, ou as setas do teclado. Esc sai a qualquer momento.`,
      },
      editor: {
        title: ui.assemblyPanel,
        body: `Aqui você escreve o programa em assembly, ou escolhe um exemplo em ${ui.program}. Cada linha é uma instrução da CPU.`,
      },
      assemble: {
        title: ui.assemble,
        body: `${ui.assemble} traduz o texto em palavras de 16 bits, as que a CPU entende de verdade.`,
        hint: `Clique em ${ui.assemble} para continuar.`,
      },
      machine: {
        title: ui.machinePanel,
        body: "O resultado da montagem: o endereço de cada instrução, a palavra de 16 bits e o opcode. Embaixo ficam as variáveis do programa.",
      },
      simulate: {
        title: ui.simulate,
        body: `${ui.simulate} executa o programa até o HLT e abre a linha do tempo: você pode percorrer cada tick, para frente e para trás.`,
        hint: `Clique em ${ui.simulate} para continuar.`,
      },
      player: {
        title: "Player e contador",
        body: "Volte e avance um tick, reproduza tudo, ou arraste a barra para ir a qualquer tick. Segure F para acelerar a animação em andamento. O contador mostra em que tick você está.",
      },
      datapath: {
        title: "O caminho de dados",
        body: "Aqui a CPU executa. Os componentes acendem quando atuam e as bolinhas mostram os valores viajando pelos fios. Passe o mouse numa porta para ver o valor.",
      },
      controlUnit: {
        title: "A unidade de controle",
        body: "A UC comanda tudo: o desenho mostra em que estado ela está, e a faixa de baixo mostra os sinais de controle que ela emite a cada estado.",
      },
      memories: {
        title: "As memórias",
        body: "Este botão abre a memória de instruções e a de dados lado a lado, no lugar do código, para você ver o conteúdo delas enquanto a simulação anda.",
      },
      settings: {
        title: ui.settings,
        body: "Aqui você escolhe a base dos números (hex, decimal, binário), quais fios mostrar, a velocidade da animação e o tamanho do texto.",
      },
      zoom: {
        title: "Zoom",
        body: "Aproxime ou afaste o desenho. Clicar na porcentagem ajusta tudo à tela.",
      },
      help: {
        title: ui.help,
        body: "Aqui ficam o guia, a tabela de instruções e o codificador, o caminho de dados com os sinais de controle, os créditos e o feedback. Você pode rever este tutorial por lá. Boa exploração!",
      },
    }),
  },
};
