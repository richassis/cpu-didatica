"use client";

/**
 * Status flags (ULA outputs, CPU flag inputs) as outlined pills.
 *
 * Outlined rather than filled: a set flag is a state worth watching, not an
 * alarm, and a filled swatch would spend a block of saturated colour on
 * something that repeats three times per component.
 */
export interface FlagSpec {
  /** Single-letter label, e.g. "Z", "C", "N". */
  label: string;
  /** Whether the flag is currently set. */
  on: boolean;
  /** Optional tooltip / full name. */
  title?: string;
}

export default function FlagSquares({ flags }: { flags: FlagSpec[] }) {
  return (
    <div className="flex gap-1 pointer-events-none">
      {flags.map((f) => (
        <span
          key={f.label}
          title={f.title ?? f.label}
          className={`rounded-md border px-1.5 font-mono text-[10px] leading-[15px] transition-colors ${
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
