"use client";

import { ChevronLeft, Pencil } from "lucide-react";
import { useModeStore } from "@/lib/modeStore";
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

  return (
    <div className="flex min-h-[48px] items-center justify-between border-b border-line bg-surface px-4 py-2">
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
        <ThemeToggle />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-st-warn px-2.5 py-1 text-[11px] text-st-warn">
          <Pencil size={12} strokeWidth={1.5} />
          Edit mode
        </span>
      </div>
    </div>
  );
}
