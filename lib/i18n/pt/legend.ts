export const legend = {
  shapeHeading: "Forma — o que é",
  colorHeading: "Cor — o que está acontecendo",

  shapes: {
    register: { label: "Registrador", note: "guarda um único valor" },
    memory: { label: "Memória", note: "lombada na borda esquerda" },
    alu: { label: "ULA", note: "trapézio com entalhe" },
    mux: { label: "Multiplexador", note: "trapézio, sem entalhe" },
    decoder: { label: "Decodificador", note: "barra vertical fina" },
    control: { label: "Unidade de controle", note: "tracejada — comanda o caminho de dados" },
  },

  states: {
    active: { label: "Ativo", note: "componente executando neste tick" },
    dataWire: { label: "Fio de dado", note: "azul em movimento; registrador com valor" },
    controlWire: { label: "Fio de controle", note: "verde em movimento; sinal da UC" },
    warning: { label: "Atenção", note: "flag ativada" },
    error: { label: "Erro", note: "CPU parada pelo HLT" },
    idle: { label: "Ocioso", note: "fora deste tick" },
  },
};
