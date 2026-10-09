"use client";

import { ChevronDown } from "lucide-react";
import { useProgramDataStore, mountStatus } from "@/lib/programDataStore";
import { useExecutionStore } from "@/lib/executionStore";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum, formatPortValue } from "@/lib/displayStore";
import { fmtAddr } from "@/lib/memoryFormat";
import { useT } from "@/lib/i18n";

/** Width of the panel expanded — in rem, so it grows with the text size. */
export const MAQUINA_W_REM = 13.5;

/** Both tables list 8-bit addresses (256-word memories): two hex digits. */
const LISTING_ADDR_BITS = 8;

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
  const t = useT();
  const L = t.program.assembled;
  const col = t.program.columns;
  const assembled = useProgramDataStore((s) => s.assembled);
  const assemblySource = useProgramDataStore((s) => s.assemblySource);
  const mountedSource = useProgramDataStore((s) => s.mountedSource);
  const assemblyErrors = useProgramDataStore((s) => s.assemblyErrors);

  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
  const frames = useExecutionStore((s) => s.frames);
  const currentIndex = useExecutionStore((s) => s.currentIndex);
  const base = useDisplayStore((s) => s.numericBase);

  // While a program runs, the data table mirrors data memory as it changes —
  // a symbol bound to an address must show what that address currently holds,
  // not the value the assembler wrote there. `revision` bumps on every reveal.
  const revision = useSimulatorStore((s) => s.revision);
  const memory = useSimulatorStore((s) => s.getPrimaryMemory());
  void revision;
  const dataValueFor = (addr: number, assembledValue: number) =>
    isTimelineActive && memory ? memory.peek(addr) : assembledValue;

  const currentPc = isTimelineActive ? frames[currentIndex]?.postTick?.pc : undefined;
  const status = mountStatus({ mountedSource, assemblySource, assembled, assemblyErrors });

  return (
    <aside
      data-tour="machine"
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-line bg-surface"
      style={{ width: `${MAQUINA_W_REM}rem` }}
    >
      <button
        onClick={onToggleCollapse}
        aria-expanded="true"
        title={L.collapse}
        className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2 text-left transition-colors hover:bg-raised"
      >
        <span className="flex items-center gap-1.5">
          <h2 className="t-panel text-fg">{t.common.ui.machinePanel}</h2>
          {status === "stale" && (
            <span className="rounded-md border border-st-warn px-1 font-mono text-micro leading-[14px] text-st-warn">
              {L.outdated}
            </span>
          )}
        </span>
        <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-fg-faint" />
      </button>

      {status === "none" && (
        <div className="flex flex-1 items-center justify-center px-3 text-center text-small text-fg-faint">
          {L.notAssembled}
        </div>
      )}

      {status === "errors" && (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="font-mono text-small text-st-error">
            {L.failed(assemblyErrors.length)}
          </p>
          <p className="mt-1 text-small leading-snug text-fg-faint">
            {L.seeErrors}
          </p>
        </div>
      )}

      {assembled && (status === "ok" || status === "stale") && (
        <div className={`flex min-h-0 flex-1 flex-col ${status === "stale" ? "opacity-60" : ""}`}>
          {/* Programa scrolls; Dados below is pinned, so a long program never
              pushes the data table out of view. */}
          <div className="flex min-h-0 flex-1 flex-col">
            <SectionLabel>{L.programSection}</SectionLabel>
            <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
              <table className="w-full border-collapse font-mono text-small">
                <thead>
                  <tr className="text-fg-faint">
                    <th className="px-1.5 py-0.5 text-left font-normal">{col.addr}</th>
                    <th className="px-1.5 py-0.5 text-left font-normal">{col.word}</th>
                    <th className="px-1.5 py-0.5 text-left font-normal">{col.opcode}</th>
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
                        <td className="num px-1.5 py-0.5 text-fg-faint">{fmtAddr(line.addr, LISTING_ADDR_BITS)}</td>
                        <td className="num px-1.5 py-0.5 text-fg-muted">
                          {formatPortValue(line.word, base, 16, true)}
                        </td>
                        <td className={`px-1.5 py-0.5 ${isCurrent ? "text-fg" : "text-fg-muted"}`}>
                          {line.mnemonic}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {assembled.dataSymbols.length > 0 && (
            <div className="flex max-h-[45%] shrink-0 flex-col border-t border-line">
              <SectionLabel>{L.dataSection}</SectionLabel>
              <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
                <table className="w-full border-collapse font-mono text-small">
                  <thead>
                    <tr className="text-fg-faint">
                      <th className="px-1.5 py-0.5 text-left font-normal">{col.addr}</th>
                      <th className="px-1.5 py-0.5 text-left font-normal">{col.word}</th>
                      <th className="px-1.5 py-0.5 text-left font-normal">{col.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assembled.dataSymbols.map((sym) => (
                      <tr key={sym.name}>
                        <td className="num px-1.5 py-0.5 text-fg-faint">{fmtAddr(sym.addr, LISTING_ADDR_BITS)}</td>
                        <td className="num px-1.5 py-0.5 text-fg-muted">
                          {formatNum(dataValueFor(sym.addr, sym.value), base, 16)}
                        </td>
                        <td className="px-1.5 py-0.5 text-fg-muted">{sym.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="shrink-0 px-2.5 pb-0.5 pt-1.5 text-caption text-fg-faint">{children}</div>;
}
