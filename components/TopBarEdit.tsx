"use client";

import { useState } from "react";
import { Check, ChevronLeft, Pencil, Save } from "lucide-react";
import { useModeStore } from "@/lib/modeStore";
import { saveDefaultProjectFile } from "@/lib/defaultProjectFile";
import ProjectSwitcher from "./ProjectSwitcher";
import ThemeToggle from "./ThemeToggle";

/**
 * Top bar for Edit Mode (developer / instructor view).
 *
 * The "Edit mode" marker is an outlined pill, not a filled badge: it reports a
 * state, and filled state chips are what the datapath itself gave up.
 */
export default function TopBarEdit() {
  const enterProgramMode = useModeStore((s) => s.enterProgramMode);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Force a write of `public/default-project.cpud`.
   *
   * The autosave covers the normal case, but it debounces and it skips writes
   * it suspects are a failed wire restore. The layout is no longer mirrored
   * into localStorage, so the file is the only copy — this is the button that
   * makes "did that actually save?" answerable.
   */
  const handleSave = async () => {
    setSaveState("saving");
    setSaveError(null);
    try {
      await saveDefaultProjectFile();
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (error) {
      setSaveState("idle");
      setSaveError(error instanceof Error ? error.message : "Falha ao gravar o arquivo.");
    }
  };

  return (
    <div className="relative flex min-h-[48px] items-center justify-between border-b border-line bg-surface px-4 py-2">
      <div className="flex items-center gap-3">
        <button
          onClick={enterProgramMode}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          title="Voltar para o Program Mode"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          Program mode
        </button>

        <div className="h-5 w-px bg-line" />

        <ProjectSwitcher />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-60"
          title="Gravar public/default-project.cpud agora"
        >
          {saveState === "saved" ? (
            <Check size={14} strokeWidth={1.5} className="text-st-active" />
          ) : (
            <Save size={14} strokeWidth={1.5} />
          )}
          {saveState === "saved" ? "Salvo" : "Salvar no arquivo"}
        </button>

        <ThemeToggle />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-st-warn px-2.5 py-1 text-[11px] text-st-warn">
          <Pencil size={12} strokeWidth={1.5} />
          Edit mode
        </span>
      </div>

      {saveError && (
        <div className="absolute right-4 top-full z-50 mt-2 w-[340px] rounded-lg border border-st-error bg-surface px-3 py-2">
          <p className="text-[11px] leading-snug text-st-error">{saveError}</p>
          <button
            onClick={() => setSaveError(null)}
            className="mt-1 text-[11px] text-fg-muted underline-offset-2 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
