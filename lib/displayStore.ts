/**
 * displayStore.ts
 *
 * Persisted global UI preferences — numeric base, wire visibility,
 * and animation speed settings used across the canvas.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NumericBase = "hex" | "dec" | "bin" | "oct";

export type AnimationSpeedPreset = "fast" | "normal" | "slow";

/** Preset durations in ms: [cpuAnimationDuration, componentAnimationDuration] */
export const ANIMATION_PRESETS: Record<AnimationSpeedPreset, { cpu: number; component: number }> = {
  fast:   { cpu: 2000,  component: 2000 },
  normal: { cpu: 4000, component: 4000 },
  slow:   { cpu: 5000, component: 5000 },
};

interface DisplayState {
  numericBase: NumericBase;
  setNumericBase: (base: NumericBase) => void;
  
  /** Whether wires and ports are visible */
  showWiresAndPorts: boolean;
  setShowWiresAndPorts: (show: boolean) => void;
  
  /** Whether CPU control signal wires are visible */
  showCpuSignalWires: boolean;
  setShowCpuSignalWires: (show: boolean) => void;
  
  /** Whether data signal wires are visible */
  showDataSignalWires: boolean;
  setShowDataSignalWires: (show: boolean) => void;

  /** Whether animated value dots are shown travelling along / resting at wires */
  showWireDots: boolean;
  setShowWireDots: (show: boolean) => void;

  /** Whether wire flow animation plays at all (false = values snap instantly) */
  animationEnabled: boolean;
  setAnimationEnabled: (enabled: boolean) => void;

  /** Whether CPU control signal wires that changed animate (flow dots) */
  animateCpuSignals: boolean;
  setAnimateCpuSignals: (animate: boolean) => void;

  /** Whether data signal wires animate substep-by-substep */
  animateDataSignals: boolean;
  setAnimateDataSignals: (animate: boolean) => void;

  /** Animation speed preset */
  animationSpeed: AnimationSpeedPreset;
  setAnimationSpeed: (preset: AnimationSpeedPreset) => void;
  
  /** Derived animation durations (in ms) based on preset */
  cpuAnimationDuration: number;
  componentAnimationDuration: number;
}

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set) => ({
      numericBase: "hex",
      setNumericBase: (base) => set({ numericBase: base }),
      
      showWiresAndPorts: true,
      setShowWiresAndPorts: (show) => set({ showWiresAndPorts: show }),
      
      showCpuSignalWires: true,
      setShowCpuSignalWires: (show) => set({ showCpuSignalWires: show }),
      
      showDataSignalWires: true,
      setShowDataSignalWires: (show) => set({ showDataSignalWires: show }),

      showWireDots: true,
      setShowWireDots: (show) => set({ showWireDots: show }),

      animationEnabled: true,
      setAnimationEnabled: (enabled) => set({ animationEnabled: enabled }),

      animateCpuSignals: true,
      setAnimateCpuSignals: (animate) => set({ animateCpuSignals: animate }),

      animateDataSignals: true,
      setAnimateDataSignals: (animate) => set({ animateDataSignals: animate }),

      animationSpeed: "normal",
      cpuAnimationDuration: ANIMATION_PRESETS.normal.cpu,
      componentAnimationDuration: ANIMATION_PRESETS.normal.component,
      setAnimationSpeed: (preset) => set({
        animationSpeed: preset,
        cpuAnimationDuration: ANIMATION_PRESETS[preset].cpu,
        componentAnimationDuration: ANIMATION_PRESETS[preset].component,
      }),
    }),
    {
      name: "simulator-display",
      version: 4,
      migrate: (persistedState) => {
        const state = persistedState as Partial<DisplayState>;
        const preset = state.animationSpeed ?? "normal";

        return {
          ...state,
          showWireDots: state.showWireDots ?? true,
          animationEnabled: state.animationEnabled ?? true,
          animateCpuSignals: state.animateCpuSignals ?? true,
          animateDataSignals: state.animateDataSignals ?? true,
          cpuAnimationDuration: ANIMATION_PRESETS[preset].cpu,
          componentAnimationDuration: ANIMATION_PRESETS[preset].component,
        };
      },
    }
  )
);

/**
 * Format a numeric value according to the selected numeric base.
 * `bitWidth` is used to zero-pad hex/bin/oct output.
 */
export function formatNum(value: number, base: NumericBase, bitWidth = 16): string {
  const n = Math.floor(value) >>> 0; // treat as unsigned
  switch (base) {
    case "hex": {
      const digits = Math.ceil(bitWidth / 4);
      return "0x" + n.toString(16).toUpperCase().padStart(digits, "0");
    }
    case "bin": {
      return "0b" + n.toString(2).padStart(bitWidth, "0");
    }
    case "oct": {
      const digits = Math.ceil(bitWidth / 3);
      return "0o" + n.toString(8).padStart(digits, "0");
    }
    case "dec":
    default:
      return String(n);
  }
}
