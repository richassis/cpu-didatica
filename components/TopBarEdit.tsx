"use client";

import { useModeStore } from "@/lib/modeStore";
import ProjectSwitcher from "./ProjectSwitcher";
import ThemeToggle from "./ThemeToggle";

/**
 * TopBarEdit — Top bar shown in Edit Mode (developer/instructor view).
 *
 * Left:  [← Program Mode] button + ProjectSwitcher
 * Right: "Edit Mode" badge
 */
export default function TopBarEdit() {
  const enterProgramMode = useModeStore((s) => s.enterProgramMode);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 min-h-[48px]">
      {/* Left: Back button + Project Switcher */}
      <div className="flex items-center gap-3">
        <button
          onClick={enterProgramMode}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
          title="Voltar para o Program Mode"
        >
          <ChevronLeftIcon />
          Program Mode
        </button>

        <div className="w-px h-5 bg-gray-700" />

        <ProjectSwitcher />
      </div>

      {/* Right: theme switch + Edit Mode badge */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-600/50 bg-indigo-900/30 px-2.5 py-1 text-[11px] font-semibold text-indigo-200">
          <PencilIcon />
          Edit Mode
        </span>
      </div>
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
