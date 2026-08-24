/**
 * displayStore.ts
 *
 * Persisted global UI preferences — numeric base, wire visibility,
 * and animation speed settings used across the canvas.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NumericBase = "hex" | "dec" | "bin" | "oct";

/**
 * Animation speed, in milliseconds per substep.
 *
 * This used to be three named presets at 2000/4000/5000 ms. Since one tick costs
 * `(control signals changed ? D : 0) + D × substeps`, a three-substep FETCH ran
 * for about sixteen seconds at "normal" — fine for staring at a single tick,
 * impossible for watching a program run. The range is now continuous and starts
 * far lower.
 */
export const ANIMATION_MIN_MS = 50;
export const ANIMATION_MAX_MS = 3000;
export const ANIMATION_DEFAULT_MS = 400;

/**
 * At the bottom of the range the flow animation is skipped entirely and values
 * snap — a slider position rather than a separate switch, so "as fast as
 * possible" is where the student already expects to find it.
 */
export const ANIMATION_INSTANT_MS = ANIMATION_MIN_MS;

export function isInstantSpeed(durationMs: number): boolean {
  return durationMs <= ANIMATION_INSTANT_MS;
}

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

  /** Whether numeric port values are shown (port tooltips, hover readouts) */
  showPortValues: boolean;
  setShowPortValues: (show: boolean) => void;

  /**
   * Milliseconds per animated substep. One duration, used for both the control
   * phase and the data phase — which is what the overlay always did in
   * practice; the separate `cpuAnimationDuration` was written but never read.
   */
  animationDurationMs: number;
  setAnimationDurationMs: (ms: number) => void;
}

/**
 * Whether the OS asks for reduced motion.
 *
 * Only consulted for the *initial* value: zustand rehydrates the persisted
 * state afterwards, so a choice the student already made always wins over the
 * system preference. Guarded for SSR, where there is no matchMedia.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

      showPortValues: true,
      setShowPortValues: (show) => set({ showPortValues: show }),

      animationDurationMs: prefersReducedMotion() ? ANIMATION_INSTANT_MS : ANIMATION_DEFAULT_MS,
      setAnimationDurationMs: (ms) =>
        set({
          animationDurationMs: Math.min(ANIMATION_MAX_MS, Math.max(ANIMATION_MIN_MS, Math.round(ms))),
        }),
    }),
    {
      name: "simulator-display",
      version: 5,
      migrate: (persistedState) => {
        const state = persistedState as Partial<DisplayState> & {
          animationSpeed?: "fast" | "normal" | "slow";
        };

        // v4 stored a preset name plus two derived durations. The presets were
        // an order of magnitude too slow to watch a program run, so they are
        // remapped rather than carried over literally.
        const fromPreset = { fast: 200, normal: 400, slow: 900 } as const;

        return {
          ...state,
          showWireDots: state.showWireDots ?? true,
          animationEnabled: state.animationEnabled ?? true,
          animateCpuSignals: state.animateCpuSignals ?? true,
          animateDataSignals: state.animateDataSignals ?? true,
          showPortValues: state.showPortValues ?? true,
          animationDurationMs:
            state.animationDurationMs ?? fromPreset[state.animationSpeed ?? "normal"],
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
