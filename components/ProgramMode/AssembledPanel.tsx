"use client";

import { useProgramDataStore } from "@/lib/programDataStore";
import { useExecutionStore } from "@/lib/executionStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";

function fmtAddr(addr: number) {
  return "0x" + addr.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * The bytecode view: what the assembler produced from the source beside it,
 * kept live as the student types (see `programDataStore.assembled`). A
 * side column rather than something tucked under the editor, so mnemonics
 * turning into opcodes and labels turning into addresses reads as a second
 * view of the same program, not a build log.
 *
 * Hidden while the source has errors or hasn't assembled to anything yet —
 * a half-built listing next to a red error list would just be noise. It
 * reappears the moment the source assembles clean.
 */
export default function AssembledPanel() {
  const assembled = useProgramDataStore((s) => s.assembled);

  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
  const frames = useExecutionStore((s) => s.frames);
  const currentIndex = useExecutionStore((s) => s.currentIndex);
  const base = useDisplayStore((s) => s.numericBase);

  const currentPc = isTimelineActive ? frames[currentIndex]?.postTick?.pc : undefined;

  if (!assembled || assembled.errors.length > 0) return null;

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col overflow-hidden border-r border-line bg-surface">
      <div className="shrink-0 border-b border-line px-3 py-2">
        <h2 className="t-panel text-fg">Montagem</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="text-fg-faint">
              <th className="px-1.5 py-0.5 text-left font-normal">end.</th>
              <th className="px-1.5 py-0.5 text-left font-normal">palavra</th>
              <th className="px-1.5 py-0.5 text-left font-normal">instr.</th>
            </tr>
          </thead>
          <tbody>
            {assembled.listing.map((line) => {
              const isCurrent = line.addr === currentPc;
              return (
                <tr
                  key={line.addr}
                  style={
                    isCurrent
                      ? { background: "color-mix(in srgb, var(--st-active) 10%, transparent)" }
                      : undefined
                  }
                >
                  <td className="num px-1.5 py-0.5 text-fg-faint">{fmtAddr(line.addr)}</td>
                  <td className="num px-1.5 py-0.5 text-fg-muted">
                    {formatNum(line.word, base, 16)}
                  </td>
                  <td className={`px-1.5 py-0.5 ${isCurrent ? "text-fg" : "text-fg-muted"}`}>
                    {line.mnemonic}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {assembled.dataSymbols.length > 0 && (
          <>
            <div className="mt-1.5 border-t border-line px-1.5 pt-1.5 pb-1 text-[10px] text-fg-faint">
              Dados
            </div>
            <table className="w-full border-collapse font-mono text-[11px]">
              <tbody>
                {assembled.dataSymbols.map((sym) => (
                  <tr key={sym.name}>
                    <td className="px-1.5 py-0.5 text-fg-muted">{sym.name}</td>
                    <td className="num px-1.5 py-0.5 text-fg-faint">{fmtAddr(sym.addr)}</td>
                    <td className="num px-1.5 py-0.5 text-fg-muted">
                      {formatNum(sym.value, base, 16)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </aside>
  );
}
