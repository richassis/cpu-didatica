/**
 * displayStore.ts
 *
 * Persisted global UI preferences — currently just the numeric base used to
 * display port/register values everywhere on the canvas.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NumericBase = "hex" | "dec" | "bin" | "oct";

interface DisplayState {
  numericBase: NumericBase;
  setNumericBase: (base: NumericBase) => void;
}

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set) => ({
      numericBase: "hex",
      setNumericBase: (base) => set({ numericBase: base }),
    }),
    { name: "simulator-display" }
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
