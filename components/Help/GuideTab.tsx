"use client";

import Legend from "@/components/ProgramMode/Legend";
import { PRESET_PROGRAMS } from "@/lib/presetPrograms";
import { SHORTCUTS } from "@/lib/helpContent";
import { useProgramDataStore } from "@/lib/programDataStore";
import { useExecutionStore } from "@/lib/executionStore";

const EXAMPLE = `        .data
SOMA:   DB    0            ; variável, começa em 0

        .code
        LDAI  R0, 10       ; R0 = 10
        LDAI  R1, 6        ; R1 = 6
        ADD   R0, R1, R2   ; R2 = R0 + R1
        STA   R2, SOMA     ; DMem[SOMA] = R2
        HLT`;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[11px] text-fg-muted">
        {n}
      </span>
      <div className="min-w-0">
        <div className="t-node text-fg">{title}</div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-fg-muted">{children}</p>
      </div>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
      {children}
    </kbd>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="t-node mb-2 text-fg">{children}</h3>;
}

export default function GuideTab({ onClose }: { onClose: () => void }) {
  const setAssemblySource = useProgramDataStore((s) => s.setAssemblySource);
  const isRunning = useProgramDataStore((s) => s.isRunning);
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
  const locked = isRunning || isTimelineActive;

  return (
    <div className="space-y-8">
      <section>
        <Heading>Como usar o simulador</Heading>
        <ol className="space-y-3">
          <Step n={1} title="Escreva o programa">
            Na coluna <b className="text-fg">Ling. Montagem</b>, escreva em assembly ou escolha um
            exemplo em <i>Programa</i>. Você também pode abrir e salvar arquivos de texto pela barra
            superior.
          </Step>
          <Step n={2} title="Monte">
            <b className="text-fg">Montar</b> traduz o texto para palavras de 16 bits, que aparecem em{" "}
            <b className="text-fg">Ling. Máquina</b>, com o endereço de cada instrução e a tabela de
            dados. Erros aparecem sob o código, com o número da linha.
          </Step>
          <Step n={3} title="Simule">
            <b className="text-fg">Simular</b> executa o programa até o HLT e abre a linha do tempo. Use
            o player: voltar e avançar um tick, reproduzir tudo, ir ao início ou ao fim, e o controle
            deslizante para ir a qualquer tick.
          </Step>
          <Step n={4} title="Acompanhe o caminho de dados">
            Cada tick é um estado da UC. Os componentes acendem quando atuam, as bolinhas mostram o
            valor viajando pelos fios e o contador mostra o tick. Os botões de lista nas memórias abrem
            as duas memórias lado a lado, no lugar do código.
          </Step>
        </ol>
      </section>

      <section>
        <Heading>Escrevendo em assembly</Heading>
        <div className="grid gap-4 md:grid-cols-2">
          <pre className="overflow-x-auto rounded-lg border border-line bg-sunken p-3 font-mono text-[11px] leading-[1.6] text-fg">
            {EXAMPLE}
          </pre>
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-fg-muted">
            <li><span className="font-mono text-fg">;</span> começa um comentário até o fim da linha.</li>
            <li>
              <span className="font-mono text-fg">R0</span> a <span className="font-mono text-fg">R7</span> são
              os registradores; maiúsculas e minúsculas valem igual.
            </li>
            <li>
              Um <b className="text-fg">label</b> (<span className="font-mono text-fg">LOOP:</span>) dá nome a
              um endereço e serve de destino de <span className="font-mono text-fg">JMP</span>,{" "}
              <span className="font-mono text-fg">JZ</span>, <span className="font-mono text-fg">JC</span> e{" "}
              <span className="font-mono text-fg">JN</span>.
            </li>
            <li>
              <span className="font-mono text-fg">.data</span> abre a seção de variáveis e{" "}
              <span className="font-mono text-fg">.code</span> (ou <span className="font-mono text-fg">.text</span>)
              volta ao código. Cada linha <span className="font-mono text-fg">NOME: DB valor</span> reserva
              uma palavra da memória de dados, na ordem em que aparece, com o valor inicial (0 se omitido).
            </li>
            <li>
              Números: decimal (<span className="font-mono text-fg">10</span>), negativo (
              <span className="font-mono text-fg">-5</span>), hexadecimal (
              <span className="font-mono text-fg">0xFF</span> ou <span className="font-mono text-fg">0FFh</span>).
            </li>
            <li>
              <span className="font-mono text-fg">LDAI</span> aceita de −128 a 255. Endereços de memória vão de 0 a 255.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <Heading>Atalhos</Heading>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-baseline gap-3">
              <Kbd>{s.keys}</Kbd>
              <span className="text-[12px] text-fg-muted">{s.note}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-fg-faint">
          Os atalhos de teclado ficam desligados enquanto você digita no editor.
        </p>
      </section>

      <section>
        <Heading>Ajustes e barra superior</Heading>
        <ul className="space-y-1.5 text-[12px] leading-relaxed text-fg-muted">
          <li>
            <b className="text-fg">Valores:</b> a base em que os números aparecem — hex, dec+ (sem sinal),
            dec± (com sinal, em complemento de dois) e bin. Sinais de controle, flags, endereços,
            opcodes e instruções nunca aparecem com sinal.
          </li>
          <li>
            <b className="text-fg">Sinais:</b> mostrar ou ocultar os fios; e, dentro deles, só os de
            controle ou só os de dados.
          </li>
          <li>
            <b className="text-fg">Velocidade:</b> de Baixa a Alta, a mesma velocidade em qualquer fio.
            Segure o botão de avanço rápido (ou a tecla F) para acelerar só o tick em andamento.
          </li>
          <li>
            <b className="text-fg">Zoom:</b> os botões − e + aproximam e afastam; a porcentagem ajusta o
            desenho à tela. Também há o tema claro e escuro.
          </li>
        </ul>
      </section>

      <section>
        <Heading>Legenda do desenho</Heading>
        <Legend />
      </section>

      <section>
        <Heading>Programas de exemplo</Heading>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRESET_PROGRAMS.map((p) => (
            <button
              key={p.id}
              disabled={locked}
              onClick={() => {
                setAssemblySource(p.source);
                onClose();
              }}
              title={locked ? "Encerre a simulação para trocar o programa" : "Carregar este programa no editor"}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-[12px] text-fg transition-colors hover:border-line-strong hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>{p.name}</span>
              <span className="text-[11px] text-fg-faint">carregar</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
