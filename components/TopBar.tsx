"use client";

import { Save, Play, Square, RotateCcw } from "lucide-react";
import ProjectSwitcher from "./ProjectSwitcher";
import ModeToggle from "./ModeToggle";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useProjectStore } from "@/lib/projectStore";
import { saveProjectToFile } from "@/lib/projectStore";
import { useModeStore } from "@/lib/modeStore";

/**
 * TopBar - Unified top bar for the simulator
 * 
 * Contains:
 * - Project switcher dropdown
 * - Mode toggle (Edit/Simulation)
 * - Save button
 * - Clock controls (tick, reset)
 */
export default function TopBar() {
  const { activeTabId, exportProject, markSaved } = useProjectStore();
  const { tickClock, resetClock, getPrimaryCpu, serializeObjects, applyObjectStates } = useSimulatorStore();
  const { mode, getSnapshot } = useModeStore();

  // Get total ticks from primary CPU
  const cpu = getPrimaryCpu();
  const totalTicks = cpu?.totalTicks || 0;
  const isHalted = cpu?.halted || false;

  // Handle save
  const handleSave = () => {
    if (!activeTabId) return;
    
    const project = exportProject(activeTabId);
    if (project) {
      saveProjectToFile(project);
      markSaved(activeTabId);
    }
  };

  /**
   * Handle reset based on current mode:
   * - Edit mode: Full reset (clear all state)
   * - Simulation mode: Reset to captured snapshot
   */
  const handleReset = () => {
    if (mode === "simulation") {
      // Reset to snapshot captured when entering simulation mode
      const snapshot = getSnapshot();
      if (snapshot) {
        const stateMap = new Map(Object.entries(snapshot.objectStates));
        applyObjectStates(stateMap);
        // Also reset the CPU state machine
        resetClock();
      }
    } else {
      // Full reset in edit mode
      resetClock();
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
      {/* Left: Project Switcher */}
      <div className="flex items-center gap-4">
        <ProjectSwitcher />
      </div>

      {/* Center: Mode Toggle */}
      <div className="flex items-center gap-2">
        <ModeToggle />
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!activeTabId}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save project to file"
        >
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">Save</span>
        </button>

        {/* Clock Controls */}
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded px-3 py-1.5">
          {/* Tick Counter */}
          <span className="text-xs font-mono text-gray-400 min-w-[4rem] text-center">
            T{totalTicks}
          </span>

          {/* Tick Button */}
          <button
            onClick={tickClock}
            disabled={isHalted}
            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Advance clock by one tick"
          >
            <Play className="w-3.5 h-3.5" />
          </button>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
            title={mode === "simulation" ? "Reset to initial state" : "Reset simulation"}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Halted Indicator */}
          {isHalted && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <Square className="w-3 h-3" />
              <span>Halted</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
