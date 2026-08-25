"use client";

import { Silhouette, ClockNotch, MemorySpine, GLYPHS } from "@/components/widgets/silhouettes";

/**
 * How to read the canvas.
 *
 * Two columns, and the point of the panel is the sentence between them: shape
 * and colour are independent channels. Nothing on this screen explained the
 * wire colours, the phase pills or the Z/C/N flags before, so a student had to
 * infer the whole vocabulary. Now it is written down.
 */

/** A miniature of one component class, drawn with the real silhouette parts. */
function ShapeSample({
  children,
  label,
  note,
}: {
  children: React.ReactNode;
  label: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="node relative h-7 w-10 shrink-0" data-state="idle">
        {children}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] text-fg-muted">{label}</div>
        {note && <div className="truncate text-[10px] text-fg-faint">{note}</div>}
      </div>
    </div>
  );
}

function StateSample({ color, label, note }: { color: string; label: string; note: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-3 w-3 shrink-0 rounded-full border"
        style={{ borderColor: color, background: `color-mix(in srgb, ${color} 25%, transparent)` }}
      />
      <div className="min-w-0">
        <div className="truncate text-[11px] text-fg-muted">{label}</div>
        <div className="truncate text-[10px] text-fg-faint">{note}</div>
      </div>
    </div>
  );
}

export default function Legend() {
  const Register = GLYPHS.Register;
  const Memory = GLYPHS.MemoryComponent;

  return (
    <div className="w-[380px]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <div className="t-section mb-2">Forma — o que é</div>
              <div className="space-y-2">
                <ShapeSample label="Registrador" note="guarda um único valor">
                  <span className="node--boxed absolute inset-0 rounded-[6px]" />
                  <ClockNotch />
                  <span className="absolute left-0 top-0 flex h-4 w-4 items-center justify-center text-fg-faint">
                    <Register size={10} strokeWidth={1.5} />
                  </span>
                </ShapeSample>

                <ShapeSample label="Memória" note="lombada na borda esquerda">
                  <span className="node--boxed absolute inset-0 rounded-[6px]" />
                  <MemorySpine />
                  <ClockNotch />
                  <span className="absolute right-0.5 top-0.5 text-fg-faint">
                    <Memory size={10} strokeWidth={1.5} />
                  </span>
                </ShapeSample>

                <ShapeSample label="ULA" note="trapézio com entalhe">
                  <Silhouette kind="alu" />
                </ShapeSample>

                <ShapeSample label="Multiplexador" note="trapézio, sem entalhe">
                  <Silhouette kind="mux" />
                </ShapeSample>

                <ShapeSample label="Decodificador" note="trapézio invertido">
                  <Silhouette kind="decoder" />
                </ShapeSample>

                <ShapeSample label="Unidade de controle" note="tracejada — comanda o caminho de dados">
                  <span className="node--boxed node--control absolute inset-0 rounded-[6px]" />
                </ShapeSample>
              </div>
            </div>

            <div>
              <div className="t-section mb-2">Cor — o que está acontecendo</div>
              <div className="space-y-2">
                <StateSample
                  color="var(--st-active)"
                  label="Ativo"
                  note="executando neste tick"
                />
                <StateSample
                  color="var(--st-data)"
                  label="Dado"
                  note="fio ou registrador com valor"
                />
                <StateSample color="var(--st-warn)" label="Atenção" note="flag ativada" />
                <StateSample color="var(--st-error)" label="Erro" note="halt, overflow, endereço inválido" />
                <StateSample
                  color="var(--border-strong)"
                  label="Ocioso"
                  note="fora deste tick"
                />
              </div>

              <div className="mt-4 border-t border-line pt-3">
                <div className="t-section mb-1.5">Entalhe de clock ▷</div>
                <p className="text-[10px] leading-snug text-fg-faint">
                  Componentes com o entalhe são sequenciais — travam no clock.
                  Os que não têm são combinacionais.
                </p>
              </div>
            </div>
          </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="t-section mb-1.5">Atalhos</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <Shortcut keys="Espaço" note="reproduzir / pausar" />
          <Shortcut keys="← →" note="um tick para trás / frente" />
          <Shortcut keys="Home" note="início" />
          <Shortcut keys="End" note="fim" />
        </div>
      </div>

      <p className="mt-3 border-t border-line pt-3 text-[10px] leading-snug text-fg-faint">
        As duas colunas são independentes. A forma nunca muda durante a execução, e
        a cor nunca diz qual componente você está olhando.
      </p>
    </div>
  );
}

function Shortcut({ keys, note }: { keys: string; note: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <kbd className="shrink-0 rounded border border-line px-1 font-mono text-[10px] text-fg-muted">
        {keys}
      </kbd>
      <span className="truncate text-[10px] text-fg-faint">{note}</span>
    </div>
  );
}
