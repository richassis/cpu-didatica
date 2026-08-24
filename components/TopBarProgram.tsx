"use client";

import { useRef } from "react";
import { Upload, Download, Play, Pencil, LoaderCircle } from "lucide-react";
import { useModeStore } from "@/lib/modeStore";
import { useProjectStore } from "@/lib/projectStore";
import { DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME, isDefaultProject } from "@/lib/defaultProject";
import { useProgramDataStore } from "@/lib/programDataStore";
import ThemeToggle from "./ThemeToggle";

/**
 * Top bar for Program Mode (the default, end-user view).
 *
 * The I/O buttons are grouped into clusters with their own surface rather than
 * sitting loose side by side, so the bar reads as three regions instead of six
 * equally-weighted controls.
 */
export default function TopBarProgram() {
  const enterEditMode = useModeStore((s) => s.enterEditMode);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const loadDefaultProject = useProjectStore((s) => s.loadDefaultProject);
  const importAssembly = useProgramDataStore((s) => s.importAssembly);
  const exportAssembly = useProgramDataStore((s) => s.exportAssembly);
  const importData = useProgramDataStore((s) => s.importData);
  const exportData = useProgramDataStore((s) => s.exportData);
  const isRunning = useProgramDataStore((s) => s.isRunning);
  const runProgram = useProgramDataStore((s) => s.runProgram);

  const asmFileRef = useRef<HTMLInputElement>(null);
  const dataFileRef = useRef<HTMLInputElement>(null);

  const handleEnterEditMode = async () => {
    const shouldEditDefault = window.confirm(
      `Editar o datapath default ("${DEFAULT_PROJECT_NAME}")?\n` +
        "As alterações serão salvas no arquivo default-project.cpud."
    );

    if (!shouldEditDefault) return;

    if (!isDefaultProject(activeTabId)) {
      await loadDefaultProject();
      setActiveTab(DEFAULT_PROJECT_ID);
    }

    enterEditMode();
  };

  const handleImportAsm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importAssembly(file).catch(console.error);
    e.target.value = "";
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importData(file).catch(console.error);
    e.target.value = "";
  };

  return (
    <div className="flex min-h-[48px] items-center justify-between border-b border-line bg-surface px-4 py-2">
      <span className="t-body select-none text-fg">CPU Didática</span>

      <div className="flex items-center gap-2">
        <input
          ref={asmFileRef}
          type="file"
          accept=".asm,.s"
          className="hidden"
          onChange={handleImportAsm}
        />
        <input
          ref={dataFileRef}
          type="file"
          accept=".cpudat"
          className="hidden"
          onChange={handleImportData}
        />

        <Cluster>
          <ClusterButton
            onClick={() => asmFileRef.current?.click()}
            title="Import assembly source (.asm / .s)"
          >
            <Upload size={14} strokeWidth={1.5} />
            Import .asm
          </ClusterButton>
          <ClusterDivider />
          <ClusterButton onClick={exportAssembly} title="Export assembly source as program.asm">
            <Download size={14} strokeWidth={1.5} />
            Export .asm
          </ClusterButton>
        </Cluster>

        <Cluster>
          <ClusterButton
            onClick={() => dataFileRef.current?.click()}
            title="Import data file (.cpudat) — loads GPR and memory values"
          >
            <Upload size={14} strokeWidth={1.5} />
            Import data
          </ClusterButton>
          <ClusterDivider />
          <ClusterButton
            onClick={exportData}
            title="Export data file (.cpudat) — saves GPR and memory values"
          >
            <Download size={14} strokeWidth={1.5} />
            Export data
          </ClusterButton>
        </Cluster>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* The button stays neutral; the accent lives in the icon. A solid
            saturated fill on a 90px control would eat most of the colour
            budget for the whole screen. */}
        <button
          onClick={() => runProgram()}
          disabled={isRunning}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-raised px-3 text-xs text-fg transition-colors hover:border-st-active disabled:cursor-not-allowed disabled:opacity-60"
          title="Carregar programa e executar até HLT"
        >
          {isRunning ? (
            <LoaderCircle size={14} strokeWidth={1.5} className="animate-spin text-st-active" />
          ) : (
            <Play size={14} strokeWidth={1.5} className="text-st-active" />
          )}
          {isRunning ? "Running…" : "Run"}
        </button>

        <button
          onClick={handleEnterEditMode}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          title="Entrar no modo de edição (desenvolvedor)"
        >
          <Pencil size={14} strokeWidth={1.5} />
          Edit mode
        </button>
      </div>
    </div>
  );
}

function Cluster({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center rounded-lg border border-line bg-raised">{children}</div>
  );
}

function ClusterDivider() {
  return <div className="h-4 w-px bg-line" />;
}

function ClusterButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex h-8 items-center gap-1.5 px-2.5 text-xs text-fg-muted transition-colors hover:text-fg"
    >
      {children}
    </button>
  );
}
