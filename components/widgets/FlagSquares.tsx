"use client";

/**
 * FlagSquares
 *
 * A tiny row of status squares rendered on top of a component (ULA outputs,
 * CPU flag inputs). Each square lights up when its flag is true.
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
    <div className="flex gap-0.5 pointer-events-none">
      {flags.map((f) => (
        <div
          key={f.label}
          title={f.title ?? f.label}
          className={`w-5 h-5 rounded-[3px] border text-[9px] leading-[19px] text-center font-bold transition-colors ${
            f.on
              ? "bg-emerald-400 border-emerald-200 text-emerald-950 shadow-[0_0_5px_rgba(52,211,153,0.95)]"
              : "bg-gray-800 border-gray-600 text-gray-500"
          }`}
        >
          {f.label}
        </div>
      ))}
    </div>
  );
}
