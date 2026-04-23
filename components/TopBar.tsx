"use client";

import { useState } from "react";
import ProjectSwitcher from "./ProjectSwitcher";
import ModeToggle from "./ModeToggle";
import { useExecutionStore } from "@/lib/executionStore";
import { loadTestProgram } from "@/lib/testProgram";

/**
 * TopBar - Slim top bar for the simulator
 * 
 * Contains:
 * - Project switcher dropdown (includes save/import/export)
 * - Mode toggle (Edit/Simulation)
 */
export default function TopBar() {
  const isProgramMode = useExecutionStore((s) => s.isProgramMode);
  const loadAndExecute = useExecutionStore((s) => s.loadAndExecute);
  const [isRunning, setIsRunning] = useState(false);

  const handleEnterProgramMode = () => {
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
    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
      {/* Left: Project Switcher */}
      <div className="flex items-center gap-4">
        <ProjectSwitcher />
        {isProgramMode && (
          <span className="rounded-full border border-cyan-600/50 bg-cyan-900/30 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
            Program Mode
          </span>
        )}
      </div>

      {/* Right: Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleEnterProgramMode}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-md border border-cyan-600/50 bg-cyan-900/30 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-60"
          title="Carrega o programa de teste e executa ate HALT"
        >
          {isRunning ? "Executando..." : "▶ Program Mode"}
        </button>
        <ModeToggle />
      </div>
    </div>
  );
}

