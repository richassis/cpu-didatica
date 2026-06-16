"use client";

import { useModeStore } from "@/lib/modeStore";
import TopBarProgram from "./TopBarProgram";
import TopBarEdit from "./TopBarEdit";

/**
 * TopBar — Routes to the appropriate top bar based on the current mode.
 *
 * - Program Mode → TopBarProgram (app title, I/O controls, Run button)
 * - Edit Mode    → TopBarEdit    (back button, ProjectSwitcher, mode badge)
 */
export default function TopBar() {
  const mode = useModeStore((s) => s.mode);
  return mode === "edit" ? <TopBarEdit /> : <TopBarProgram />;
}
