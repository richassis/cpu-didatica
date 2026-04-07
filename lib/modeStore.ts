/**
 * modeStore.ts
 *
 * Manages the Edit/Simulation mode state for the CPU simulator.
 *
 * EDIT MODE: Full editing capabilities
 * - Add, remove, and move components
 * - Create and delete wires
 * - Modify memory and register values
 *
 * SIMULATION MODE: Execution-focused
 * - Cannot add, remove, or move components
 * - Cannot create or delete wires
 * - Can only tick, reset, and observe
 * - Captures state snapshot when entering for reset purposes
 */

import { create } from "zustand";
import type { ComponentState } from "@/lib/store";

export type SimulatorMode = "edit" | "simulation";

/**
 * Snapshot of all object states at the moment simulation mode was entered.
 * Used for "reset to initial state" functionality.
 */
export interface SimulationSnapshot {
  /** Timestamp when snapshot was captured */
  capturedAt: string;
  /** Map of object ID → serialized state */
  objectStates: Record<string, ComponentState>;
}

interface ModeState {
  /** Current simulator mode */
  mode: SimulatorMode;

  /**
   * Snapshot captured when entering simulation mode.
   * Used by the reset button to restore initial state.
   */
  snapshot: SimulationSnapshot | null;

  // ── Actions ──────────────────────────────────────────────────

  /**
   * Enter edit mode.
   * Clears any stored snapshot since we're back to editing.
   */
  enterEditMode: () => void;

  /**
   * Enter simulation mode.
   * Captures a snapshot of current state for reset purposes.
   *
   * @param captureSnapshot Function that returns current object states (from simulatorStore)
   */
  enterSimulationMode: (captureSnapshot: () => Map<string, ComponentState>) => void;

  /**
   * Get the stored snapshot for reset purposes.
   */
  getSnapshot: () => SimulationSnapshot | null;

  /**
   * Check if we're in edit mode (convenience helper).
   */
  isEditMode: () => boolean;

  /**
   * Check if we're in simulation mode (convenience helper).
   */
  isSimulationMode: () => boolean;
}

export const useModeStore = create<ModeState>()((set, get) => ({
  mode: "edit",
  snapshot: null,

  enterEditMode: () => {
    set({
      mode: "edit",
      snapshot: null,
    });
  },

  enterSimulationMode: (captureSnapshot) => {
    // Capture current state as the reset point
    const stateMap = captureSnapshot();
    const objectStates: Record<string, ComponentState> = {};

    for (const [id, state] of stateMap) {
      objectStates[id] = state;
    }

    const snapshot: SimulationSnapshot = {
      capturedAt: new Date().toISOString(),
      objectStates,
    };

    set({
      mode: "simulation",
      snapshot,
    });
  },

  getSnapshot: () => get().snapshot,

  isEditMode: () => get().mode === "edit",

  isSimulationMode: () => get().mode === "simulation",
}));

/**
 * Hook to check if the current mode allows editing.
 * Useful for UI components to conditionally enable/disable features.
 */
export function useCanEdit(): boolean {
  return useModeStore((s) => s.mode === "edit");
}

/**
 * Hook to check if the current mode allows simulation controls.
 */
export function useCanSimulate(): boolean {
  return useModeStore((s) => s.mode === "simulation");
}
