"use client";

import { useProgramDataStore } from "@/lib/programDataStore";
import { useExecutionStore } from "@/lib/executionStore";
import { loadTestProgram } from "@/lib/testProgram";
import { assemble } from "@/lib/assembler";
import { useState } from "react";

const PROGRAM_PLACEHOLDER = `; Escreva seu programa assembly aqui
; Exemplo:
;   LDAI R0, #5
;   LDAI R1, #3
;   ADD R2, R0, R1
;   STA R2, 0x00
;   HLT`;

/**
 * AssemblyPanel — Left sidebar (300px) for Program Mode.
 *
 * Contains:
 * - Editable assembly textarea bound to programDataStore.assemblySource
 * - "Assembler em desenvolvimento" notice (non-blocking)
 * - Status display (ticks captured)
 */
export default function AssemblyPanel() {
  const assemblySource = useProgramDataStore((s) => s.assemblySource);
  const setAssemblySource = useProgramDataStore((s) => s.setAssemblySource);

  const loadAndExecute = useExecutionStore((s) => s.loadAndExecute);
  const isLoaded = useExecutionStore((s) => s.isLoaded);
  const totalTicks = useExecutionStore((s) => s.totalTicks);
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
  const exitTimeline = useExecutionStore((s) => s.exitTimeline);

  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    if (isRunning) return;
    setIsRunning(true);

    if (isTimelineActive) {
      exitTimeline();
    }

    window.setTimeout(() => {
      try {
        const words = assemble(assemblySource);
        if (words === null) {
          // Fall back to test program while assembler is not implemented
          loadTestProgram();
        }
        // TODO: when assemble() returns words, load into IMEM
        loadAndExecute();
      } finally {
        setIsRunning(false);
      }
    }, 0);
  };

  return (
    <aside className="h-full flex flex-col bg-gray-950 border-r border-gray-800 w-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-sm font-semibold text-gray-100">Assembly</h2>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
        {/* Assembly textarea */}
        <textarea
          value={assemblySource}
          onChange={(e) => setAssemblySource(e.target.value)}
          placeholder={PROGRAM_PLACEHOLDER}
          spellCheck={false}
          className="w-full min-h-[220px] h-[calc(100%-160px)] rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-mono text-gray-200 placeholder:text-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-600 focus:border-cyan-600 transition-colors"
          aria-label="Assembly source code"
        />

        {/* Assembler notice */}
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-600/50 bg-amber-900/30 px-3 py-1 text-[11px] font-semibold text-amber-300">
          <span aria-hidden>⚠</span>
          <span>Assembler em desenvolvimento — usando programa de teste</span>
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {isRunning && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          <span>{isRunning ? "Executando..." : "▶ Carregar e Executar"}</span>
        </button>

        {/* Execution result */}
        {isLoaded && (
          <div className="rounded-lg border border-emerald-700/60 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300">
            ✓ Execução concluída — {totalTicks} ticks capturados.
          </div>
        )}
      </div>
    </aside>
  );
}
