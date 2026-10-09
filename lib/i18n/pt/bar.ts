import { common } from "./common";

export const bar = {
  /** The top bar: what is open, file actions, zoom. */
  topBar: {
    appName: "CPU Didática",
    lines: (n: number) => `${n} ${n === 1 ? "linha" : "linhas"}`,
    openTitle: "Abrir um arquivo de texto com código assembly",
    saveTitle: "Salvar o código em um arquivo",
    zoomOut: "Diminuir zoom",
    fitToScreen: "Ajustar à tela",
    zoomIn: "Aumentar zoom",
    settingsDialog: `${common.ui.settings} da simulação`,
  },

  /** The Ajustes panel. */
  settings: {
    values: "Valores",
    text: "Texto",
    textSizes: {
      small: "Texto pequeno",
      medium: "Texto médio",
      large: "Texto grande",
    },
    signals: "Sinais",
    wiresAndPorts: "Fios e portas",
    controlSignals: "Sinais de controle",
    dataWires: "Fios de dados",
    speed: "Velocidade",
    speedSlider: "Velocidade da animação",
    low: "Baixa",
    high: "Alta",
  },

  theme: {
    toLight: "Mudar para o modo claro",
    toDark: "Mudar para o modo escuro",
    light: "Claro",
    dark: "Escuro",
  },

  toast: {
    close: "Fechar",
  },

  /** The bottom bar: Montar, Simular, the player. */
  simulation: {
    assembleTitle: "Montar (compilar) o código-fonte",
    simulating: "Simulando…",
    runTitle: {
      locked: "Simulação em andamento",
      none: "Monte o programa primeiro",
      stale: "Montagem desatualizada — monte de novo",
      errors: "Corrija os erros de montagem",
      ok: "Simular o programa até HLT",
    },
    status: {
      errors: (n: number) => `${n} ${n === 1 ? "erro" : "erros"} de montagem`,
      ready: (n: number) => `${n} ${n === 1 ? "instrução" : "instruções"} — simule para percorrer tick a tick`,
      stale: "código alterado — monte de novo",
      none: "monte o programa para simular",
    },
    goToStart: "Ir para o início",
    stepBack: "Voltar um tick",
    playTitle: "Percorrer todos os ticks",
    play: "Reproduzir",
    pause: "Pausar",
    stepForward: "Avançar um tick",
    goToEnd: "Ir para o fim, sem animar",
    boostTitle: "Segure para acelerar a animação (F)",
    boost: "Acelerar a animação",
    stopTitle: "Encerrar a linha do tempo",
    timeline: "Tick",
  },

  /** The seven-segment tick counter. */
  tick: {
    tick: "tick",
    halted: "parado",
    ofTotal: (total: number) => `de ${total}`,
    /** Read by screen readers. */
    status: (current: number, total: number, halted: boolean) =>
      `Tick ${current} de ${total}${halted ? ", parado" : ""}`,
  },
};
