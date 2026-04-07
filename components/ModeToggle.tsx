"use client";

import { Pencil, Play } from "lucide-react";
import { useModeStore, type SimulatorMode } from "@/lib/modeStore";
import { useSimulatorStore } from "@/lib/simulatorStore";

/**
 * ModeToggle - Switch between Edit and Simulation modes
 *
 * Edit Mode: Full editing capabilities (add/move/delete components and wires)
 * Simulation Mode: Execution-focused (tick, reset, observe only)
 *
 * When entering Simulation Mode, captures a snapshot of the current state
 * that can be restored with the Reset button.
 */
export default function ModeToggle() {
  const mode = useModeStore((s) => s.mode);
  const enterEditMode = useModeStore((s) => s.enterEditMode);
  const enterSimulationMode = useModeStore((s) => s.enterSimulationMode);
  const serializeObjects = useSimulatorStore((s) => s.serializeObjects);

  const handleModeChange = (newMode: SimulatorMode) => {
    if (newMode === mode) return;

    if (newMode === "simulation") {
      // Capture snapshot when entering simulation mode
      enterSimulationMode(serializeObjects);
    } else {
      enterEditMode();
    }
  };

  return (
    <div className="flex items-center bg-gray-800 border border-gray-600 rounded-lg p-0.5">
      {/* Edit Mode Button */}
      <button
        onClick={() => handleModeChange("edit")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          mode === "edit"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-gray-400 hover:text-white hover:bg-gray-700"
        }`}
        title="Edit Mode - Add, move, and configure components"
      >
        <Pencil className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Edit</span>
      </button>

      {/* Simulation Mode Button */}
      <button
        onClick={() => handleModeChange("simulation")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          mode === "simulation"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-gray-400 hover:text-white hover:bg-gray-700"
        }`}
        title="Simulation Mode - Execute and observe"
      >
        <Play className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Simulate</span>
      </button>
    </div>
  );
}
