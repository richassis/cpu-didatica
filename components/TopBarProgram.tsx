"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Download, Pencil, Settings2, HelpCircle, Plus, Minus } from "lucide-react";
import { useModeStore } from "@/lib/modeStore";
import { useProjectStore } from "@/lib/projectStore";
import { DEFAULT_PROJECT_ID, isDefaultProject } from "@/lib/defaultProject";
import { useProgramDataStore } from "@/lib/programDataStore";
import { EDITOR_ENABLED } from "@/lib/editorFlag";
import { CODE_FILE_ACCEPT } from "@/lib/codeFile";
import SaveProgramDialog from "@/components/ProgramMode/SaveProgramDialog";
import { useLayoutStore, ZOOM_MIN, ZOOM_MAX } from "@/lib/store";
import { useCanvasViewStore } from "@/lib/canvasViewStore";
import SimulationSettings from "@/components/SimulationSettings";
import HelpDialog from "@/components/Help/HelpDialog";
import { useHelpStore } from "@/lib/helpStore";
import ThemeToggle from "./ThemeToggle";
import ErrorToast from "./ErrorToast";
import { getMessages } from "@/lib/i18n";

/**
 * Top bar for Program Mode (the default, end-user view).
 *
 * Left: what is open. Right, in two groups: the file and display controls
 * (Abrir/Salvar, Ajustes, Claro/Escuro), then the view controls (zoom, Ajuda).
 * Montar and Simular live in the bottom bar with the player. Ajustes opens a
 * panel just under this bar; Ajuda opens the help modal (HelpDialog).
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
  // Ajustes is the only panel under this bar; Ajuda is a modal with its own
  // open state in useHelpStore.
  const [panel, setPanel] = useState<"settings" | null>(null);
  const helpOpen = useHelpStore((s) => s.open);
  const showHelp = useHelpStore((s) => s.show);
  const hideHelp = useHelpStore((s) => s.hide);

  const zoom = useLayoutStore((s) => s.zoom);
  const zoomIn = useCanvasViewStore((s) => s.zoomIn);
  const zoomOut = useCanvasViewStore((s) => s.zoomOut);
  const fit = useCanvasViewStore((s) => s.fit);

  // Escape closes the settings panel. HelpDialog handles its own Escape.
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const togglePanel = (next: "settings") => setPanel((p) => (p === next ? null : next));

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
        setImportError(err instanceof Error ? err.message : getMessages().errors.fileOpenFailed);
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
        <span className="truncate font-mono text-small text-fg-faint">
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

        <PanelButton tour="settings" label="Ajustes" active={panel === "settings"} onClick={() => togglePanel("settings")}>
          <Settings2 size={14} strokeWidth={1.5} />
        </PanelButton>

        <ThemeToggle />

        <span className="mx-1 h-5 w-px shrink-0 bg-line" />

        <div data-tour="zoom">
        <Cluster>
          <button
            onClick={() => zoomOut?.()}
            disabled={!zoomOut || zoom <= ZOOM_MIN}
            className="flex h-8 w-8 items-center justify-center text-fg-muted transition-colors hover:text-fg disabled:opacity-30"
            title="Diminuir zoom"
            aria-label="Diminuir zoom"
          >
            <Minus size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => fit?.()}
            className="num min-w-[3.5rem] text-center font-mono text-xs text-fg-muted transition-colors hover:text-fg"
            title="Ajustar à tela"
            aria-label="Ajustar à tela"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => zoomIn?.()}
            disabled={!zoomIn || zoom >= ZOOM_MAX}
            className="flex h-8 w-8 items-center justify-center text-fg-muted transition-colors hover:text-fg disabled:opacity-30"
            title="Aumentar zoom"
            aria-label="Aumentar zoom"
          >
            <Plus size={14} strokeWidth={1.5} />
          </button>
        </Cluster>
        </div>

        <PanelButton tour="help" label="Ajuda" active={helpOpen} onClick={() => { setPanel(null); showHelp(); }}>
          <HelpCircle size={14} strokeWidth={1.5} />
        </PanelButton>

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

      {panel && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Ajustes da simulação"
          className="absolute right-4 top-full z-50 mt-2 max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-line bg-surface p-4"
        >
          <SimulationSettings />
        </div>
      )}

      {/* Import failures used to go to console.error, so picking the wrong file
          looked like nothing happening at all. */}
      {importError && (
        <ErrorToast
          message={importError}
          onClose={() => setImportError(null)}
          className="left-1/2 w-[420px] max-w-[90vw] -translate-x-1/2"
        />
      )}

      {helpOpen && <HelpDialog onClose={hideHelp} />}

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

function PanelButton({
  label,
  active,
  onClick,
  tour,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  /** Anchor for the guided tour. */
  tour?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      data-tour={tour}
      onClick={onClick}
      aria-expanded={active}
      title={label}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors ${
        active
          ? "border-line-strong text-fg"
          : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
      }`}
    >
      {children}
      {label}
    </button>
  );
}
