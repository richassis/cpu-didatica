/**
 * displayStore.ts
 *
 * Persisted global UI preferences — numeric base, wire visibility,
 * and animation speed settings used across the canvas.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TEXT_SIZE, applyTextSizeAttribute, type TextSize } from "./textSize";

export type { TextSize };

export type NumericBase = "hex" | "dec" | "decSigned" | "bin";

/**
 * Animation speed `D`: how long a dot takes to cross a wire of
 * `ANIMATION_REFERENCE_PX`. A tick lasts its control phase plus each substep,
 * each as long as its longest wire, and a wire takes `D × (length / 400)^0.5`
 * (see `animationSchedule.ts`).
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
 * length. The wires themselves vary from about a hundred pixels to well over a
 * thousand; every other wire's time is scaled from this one, growing with the
 * square root of its length (`LENGTH_EXPONENT` in `animationSchedule.ts`).
 */
export const ANIMATION_REFERENCE_PX = 400;

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

  /**
   * The animation speed `D` (see `ANIMATION_MIN_MS`), one value for both the
   * control phase and the data phase.
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

      textSize: DEFAULT_TEXT_SIZE,
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
      // Each step runs only for state saved before the version that introduced
      // it, so a later version bump does not replay them on current state.
      migrate: (persistedState, version) => {
        const state = { ...(persistedState as Partial<DisplayState>) };

        // v6 removed the wire-dot, animation and port-value switches (they are
        // now always on), so their stored values are dropped.
        if (version < 6) {
          for (const key of [
            "showWireDots",
            "animationEnabled",
            "animateCpuSignals",
            "animateDataSignals",
            "showPortValues",
          ]) {
            delete (state as Record<string, unknown>)[key];
          }
        }

        // v7: octal is no longer a base at all, so a stored "oct" (or anything
        // else unknown) falls back to hex. Checked at every version: a base
        // the app does not offer would leave no button pressed.
        const offeredBases: readonly string[] = ["hex", "dec", "decSigned", "bin"];
        const storedBase = state.numericBase as string | undefined;
        state.numericBase =
          storedBase && offeredBases.includes(storedBase) ? (storedBase as NumericBase) : "hex";

        // v8 moved the whole speed scale toward the slow end. A stored value
        // from the old scale would land far too fast on the new one, so it
        // is replaced by the new default — except the "instant" a
        // reduced-motion preference chose.
        if (version < 8) {
          state.animationDurationMs =
            typeof state.animationDurationMs === "number" &&
            state.animationDurationMs <= ANIMATION_INSTANT_MS
              ? state.animationDurationMs
              : ANIMATION_DEFAULT_MS;
        }

        // v9 added the text size and v10 moved its scale down a step: what
        // was "normal" is now "medium", and the two larger sizes are "large".
        // State from before v9 has none and gets the default, which is also
        // what the inline script in app/layout.tsx painted it with.
        if (version < 10) {
          const stored = state.textSize as string | undefined;
          state.textSize =
            stored === undefined
              ? DEFAULT_TEXT_SIZE
              : stored === "small" || stored === "medium" || stored === "large"
                ? stored
                : stored === "xlarge"
                  ? "large"
                  : "medium";
        }

        return state;
      },
    }
  )
);

// <html> carries the text size (see `textSize.ts`). Applied once for the state
// hydrated while the store was created, then on every change after.
if (typeof window !== "undefined") {
  applyTextSizeAttribute(useDisplayStore.getState().textSize);
  useDisplayStore.subscribe((state, prev) => {
    if (state.textSize !== prev.textSize) applyTextSizeAttribute(state.textSize);
  });
}

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
 * `bitWidth` is used to zero-pad hex/bin output.
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
