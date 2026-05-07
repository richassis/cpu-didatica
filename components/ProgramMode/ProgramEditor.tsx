"use client";

import { useState } from "react";
import { loadTestProgram } from "@/lib/testProgram";
import { useExecutionStore } from "@/lib/executionStore";

const PROGRAM_PLACEHOLDER = `; TODO: assembler
; Programa de teste:
;  LDAI R0, #5
;  LDAI R1, #3
;  ADD R2, R0, R1
;  STA R2, 0x00
;  HLT`;

export default function ProgramEditor() {
  const loadAndExecute = useExecutionStore((s) => s.loadAndExecute);
  const isLoaded = useExecutionStore((s) => s.isLoaded);
  const totalTicks = useExecutionStore((s) => s.totalTicks);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    if (isRunning) return;

    setIsRunning(true);
    window.setTimeout(() => {
      try {
        loadTestProgram();
        loadAndExecute();
      } finally {
        setIsRunning(false);
      }
    }, 0);
  };

  return (
    <aside className="h-full flex flex-col bg-gray-950 border-r border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-100">Program</h2>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-auto">
        <textarea
          disabled
          value=""
          placeholder={PROGRAM_PLACEHOLDER}
          className="w-full min-h-[220px] rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-mono text-gray-400 placeholder:text-gray-500 resize-none"
          aria-label="Program source placeholder"
        />

        <div className="inline-flex items-center gap-2 rounded-full border border-amber-600/50 bg-amber-900/30 px-3 py-1 text-[11px] font-semibold text-amber-300">
          <span aria-hidden>⚠</span>
          <span>Assembler em desenvolvimento</span>
        </div>

        <button
          onClick={handleRun}
          disabled={isRunning}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          <span>{isRunning ? "Executando..." : "Carregar e Executar"}</span>
        </button>

        {isLoaded && (
          <div className="rounded-lg border border-emerald-700/60 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300">
            Execucao concluida. {totalTicks} ticks capturados.
          </div>
        )}
      </div>
    </aside>
  );
}
