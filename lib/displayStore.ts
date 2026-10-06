/**
 * displayStore.ts
 *
 * Persisted global UI preferences — numeric base, wire visibility,
 * and animation speed settings used across the canvas.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** "Tamanho do texto": a factor on the root font size (see `--fs` in globals.css). */
export type TextSize = "small" | "medium" | "large";
export const TEXT_SIZE_SCALE: Record<TextSize, number> = { small: 0.875, medium: 1, large: 1.15 };

export type NumericBase = "hex" | "dec" | "decSigned" | "bin" | "oct";

/**
 * Animation speed, in milliseconds per substep.
 *
 * This used to be three named presets at 2000/4000/5000 ms. Since one tick costs
 * `(control signals changed ? D : 0) + D × substeps`, a three-substep FETCH ran
 * for about sixteen seconds at "normal" — fine for staring at a single tick,
 * impossible for watching a program run. The range is now continuous and starts
 * far lower.
 */
export const ANIMATION_MIN_MS = 1200;
export const ANIMATION_MAX_MS = 6000;
export const ANIMATION_DEFAULT_MS = 2000;

/**
 * At or below this the flow animation is skipped entirely and values snap. The
 * slider no longer reaches it — the fast end used to be so fast the dots could
 * not be followed — but the store still starts there under a reduced-motion
 * preference, and `isInstantSpeed` honours it.
 */
export const ANIMATION_INSTANT_MS = 50;

/**
 * The slider's value is a time — how long a dot takes to cross a wire of this
 * length — and the speed follows from it. The wires themselves vary from about
 * a hundred pixels to well over a thousand; timing them by a fixed duration
 * made the long ones race, so every wire now gets the same speed instead.
 */
export const ANIMATION_REFERENCE_PX = 400;

/** Dot speed, in canvas pixels per millisecond, for a stored duration. */
export function animationSpeedPxPerMs(durationMs: number): number {
  return ANIMATION_REFERENCE_PX / Math.max(1, durationMs);
}

export function isInstantSpeed(durationMs: number): boolean {
  return durationMs <= ANIMATION_INSTANT_MS;
}

interface DisplayState {
  /** Interface-wide text size. */
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;

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

      textSize: "small",
      setTextSize: (size) => set({ textSize: size }),

      animationDurationMs: prefersReducedMotion() ? ANIMATION_INSTANT_MS : ANIMATION_DEFAULT_MS,
      setAnimationDurationMs: (ms) =>
        set({
          animationDurationMs: Math.min(ANIMATION_MAX_MS, Math.max(ANIMATION_MIN_MS, Math.round(ms))),
        }),
    }),
    {
      name: "simulator-display",
      version: 10,
      migrate: (persistedState) => {
        const state = persistedState as Partial<DisplayState>;

        // v7: a base the settings no longer offer (octal) would leave the
        // student on a display with no button to leave it.
        const offeredBases: NumericBase[] = ["hex", "dec", "decSigned", "bin"];
        const numericBase =
          state.numericBase && offeredBases.includes(state.numericBase) ? state.numericBase : "hex";

        return {
          ...state,
          numericBase,
          // v9 added the text size and v10 moved its scale down a step: what
          // was "normal" is now "medium", and the two larger sizes are "large".
          textSize: ((): TextSize => {
            const stored = state.textSize as string | undefined;
            if (stored === "small" || stored === "medium" || stored === "large") return stored;
            return stored === "xlarge" ? "large" : "medium";
          })(),
          // v6 removed these switches from the settings panel, so a value a
          // student switched off earlier can no longer be switched back on.
          showWireDots: true,
          animationEnabled: true,
          animateCpuSignals: true,
          animateDataSignals: true,
          showPortValues: true,
          // v8 moved the whole speed scale toward the slow end. A stored value
          // from the old scale would land far too fast on the new one, so it
          // is replaced by the new default — except the "instant" a
          // reduced-motion preference chose.
          animationDurationMs:
            typeof state.animationDurationMs === "number" &&
            state.animationDurationMs <= ANIMATION_INSTANT_MS
              ? state.animationDurationMs
              : ANIMATION_DEFAULT_MS,
        };
      },
    }
  )
);

/**
 * `formatNum` for a port value. `unsigned` marks values that are not data —
 * control lines, flags, addresses, opcodes, instruction words (see
 * `isUnsignedPort`) — which the signed-decimal base shows as plain decimal.
 */
export function formatPortValue(
  value: number,
  base: NumericBase,
  bitWidth: number | undefined,
  unsigned: boolean,
): string {
  return formatNum(value, unsigned && base === "decSigned" ? "dec" : base, bitWidth);
}

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
    case "decSigned": {
      // Two's-complement interpretation of the same bits `dec` shows unsigned.
      // `2 ** bitWidth` rather than `1 << bitWidth`, so this stays correct
      // even at bitWidth 32 (where `<<` wraps to 0 in JS).
      const half = 2 ** (bitWidth - 1);
      return String(n >= half ? n - 2 ** bitWidth : n);
    }
    case "dec":
    default:
      return String(n);
  }
}
