/**
 * tourSteps.ts
 *
 * The guided tour, step by step. A step points at an element by a CSS selector
 * (`data-tour` anchors, mostly) and says how it ends: on the student's own
 * click, or on Próximo.
 */

import { useProgramDataStore, mountStatus } from "./programDataStore";
import { useExecutionStore } from "./executionStore";

export interface TourStep {
  id: string;
  /** Element to light up. Without one — or when it is not on screen — the step is centred. */
  target?: string;
  title: string;
  body: string;
  /**
   * A step that waits for the student to do something: `done` says when it has
   * been done, `run` does it for them ("Fazer por mim").
   */
  action?: { hint: string; label: string; done: () => boolean; run: () => void };
  /** Steps that make no sense in the current state are skipped. */
  applicable?: () => boolean;
}

const exists = (selector: string) => () => document.querySelector(selector) !== null;
const timelineActive = () => useExecutionStore.getState().isTimelineActive;

export const TOUR_STEPS: TourStep[] = [
  {
    id: "intro",
    title: "Vamos dar uma volta",
    body: "Em poucos passos você vê onde escrever um programa, como executá-lo e como acompanhar cada tick no caminho de dados. Use Próximo, ou as setas do teclado. Esc sai a qualquer momento.",
  },
  {
    id: "editor",
    target: '[data-tour="editor"]',
    title: "Ling. Montagem",
    body: "Aqui você escreve o programa em assembly, ou escolhe um exemplo em Programa. Cada linha é uma instrução da CPU.",
  },
  {
    id: "montar",
    target: '[data-tour="montar"]',
    title: "Montar",
    body: "Montar traduz o texto em palavras de 16 bits, as que a CPU entende de verdade.",
    action: {
      hint: "Clique em Montar para continuar.",
      label: "Fazer por mim",
      done: () => useProgramDataStore.getState().mountedSource !== null,
      run: () => useProgramDataStore.getState().mountProgram(),
    },
    applicable: () => {
      const s = useProgramDataStore.getState();
      return mountStatus(s) !== "ok";
    },
  },
  {
    id: "machine",
    target: '[data-tour="machine"]',
    title: "Ling. Máquina",
    body: "O resultado da montagem: o endereço de cada instrução, a palavra de 16 bits e o opcode. Embaixo ficam as variáveis do programa.",
  },
  {
    id: "simular",
    target: '[data-tour="simular"]',
    title: "Simular",
    body: "Simular executa o programa até o HLT e abre a linha do tempo: você pode percorrer cada tick, para frente e para trás.",
    action: {
      hint: "Clique em Simular para continuar.",
      label: "Fazer por mim",
      done: timelineActive,
      run: () => useProgramDataStore.getState().runProgram(),
    },
    applicable: () => !timelineActive(),
  },
  {
    id: "player",
    target: '[data-tour="bar"]',
    title: "Player e contador",
    body: "Volte e avance um tick, reproduza tudo, ou arraste a barra para ir a qualquer tick. Segure F para acelerar a animação em andamento. O contador mostra em que tick você está.",
  },
  {
    id: "datapath",
    target: '[data-tour="datapath"]',
    title: "O caminho de dados",
    body: "Aqui a CPU executa. Os componentes acendem quando atuam e as bolinhas mostram os valores viajando pelos fios. Passe o mouse numa porta para ver o valor.",
  },
  {
    id: "uc",
    target: '[data-node-type="CpuComponent"]',
    title: "A unidade de controle",
    body: "A UC comanda tudo: o desenho mostra em que estado ela está, e a faixa de baixo mostra os sinais de controle que ela emite a cada estado.",
    applicable: exists('[data-node-type="CpuComponent"]'),
  },
  {
    id: "memories",
    target: '[data-tour="imem-list"]',
    title: "As memórias",
    body: "Este botão abre a memória de instruções e a de dados lado a lado, no lugar do código, para você ver o conteúdo delas enquanto a simulação anda.",
    applicable: exists('[data-tour="imem-list"]'),
  },
  {
    id: "settings",
    target: '[data-tour="settings"]',
    title: "Ajustes",
    body: "Aqui você escolhe a base dos números (hex, decimal, binário), quais fios mostrar, a velocidade da animação e o tamanho do texto.",
  },
  {
    id: "zoom",
    target: '[data-tour="zoom"]',
    title: "Zoom",
    body: "Aproxime ou afaste o desenho. Clicar na porcentagem ajusta tudo à tela.",
  },
  {
    id: "help",
    target: '[data-tour="help"]',
    title: "Ajuda",
    body: "Aqui ficam o guia, a tabela de instruções e o codificador, o caminho de dados com os sinais de controle, os créditos e o feedback. Você pode rever este tutorial por lá. Boa exploração!",
  },
];

/** The index of the next applicable step after `from`, or -1 at the end. */
export function nextApplicable(from: number): number {
  for (let i = from + 1; i < TOUR_STEPS.length; i++) {
    if (!TOUR_STEPS[i].applicable || TOUR_STEPS[i].applicable!()) return i;
  }
  return -1;
}

/** The index of the previous applicable step before `from`, or -1 at the start. */
export function previousApplicable(from: number): number {
  for (let i = from - 1; i >= 0; i--) {
    if (!TOUR_STEPS[i].applicable || TOUR_STEPS[i].applicable!()) return i;
  }
  return -1;
}
