"use client";

import { ChevronDown } from "lucide-react";
import { useProgramDataStore, mountStatus } from "@/lib/programDataStore";
import { useExecutionStore } from "@/lib/executionStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";

function fmtAddr(addr: number) {
  return "0x" + addr.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * The bytecode view: what the assembler produced the last time the student
 * pressed Montar (see `programDataStore.assembled`/`mountedSource`). A side
 * column rather than something tucked under the editor, so mnemonics turning
 * into opcodes and labels turning into addresses reads as a second view of
 * the same program, not a build log.
 *
 * Unlike before, this no longer disappears the moment the source has an
 * error or hasn't been mounted — it always renders, with one of three
 * bodies: a prompt to mount, the error count, or the listing (dimmed and
 * badged "desatualizado" if the source has changed since that listing was
 * produced — the old bytecode is still what's loaded in IMEM, so hiding it
 * would misrepresent what is actually about to run).
 */
export default function AssembledPanel({ onToggleCollapse }: { onToggleCollapse: () => void }) {
  const assembled = useProgramDataStore((s) => s.assembled);
  const assemblySource = useProgramDataStore((s) => s.assemblySource);
  const mountedSource = useProgramDataStore((s) => s.mountedSource);
  const assemblyErrors = useProgramDataStore((s) => s.assemblyErrors);

  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
  const frames = useExecutionStore((s) => s.frames);
  const currentIndex = useExecutionStore((s) => s.currentIndex);
  const base = useDisplayStore((s) => s.numericBase);

  const currentPc = isTimelineActive ? frames[currentIndex]?.postTick?.pc : undefined;
  const status = mountStatus({ mountedSource, assemblySource, assembled, assemblyErrors });

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col overflow-hidden border-r border-line bg-surface">
      <button
        onClick={onToggleCollapse}
        aria-expanded="true"
        title="Recolher Montagem"
        className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2 text-left transition-colors hover:bg-raised"
      >
        <span className="flex items-center gap-1.5">
          <h2 className="t-panel text-fg">Montagem</h2>
          {status === "stale" && (
            <span className="rounded-md border border-st-warn px-1 font-mono text-[9px] leading-[14px] text-st-warn">
              desatualizado
            </span>
          )}
        </span>
        <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-fg-faint" />
      </button>

      {status === "none" && (
        <div className="flex flex-1 items-center justify-center px-3 text-center text-[11px] text-fg-faint">
          Pressione Montar para ver o código montado
        </div>
      )}

      {status === "errors" && (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="font-mono text-[11px] text-st-error">
            Montagem falhou ({assemblyErrors.length})
          </p>
          <p className="mt-1 text-[11px] leading-snug text-fg-faint">
            Veja os erros no painel Assembly.
          </p>
        </div>
      )}

      {assembled && (status === "ok" || status === "stale") && (
        <div
          className={`min-h-0 flex-1 overflow-y-auto px-1 py-1 ${status === "stale" ? "opacity-60" : ""}`}
        >
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
      )}
    </aside>
  );
}
