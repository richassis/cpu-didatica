"use client";

import { useRef, useState } from "react";
import { Upload, Download, Pencil } from "lucide-react";
import { useModeStore } from "@/lib/modeStore";
import { useProjectStore } from "@/lib/projectStore";
import { DEFAULT_PROJECT_ID, isDefaultProject } from "@/lib/defaultProject";
import { useProgramDataStore } from "@/lib/programDataStore";
import { EDITOR_ENABLED } from "@/lib/editorFlag";
import { CODE_FILE_ACCEPT } from "@/lib/codeFile";
import SaveProgramDialog from "@/components/ProgramMode/SaveProgramDialog";
import ThemeToggle from "./ThemeToggle";

/**
 * Top bar for Program Mode (the default, end-user view).
 *
 * It reads as two regions: what is open on the left, and what you can do with
 * the file in the middle. It used to carry four loose I/O buttons across two
 * formats — the `.cpudat` pair is gone, and the code pair became "Abrir"/
 * "Salvar" acting on a file with a visible name. Montar/Executar used to live
 * here too; they moved to `BuildBar`, right above the panels they act on, so
 * that mounting and running read as steps in the code region rather than
 * commands issued from the global chrome.
 *
 * The "Edit mode" entry point exists only in developer builds. Students never
 * see it, and `enterEditMode` refuses anyway.
 */
export default function TopBarProgram() {
  const enterEditMode = useModeStore((s) => s.enterEditMode);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const loadDefaultProject = useProjectStore((s) => s.loadDefaultProject);

  const importAssembly = useProgramDataStore((s) => s.importAssembly);
  const assemblySource = useProgramDataStore((s) => s.assemblySource);
  const programName = useProgramDataStore((s) => s.programName);

  const fileRef = useRef<HTMLInputElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const lineCount = assemblySource.split("\n").length;

  const handleEnterEditMode = async () => {
    if (!isDefaultProject(activeTabId)) {
      await loadDefaultProject();
      setActiveTab(DEFAULT_PROJECT_ID);
    }
    enterEditMode();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportError(null);
      importAssembly(file).catch((err: unknown) => {
        setImportError(err instanceof Error ? err.message : "Falha ao abrir o arquivo.");
      });
    }
    e.target.value = "";
  };

  return (
    <div className="relative flex min-h-[48px] items-center justify-between border-b border-line bg-surface px-4 py-2">
      {/* Left: what is open. The name is the anchor the file actions act on —
          without it "Salvar" has no visible subject. */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="t-body shrink-0 select-none text-fg">CPU Didática</span>
        <span className="h-5 w-px shrink-0 bg-line" />
        <span className="truncate font-mono text-[11px] text-fg-faint">
          {programName}
          <span className="text-fg-muted"> · {lineCount} linhas</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={CODE_FILE_ACCEPT}
          className="hidden"
          onChange={handleImport}
        />

        <Cluster>
          <ClusterButton
            onClick={() => fileRef.current?.click()}
            title="Abrir um arquivo de texto com código assembly"
          >
            <Upload size={14} strokeWidth={1.5} />
            Abrir
          </ClusterButton>
          <ClusterDivider />
          <ClusterButton onClick={() => setSaveOpen(true)} title="Salvar o código em um arquivo">
            <Download size={14} strokeWidth={1.5} />
            Salvar
          </ClusterButton>
        </Cluster>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        {EDITOR_ENABLED && (
          <button
            onClick={handleEnterEditMode}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            title="Entrar no modo de edição (desenvolvedor)"
          >
            <Pencil size={14} strokeWidth={1.5} />
            Edit mode
          </button>
        )}
      </div>

      {/* Import failures used to go to console.error, so picking the wrong file
          looked like nothing happening at all. */}
      {importError && (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-[420px] max-w-[90vw] -translate-x-1/2 rounded-lg border border-st-error bg-surface px-3 py-2">
          <p className="text-[11px] leading-snug text-st-error">{importError}</p>
          <button
            onClick={() => setImportError(null)}
            className="mt-1 text-[11px] text-fg-muted underline-offset-2 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {saveOpen && <SaveProgramDialog onClose={() => setSaveOpen(false)} />}
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
