/**
 * modeStore.ts
 *
 * Manages the Program/Edit mode state for the CPU simulator.
 *
 * PROGRAM MODE (default): End-user experience
 * - Read-only canvas (components cannot be moved, added, or removed)
 * - Assembly editor active
 * - Execution timeline shown after Run
 *
 * EDIT MODE: Developer/instructor experience
 * - Full editing capabilities
 * - Add, remove, and move components
 * - Create and delete wires
 * - Modify memory and register values
 */

import { create } from "zustand";
import { EDITOR_ENABLED } from "./editorFlag";
import { useMemoryPanelStore } from "./memoryPanelStore";

export type SimulatorMode = "program" | "edit";

interface ModeState {
  /** Current simulator mode */
  mode: SimulatorMode;

  // ── Actions ──────────────────────────────────────────────────

  /**
   * Enter program mode (default/end-user view).
   */
  enterProgramMode: () => void;

  /**
   * Enter edit mode (developer/instructor view).
   */
  enterEditMode: () => void;
}

export const useModeStore = create<ModeState>()((set) => ({
  mode: "program",

  enterProgramMode: () => {
    set({ mode: "program" });
  },

  enterEditMode: () => {
    // The single choke point. Builds without the editor can never reach edit
    // mode, so a stray button surviving somewhere cannot expose authoring.
    if (!EDITOR_ENABLED) return;
    // The memory side panel only exists in Program Mode's layout.
    useMemoryPanelStore.getState().closeMemoryPanel();
    set({ mode: "edit" });
  },
}));

/**
 * The one question every authoring affordance asks: may this control mutate
 * the datapath?
 *
 * Folds `EDITOR_ENABLED` into the mode check so no call site has to remember
 * the build flag. In a published build this is a compile-time `false`.
 */
export function useAuthoring(): boolean {
  const isEdit = useModeStore((s) => s.mode === "edit");
  return EDITOR_ENABLED && isEdit;
}
