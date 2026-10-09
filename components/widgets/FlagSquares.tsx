"use client";

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
}

/**
 * The four flags in display order (Z C N V, as on the flags bus), with their
 * full names for the tooltip. One list for the control unit and the ULA.
 */
const FLAGS = [
  { key: "zero", label: "Z", title: "Zero" },
  { key: "carry", label: "C", title: "Carry (vai-um)" },
  { key: "negative", label: "N", title: "Negativo" },
  { key: "overflow", label: "V", title: "Overflow (estouro)" },
] as const;

export type FlagValues = Record<(typeof FLAGS)[number]["key"], boolean>;

/** The pills for a set of flag values, labelled and titled from `FLAGS`. */
export function flagSpecs(values: FlagValues): FlagSpec[] {
  return FLAGS.map(({ key, label, title }) => ({ label, title, on: values[key] }));
}

export default function FlagSquares({ flags }: { flags: FlagSpec[] }) {
  return (
    <div className="flex gap-1 pointer-events-none">
      {flags.map((f) => (
        <span
          key={f.label}
          title={f.title ?? f.label}
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
