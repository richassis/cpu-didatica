"use client";

import ProjectSwitcher from "./ProjectSwitcher";
import ModeToggle from "./ModeToggle";

/**
 * TopBar - Slim top bar for the simulator
 * 
 * Contains:
 * - Project switcher dropdown (includes save/import/export)
 * - Mode toggle (Edit/Simulation)
 */
export default function TopBar() {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
      {/* Left: Project Switcher */}
      <div className="flex items-center gap-4">
        <ProjectSwitcher />
      </div>

      {/* Right: Mode Toggle */}
      <div className="flex items-center gap-2">
        <ModeToggle />
      </div>
    </div>
  );
}

