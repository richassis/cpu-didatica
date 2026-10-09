import type { ReactNode } from "react";
import { common } from "./common";

export const help = {
  dialog: {
    aria: common.ui.help,
    tablistAria: "Seções da ajuda",
    close: "Fechar a ajuda",
    tabs: {
      guide: "Guia",
      isa: "ISA",
      datapath: "Caminho de dados",
      feedback: "Feedback",
      credits: "Créditos",
    },
  },

  guide: {
    replayTour: "Rever o tutorial",
    replayWelcome: "Rever as boas-vindas",

    howTo: {
      heading: "Como usar o simulador",
      steps: {
        write: {
          title: "Escreva o programa",
          body: (): ReactNode => (
            <>
              Na coluna <b className="text-fg">{common.ui.assemblyPanel}</b>, escreva em assembly ou escolha um
              exemplo em <i>{common.ui.program}</i>. Você também pode abrir e salvar arquivos de texto pela barra
              superior.
            </>
          ),
        },
        assemble: {
          title: "Monte",
          body: (): ReactNode => (
            <>
              <b className="text-fg">{common.ui.assemble}</b> traduz o texto para palavras de 16 bits, que aparecem em{" "}
              <b className="text-fg">{common.ui.machinePanel}</b>, com o endereço de cada instrução e a tabela de
              dados. Erros aparecem sob o código, com o número da linha.
            </>
          ),
        },
        simulate: {
          title: "Simule",
          body: (): ReactNode => (
            <>
              <b className="text-fg">{common.ui.simulate}</b> executa o programa até o HLT e abre a linha do tempo. Use
              o player: voltar e avançar um tick, reproduzir tudo, ir ao início ou ao fim, e o controle
              deslizante para ir a qualquer tick.
            </>
          ),
        },
        follow: {
          title: "Acompanhe o caminho de dados",
          body: (): ReactNode => (
            <>
              Cada tick é um estado da UC. Os componentes acendem quando atuam, as bolinhas mostram o
              valor viajando pelos fios e o contador mostra o tick. Os botões de lista nas memórias abrem
              as duas memórias lado a lado, no lugar do código.
            </>
          ),
        },
      },
    },

    assembly: {
      heading: "Escrevendo em assembly",
      /** Only the comments and the variable's name follow the language. */
      example: `        .data
SOMA:   DB    0            ; variável, começa em 0

        .code
        LDAI  R0, 10       ; R0 = 10
        LDAI  R1, 6        ; R1 = 6
        ADD   R0, R1, R2   ; R2 = R0 + R1
        STA   R2, SOMA     ; DMem[SOMA] = R2
        HLT`,
      comment: (): ReactNode => (
        <><span className="font-mono text-fg">;</span> começa um comentário até o fim da linha.</>
      ),
      registers: (): ReactNode => (
        <>
          <span className="font-mono text-fg">R0</span> a <span className="font-mono text-fg">R7</span> são
          os registradores; maiúsculas e minúsculas valem igual.
        </>
      ),
      label: (): ReactNode => (
        <>
          Um <b className="text-fg">label</b> (<span className="font-mono text-fg">LOOP:</span>) dá nome a
          um endereço e serve de destino de <span className="font-mono text-fg">JMP</span>,{" "}
          <span className="font-mono text-fg">JZ</span> e{" "}
          <span className="font-mono text-fg">JN</span>.
        </>
      ),
      sections: (): ReactNode => (
        <>
          <span className="font-mono text-fg">.data</span> abre a seção de variáveis e{" "}
          <span className="font-mono text-fg">.code</span> (ou <span className="font-mono text-fg">.text</span>)
          volta ao código. Cada linha <span className="font-mono text-fg">NOME: DB valor</span> reserva
          uma palavra da memória de dados, na ordem em que aparece, com o valor inicial (0 se omitido).
        </>
      ),
      /** Followed by a table of the same values in each notation. */
      numbers: (): ReactNode => (
        <>
          Variáveis (<span className="font-mono text-fg">DB</span>) têm 16 bits e podem ser escritas em:
        </>
      ),
      formats: {
        decimal: "decimal",
        hexadecimal: "hexadecimal",
        binary: "binário",
      },
      immediate: (): ReactNode => (
        <>
          <b className="text-fg">Cuidado:</b> no <span className="font-mono text-fg">LDAI</span> o
          imediato tem só 8 bits: vai de −128 a 127. Valores de 128 a 255 também são aceitos, mas
          o bit 7 é estendido como sinal e eles viram negativos
          (<span className="font-mono text-fg">LDAI R0, 200</span> carrega −56). Endereços de memória
          vão de 0 a 255.
        </>
      ),
    },

    shortcutsHeading: "Atalhos",

    settings: {
      heading: `${common.ui.settings} e barra superior`,
      values: (): ReactNode => (
        <>
          <b className="text-fg">Valores:</b> a base em que os números aparecem — hex, dec+ (sem sinal),
          dec± (com sinal, em complemento de dois) e bin. Sinais de controle, flags, endereços,
          opcodes e instruções nunca aparecem com sinal.
        </>
      ),
      signals: (): ReactNode => (
        <>
          <b className="text-fg">Sinais:</b> mostrar ou ocultar os fios; e, dentro deles, só os de
          controle ou só os de dados.
        </>
      ),
      speed: (): ReactNode => (
        <>
          <b className="text-fg">Velocidade:</b> de Baixa a Alta, a mesma velocidade em qualquer fio.
          Segure o botão de avanço rápido (ou a tecla F) para acelerar só o tick em andamento.
        </>
      ),
      zoom: (): ReactNode => (
        <>
          <b className="text-fg">Zoom:</b> os botões − e + aproximam e afastam; a porcentagem ajusta o
          desenho à tela. Também há o tema claro e escuro.
        </>
      ),
    },

    legendHeading: "Legenda do desenho",

    presets: {
      heading: "Programas de exemplo",
      load: "carregar",
      loadTitle: "Carregar este programa no editor",
      lockedTitle: "Encerre a simulação para trocar o programa",
    },
  },

  /** The keyboard shortcuts, as listed in the Guide. */
  shortcuts: {
    items: [
      { keys: "Espaço", note: "reproduzir / pausar" },
      { keys: "← →", note: "um tick para trás / para frente" },
      { keys: "Home", note: "ir para o início" },
      { keys: "End", note: "ir para o fim, sem animar" },
      { keys: "F (segurar)", note: "acelerar a animação em andamento" },
      { keys: "Esc", note: "fechar janelas e painéis" },
    ] as ReadonlyArray<{ keys: string; note: string }>,
    /** Shown under the list: when they apply. */
    note:
      "Os atalhos de reprodução (Espaço, setas, Home, End e F) valem com a linha do tempo ativa, " +
      `depois de ${common.ui.simulate}. Os atalhos de teclado ficam desligados enquanto você digita no editor.`,
  },

  feedback: {
    heading: "Sua opinião ajuda o simulador a melhorar",
    intro:
      "Conte o que funcionou, o que confundiu e o que faltou. Escreva aqui e o simulador abre o " +
      "seu programa de email com a mensagem pronta para enviar.",
    kindAria: "Tipo de feedback",
    kinds: {
      suggestion: {
        label: "Sugestão",
        placeholder: "Uma ideia de melhoria: o que você gostaria que o simulador fizesse ou mostrasse?",
      },
      problem: {
        label: "Problema",
        placeholder: "O que você fez, o que esperava que acontecesse e o que aconteceu de fato.",
      },
      praise: {
        label: "Elogio",
        placeholder: "O que funcionou bem, o que ajudou a entender a CPU.",
      },
    },
    messageAria: "Mensagem",
    writeEmail: "Escrever email",
    fallback: "Se o email não abrir, envie para",
    copy: "Copiar",
    copied: "Copiado",
    privacy:
      "O email sai do seu próprio programa de email, e só quando você enviar: o simulador não " +
      "manda nada sozinho. O código do seu programa não vai junto.",
    /** Labels of the context lines appended below the message. */
    context: {
      browser: "Navegador",
      date: "Data",
    },
  },

  credits: {
    tagline:
      "Simulador didático de CPU, para acompanhar tick a tick o caminho de dados que executa um " +
      "programa em assembly.",
    projectOf: (university: string): ReactNode => (
      <>
        Projeto da <b>{university}</b>
      </>
    ),
    professor: "Professor",
    student: "Aluno",
    openSource: "O código é aberto. Quer colaborar? Sugestões, issues e pull requests são bem-vindos.",
    repository: "Projeto no GitHub",
  },
};
