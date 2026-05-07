"use client";

import { useMemo } from "react";
import { CpuState, CPU_STATE_LABELS, Opcode, opcodeToMnemonic } from "@/lib/simulator";
import { useExecutionStore } from "@/lib/executionStore";
import { STATE_COLORS } from "@/components/widgets/CpuComponent";

const FALLBACK_STATE_CLASS = "text-gray-300 bg-gray-800 border-gray-600";

function formatOpcode(opcode: number): string {
  try {
    return opcodeToMnemonic(opcode as Opcode);
  } catch {
    return `0x${opcode.toString(16).toUpperCase().padStart(2, "0")}`;
  }
}

export default function ExecutionTimeline() {
  const snapshots = useExecutionStore((s) => s.snapshots);
  const currentIndex = useExecutionStore((s) => s.currentIndex);
  const totalTicks = useExecutionStore((s) => s.totalTicks);
  const canGoBack = useExecutionStore((s) => s.canGoBack);
  const canGoForward = useExecutionStore((s) => s.canGoForward);
  const goToTick = useExecutionStore((s) => s.goToTick);
  const goToStart = useExecutionStore((s) => s.goToStart);
  const goToEnd = useExecutionStore((s) => s.goToEnd);
  const stepBackward = useExecutionStore((s) => s.stepBackward);
  const stepForward = useExecutionStore((s) => s.stepForward);
  const exitProgramMode = useExecutionStore((s) => s.exitProgramMode);

  const currentSnapshot = snapshots[currentIndex];

  const stateLabel = useMemo(() => {
    if (!currentSnapshot) return "--";
    return CPU_STATE_LABELS[currentSnapshot.cpuState as CpuState] ?? "UNKNOWN";
  }, [currentSnapshot]);

  const opcodeLabel = useMemo(() => {
    if (!currentSnapshot) return "--";
    return formatOpcode(currentSnapshot.opcode);
  }, [currentSnapshot]);

  const stateClass = currentSnapshot
    ? (STATE_COLORS[currentSnapshot.cpuState] ?? FALLBACK_STATE_CLASS)
    : FALLBACK_STATE_CLASS;

  const progress = totalTicks > 0 ? (currentIndex / totalTicks) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3">
      <div
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            stepBackward();
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            stepForward();
          }
        }}
        className="mx-auto w-full max-w-[1400px] rounded-2xl border border-gray-700 bg-gray-900/95 px-4 py-3 shadow-2xl backdrop-blur focus:outline-none focus:ring-2 focus:ring-cyan-500"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={goToStart}
            disabled={!canGoBack}
            className="h-8 rounded-md border border-gray-700 bg-gray-800 px-2 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            title="Ir para o inicio"
          >
            |◀
          </button>
          <button
            onClick={stepBackward}
            disabled={!canGoBack}
            className="h-8 rounded-md border border-gray-700 bg-gray-800 px-2 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            title="Voltar 1 tick"
          >
            ◀
          </button>

          <div className="ml-1 text-sm font-semibold text-gray-100 min-w-[140px] text-center">
            Tick {currentIndex} / {totalTicks}
          </div>

          <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${stateClass}`}>
            {stateLabel}
          </span>

          <span className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] font-mono text-cyan-200">
            {opcodeLabel}
          </span>

          <button
            onClick={stepForward}
            disabled={!canGoForward}
            className="ml-auto h-8 rounded-md border border-gray-700 bg-gray-800 px-2 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            title="Avancar 1 tick"
          >
            ▶
          </button>
          <button
            onClick={goToEnd}
            disabled={!canGoForward}
            className="h-8 rounded-md border border-gray-700 bg-gray-800 px-2 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            title="Ir para o fim"
          >
            ▶|
          </button>

          <button
            onClick={exitProgramMode}
            className="ml-2 h-8 rounded-md border border-red-700/50 bg-red-900/40 px-3 text-xs font-semibold text-red-200 hover:bg-red-900/60"
            title="Sair do Program Mode"
          >
            ✕ Sair
          </button>
        </div>

        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalTicks)}
            value={Math.min(currentIndex, Math.max(0, totalTicks))}
            onChange={(event) => goToTick(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-cyan-500"
            style={{
              background: `linear-gradient(to right, rgb(6 182 212) ${progress}%, rgb(55 65 81) ${progress}%)`,
            }}
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
            <span>0</span>
            <span>{totalTicks}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
