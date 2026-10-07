"use client";

import { Fragment } from "react";
import { Opcode, OPCODE_SEQUENCES, CONTROL_SIGNAL_DEFS, INSTRUCTION_SET, CpuState, CPU_STATE_LABELS } from "@/lib/simulator";
import { STATE_CONTROL_SIGNALS } from "@/lib/simulator/Cpu";
import { COMPONENT_HELP, SIGNAL_HELP, STATE_HELP } from "@/lib/helpContent";

/** The signals the control unit shows, in its own order (`muxAMem` is not wired). */
const SIGNALS = ["muxPC", "wrPC", "wrIR", "rdMem", "wrMem", "muxAReg", "muxDReg", "wrReg", "opULA"] as const;

/** The states, in the order a tick sequence meets them. */
const STATES = [
  CpuState.FETCH,
  CpuState.DECODE,
  CpuState.READMEM,
  CpuState.WRITEREG1,
  CpuState.WRITEREG2,
  CpuState.READREG1,
  CpuState.WRITEMEM,
  CpuState.READREG2,
  CpuState.EXECUTE,
  CpuState.WRITEREG3,
  CpuState.WRITEPC,
] as const;

const INSTRUCTIONS = Object.values(INSTRUCTION_SET).sort((a, b) => a.opcode - b.opcode);

function StateChip({ state }: { state: CpuState }) {
  return (
    <span className="rounded-md border border-line px-1.5 py-0.5 font-mono text-caption text-fg-muted">
      {CPU_STATE_LABELS[state]}
    </span>
  );
}

/** What a state sets for one signal, or a note for the two that depend on the instruction. */
function signalCell(state: CpuState, name: (typeof SIGNALS)[number]): string {
  if (state === CpuState.EXECUTE && name === "opULA") return "da instrução";
  if (state === CpuState.WRITEPC && (name === "wrPC" || name === "muxPC")) {
    return name === "wrPC" ? "1*" : "0*";
  }
  const value = STATE_CONTROL_SIGNALS[state]?.[name];
  return value === undefined ? "" : String(value);
}

