"use client";

import { Silhouette, MemorySpine } from "@/components/widgets/silhouettes";

/**
 * How to read the canvas.
 *
 * Two columns, and the point of the panel is the sentence between them: shape
 * and colour are independent channels. Nothing on the canvas itself explains
 * the shapes, the wire colours or the state colours (a flag Z/C/N/V lit, the
 * UC halted), so a student had to infer the whole vocabulary. Now it is
 * written down; the Ajuda's guide tab shows it.
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
        <div className="truncate text-small text-fg-muted">{label}</div>
        {note && <div className="truncate text-caption text-fg-faint">{note}</div>}
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
        <div className="truncate text-small text-fg-muted">{label}</div>
        <div className="truncate text-caption text-fg-faint">{note}</div>
      </div>
    </div>
  );
}

export default function Legend() {
  return (
    <div className="w-[380px]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <div className="t-section mb-2">Forma — o que é</div>
              <div className="space-y-2">
                <ShapeSample label="Registrador" note="guarda um único valor">
                  <span className="node--boxed absolute inset-0 rounded-[6px]" />
                </ShapeSample>

                <ShapeSample label="Memória" note="lombada na borda esquerda">
                  <span className="node--boxed absolute inset-0 rounded-[6px]" />
                  <MemorySpine />
                </ShapeSample>

                <ShapeSample label="ULA" note="trapézio com entalhe">
                  <Silhouette kind="alu" />
                </ShapeSample>

                <ShapeSample label="Multiplexador" note="trapézio, sem entalhe">
                  <Silhouette kind="mux" />
                </ShapeSample>

                <ShapeSample label="Decodificador" note="barra vertical fina">
                  <span className="node--boxed absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 rounded-[3px]" />
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
                  note="componente executando neste tick"
                />
                <StateSample
                  color="var(--st-data)"
                  label="Fio de dado"
                  note="azul em movimento; registrador com valor"
                />
                <StateSample
                  color="var(--st-active)"
                  label="Fio de controle"
                  note="verde em movimento; sinal da UC"
                />
                <StateSample color="var(--st-warn)" label="Atenção" note="flag ativada" />
                <StateSample color="var(--st-error)" label="Erro" note="CPU parada pelo HLT" />
                <StateSample
                  color="var(--border-strong)"
                  label="Ocioso"
                  note="fora deste tick"
                />
              </div>
            </div>
          </div>
    </div>
  );
}
