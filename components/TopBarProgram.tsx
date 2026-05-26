"use client";

import { useRef } from "react";
import { useModeStore } from "@/lib/modeStore";
import { useProgramDataStore } from "@/lib/programDataStore";

/**
 * TopBarProgram — Top bar shown in Program Mode (default/end-user view).
 *
 * Left:   App title "CPU Didática"
 * Centre: Assembly I/O + Data I/O buttons
 * Right:  [▶ Run] button + [Edit Mode] button
 */
export default function TopBarProgram() {
  const enterEditMode = useModeStore((s) => s.enterEditMode);
  const importAssembly = useProgramDataStore((s) => s.importAssembly);
  const exportAssembly = useProgramDataStore((s) => s.exportAssembly);
  const importData = useProgramDataStore((s) => s.importData);
  const exportData = useProgramDataStore((s) => s.exportData);
  const isRunning = useProgramDataStore((s) => s.isRunning);
  const runProgram = useProgramDataStore((s) => s.runProgram);

  const asmFileRef = useRef<HTMLInputElement>(null);
  const dataFileRef = useRef<HTMLInputElement>(null);

  const handleRun = () => runProgram();

  const handleImportAsm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importAssembly(file).catch(console.error);
    }
    e.target.value = "";
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importData(file).catch(console.error);
    }
    e.target.value = "";
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 min-h-[48px]">
      {/* Left: App title */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-gray-100 tracking-tight select-none">
          CPU Didática
        </span>
      </div>

      {/* Centre: I/O controls */}
      <div className="flex items-center gap-1">
        {/* Assembly I/O */}
        <input
          ref={asmFileRef}
          type="file"
          accept=".asm,.s"
          className="hidden"
          onChange={handleImportAsm}
        />
        <button
          onClick={() => asmFileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
          title="Import assembly source (.asm / .s)"
        >
          <UploadIcon />
          Import .asm
        </button>
        <button
          onClick={exportAssembly}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
          title="Export assembly source as program.asm"
        >
          <DownloadIcon />
          Export .asm
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Data I/O */}
        <input
          ref={dataFileRef}
          type="file"
          accept=".cpudat"
          className="hidden"
          onChange={handleImportData}
        />
        <button
          onClick={() => dataFileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
          title="Import data file (.cpudat) — loads GPR and memory values"
        >
          <UploadIcon />
          Import Data
        </button>
        <button
          onClick={exportData}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
          title="Export data file (.cpudat) — saves GPR and memory values"
        >
          <DownloadIcon />
          Export Data
        </button>
      </div>

      {/* Right: Run + Edit Mode */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          title="Carregar programa e executar até HLT"
        >
          {isRunning ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <PlayIcon />
          )}
          {isRunning ? "Executando..." : "▶ Run"}
        </button>

        <button
          onClick={enterEditMode}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
          title="Entrar no modo de edição (desenvolvedor)"
        >
          <PencilIcon />
          Edit Mode
        </button>
      </div>
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}