export default function DatapathTab() {
  const signalDefs = CONTROL_SIGNAL_DEFS.filter((d) => (SIGNALS as readonly string[]).includes(d.name));
  const orderedDefs = SIGNALS.map((n) => signalDefs.find((d) => d.name === n)!);

  return (
    <div className="space-y-8">
      <section>
        <h3 className="t-node mb-1 text-fg">O caminho de dados</h3>
        <p className="mb-3 text-ui leading-relaxed text-fg-muted">
          Um esquema simplificado. As linhas azuis são fios de dados; a unidade de controle (UC) manda
          os sinais de controle para todos os blocos. O desenho completo, com todos os fios, é o que
          você vê ao lado do código.
        </p>
        <Schematic />
      </section>

      <section>
        <h3 className="t-node mb-3 text-fg">Componentes</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {COMPONENT_HELP.map((c) => (
            <div key={c.name} className="rounded-lg border border-line px-3 py-2">
              <div className="t-node text-fg">{c.name}</div>
              <div className="font-mono text-caption leading-snug text-fg-faint">{c.spec}</div>
              <p className="mt-1 text-small leading-snug text-fg-muted">{c.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="t-node mb-1 text-fg">Sinais de controle</h3>
        <p className="mb-3 text-ui leading-relaxed text-fg-muted">
          A UC não calcula nada: ela liga e desliga estes sinais, estado a estado, e os blocos
          fazem o resto.
        </p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-raised text-fg-muted">
                <th className="px-2.5 py-1.5 font-normal">Sinal</th>
                <th className="px-2.5 py-1.5 font-normal">Bits</th>
                <th className="px-2.5 py-1.5 font-normal">O que faz</th>
                <th className="px-2.5 py-1.5 font-normal">Valores</th>
              </tr>
            </thead>
            <tbody>
              {orderedDefs.map((d) => (
                <tr key={d.name} className="border-b border-line last:border-b-0">
                  <td className="px-2.5 py-1.5 font-mono text-st-active">{d.name}</td>
                  <td className="num px-2.5 py-1.5 font-mono text-fg-muted">{d.bitWidth}</td>
                  <td className="px-2.5 py-1.5 text-fg-muted">{SIGNAL_HELP[d.name]?.does ?? d.description}</td>
                  <td className="px-2.5 py-1.5 font-mono text-fg-faint">{SIGNAL_HELP[d.name]?.values ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="t-node mb-1 text-fg">Máquina de estados</h3>
        <p className="mb-3 text-ui leading-relaxed text-fg-muted">
          Toda instrução começa com <b className="text-fg">BUSCA</b> (FETCH) e{" "}
          <b className="text-fg">DECODIFICA</b> (DECODE). Depois, o opcode escolhe o caminho. Cada
          estado dura um tick de clock e, ao terminar, a UC volta para a BUSCA.
        </p>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-raised text-fg-muted">
                <th className="px-2.5 py-1.5 font-normal">Instrução</th>
                <th className="px-2.5 py-1.5 font-normal">Estados</th>
              </tr>
            </thead>
            <tbody>
              {INSTRUCTIONS.map((d) => {
                const sequence = OPCODE_SEQUENCES[d.opcode as Opcode] ?? [];
                return (
                  <tr key={d.mnemonic} className="border-b border-line last:border-b-0">
                    <td className="px-2.5 py-1.5 font-mono text-fg">{d.mnemonic}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <StateChip state={CpuState.FETCH} />
                        <span className="text-fg-faint">→</span>
                        <StateChip state={CpuState.DECODE} />
                        {(sequence.length > 0 ? sequence : d.mnemonic === "HLT" ? [CpuState.HALT] : []).map((s) => (
                          <Fragment key={s}>
                            <span className="text-fg-faint">→</span>
                            <StateChip state={s} />
                          </Fragment>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h4 className="t-section mb-2 mt-6">O que cada estado faz e quais sinais define</h4>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-raised text-fg-muted">
                <th className="px-2.5 py-1.5 font-normal">Estado</th>
                {SIGNALS.map((s) => (
                  <th key={s} className="px-1.5 py-1.5 font-mono text-caption font-normal">{s}</th>
                ))}
                <th className="px-2.5 py-1.5 font-normal">O que faz</th>
              </tr>
            </thead>
            <tbody>
              {STATES.map((state) => (
                <tr key={state} className="border-b border-line last:border-b-0">
                  <td className="px-2.5 py-1.5 font-mono text-fg">{CPU_STATE_LABELS[state]}</td>
                  {SIGNALS.map((s) => (
                    <td key={s} className="num px-1.5 py-1.5 text-center font-mono text-fg-muted">
                      {signalCell(state, s) || <span className="text-fg-faint">·</span>}
                    </td>
                  ))}
                  <td className="min-w-[220px] px-2.5 py-1.5 text-fg-muted">{STATE_HELP[state]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-caption leading-snug text-fg-faint">
          · o estado não mexe no sinal, que mantém o valor de antes. * só se o desvio é tomado: JMP
          sempre; JZ e JN quando a flag correspondente está ligada. No estado RESET todos os
          sinais voltam ao valor inicial.
        </p>
      </section>
    </div>
  );
}

// ── Schematic ────────────────────────────────────────────────────────────────

function Box({
  x, y, w, h, label, sub, dashed = false,
}: {
  x: number; y: number; w: number; h: number; label: string; sub?: string; dashed?: boolean;
}) {
  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h} rx={6}
        fill="var(--surface)" stroke="var(--border-strong)" strokeWidth={1}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -2 : 3)} textAnchor="middle" fontSize={12.5} fill="var(--text)" className="font-mono">
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize={10} fill="var(--text-faint)" className="font-mono">
          {sub}
        </text>
      )}
    </g>
  );
}

/** A polyline with an arrowhead at its last point. */
function Wire({ points }: { points: Array<[number, number]> }) {
  return (
    <polyline
      points={points.map((p) => p.join(",")).join(" ")}
      fill="none" stroke="var(--st-data)" strokeWidth={1.4}
      markerEnd="url(#help-arrow)"
    />
  );
}

/**
 * A simplified, static map of the datapath. It is deliberately not the real
 * canvas: only the blocks and the main data paths, so the whole machine fits
 * in one glance before the student meets the detailed one.
 */
function Schematic() {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-sunken p-2">
      <svg viewBox="0 0 720 340" className="min-w-[640px]" role="img" aria-label="Esquema simplificado do caminho de dados">
        <defs>
          <marker id="help-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--st-data)" />
          </marker>
        </defs>

        {/* Fetch */}
        <Box x={10} y={20} w={54} h={54} label="MUX" sub="PC" />
        <Box x={100} y={30} w={60} h={34} label="PC" />
        <Box x={200} y={30} w={78} h={34} label="IMem" />
        <Box x={318} y={30} w={60} h={34} label="IR" />
        <Box x={418} y={30} w={92} h={34} label="Decodif." />
        <Box x={100} y={104} w={60} h={34} label="PC+1" />
        <Wire points={[[64, 47], [100, 47]]} />
        <Wire points={[[160, 47], [200, 47]]} />
        <Wire points={[[278, 47], [318, 47]]} />
        <Wire points={[[378, 47], [418, 47]]} />
        <Wire points={[[130, 64], [130, 104]]} />
        <Wire points={[[100, 121], [37, 121], [37, 74]]} />

        {/* Registers and ULA */}
        <Box x={330} y={140} w={110} h={86} label="GPR" sub="R0 – R7" />
        <Box x={218} y={160} w={50} h={46} label="MUX" sub="dado" />
        <Box x={480} y={148} w={40} h={26} label="A" />
        <Box x={480} y={192} w={40} h={26} label="B" />
        <Box x={560} y={152} w={70} h={62} label="ULA" sub="Z C N" />
        <Box x={654} y={168} w={50} h={30} label="R" />
        <Wire points={[[464, 64], [464, 116], [385, 116], [385, 140]]} />
        <Wire points={[[440, 161], [480, 161]]} />
        <Wire points={[[440, 205], [480, 205]]} />
        <Wire points={[[520, 161], [560, 170]]} />
        <Wire points={[[520, 205], [560, 197]]} />
        <Wire points={[[630, 183], [654, 183]]} />
        <Wire points={[[679, 198], [679, 240], [243, 240], [243, 206]]} />
        <Wire points={[[268, 183], [330, 183]]} />

        {/* Data memory */}
        <Box x={330} y={270} w={110} h={44} label="DMem" />
        <Box x={218} y={276} w={60} h={32} label="MAR" />
        <Box x={110} y={196} w={54} h={32} label="MDR" />
        <Wire points={[[278, 292], [330, 292]]} />
        <Wire points={[[330, 302], [137, 302], [137, 228]]} />
        <Wire points={[[164, 212], [218, 196]]} />
        <Wire points={[[248, 256], [248, 276]]} />

        {/* Control unit */}
        <Box x={10} y={322} w={694} h={16} label="UC — máquina de estados que emite os sinais de controle para todos os blocos" dashed />

        <text x={248} y={250} textAnchor="middle" fontSize={10} fill="var(--text-faint)" className="font-mono">operando M do IR</text>
        <text x={232} y={154} textAnchor="middle" fontSize={10} fill="var(--text-faint)" className="font-mono">imediato · memória · ULA</text>
      </svg>
    </div>
  );
}
