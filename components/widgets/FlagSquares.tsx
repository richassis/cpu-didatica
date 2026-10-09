"use client";

import { useT } from "@/lib/i18n";

/**
 * Status flags (ULA outputs, CPU flag inputs) as outlined pills.
 *
 * Outlined rather than filled: a set flag is a state worth watching, not an
 * alarm, and a filled swatch would spend a block of saturated colour on
 * something that repeats four times per component (Z, C, N, V).
 */
export interface FlagSpec {
  /** Single-letter label, e.g. "Z", "C", "N", "V". */
  label: string;
  /** Whether the flag is currently set. */
  on: boolean;
  /** Optional tooltip / full name. */
  title?: string;
  /** Which status flag this is; its full name in the catalog is the tooltip. */
  flag?: FlagKey;
}

/**
 * The four flags in display order (Z C N V, as on the flags bus). Their full
 * names, for the tooltip, are in the catalog (`canvas.flags`). One list for
 * the control unit and the ULA.
 */
const FLAGS = [
  { key: "zero", label: "Z" },
  { key: "carry", label: "C" },
  { key: "negative", label: "N" },
  { key: "overflow", label: "V" },
] as const;

type FlagKey = (typeof FLAGS)[number]["key"];

export type FlagValues = Record<FlagKey, boolean>;

/** The pills for a set of flag values, labelled from `FLAGS`. */
export function flagSpecs(values: FlagValues): FlagSpec[] {
  return FLAGS.map(({ key, label }) => ({ label, flag: key, on: values[key] }));
}

export default function FlagSquares({ flags }: { flags: FlagSpec[] }) {
  const names = useT().canvas.flags;
  return (
    <div className="flex gap-1 pointer-events-none">
      {flags.map((f) => (
        <span
          key={f.label}
          title={f.flag ? names[f.flag] : (f.title ?? f.label)}
          className={`rounded-md border px-1.5 font-mono text-cv-xs leading-[15px] transition-colors ${
            f.on
              ? "border-st-warn text-st-warn"
              : "border-line text-fg-faint"
          }`}
        >
          {f.label}
        </span>
      ))}
    </div>
  );
}
