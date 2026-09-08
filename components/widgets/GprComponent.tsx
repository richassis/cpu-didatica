"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum, type NumericBase } from "@/lib/displayStore";
import NodeShell from "@/components/widgets/NodeShell";

/**
 * The register bank.
 *
 * Its anatomy is a table — that is what separates it from a plain register at
 * reading distance, and why neither needs a colour of its own. The row being
 * read or written is marked with a low-alpha data tint plus a letter tag, so
 * which port touched it survives greyscale.
 *
 * Read-only: the register values follow the simulation. Editing them by hand
 * would desync the timeline snapshots, so there is no edit affordance.
 */
export default function GprComponent({ component, zoom }: Props) {
  const { id } = component;

  const revision = useSimulatorStore((s) => s.revision);
  const gpr = useSimulatorStore((s) => s.getGpr(id));
  const base = useDisplayStore((s) => s.numericBase);
  void revision;

  const regs = gpr ? gpr.snapshot() : [];
  const bitWidth = gpr?.bitWidth ?? 16;
  const readAddrA = gpr?.in_readAddrA?.value ?? 0;
  const readAddrB = gpr?.in_readAddrB?.value ?? 0;
  const writeAddr = gpr?.in_writeAddr?.value ?? 0;
  const wrEnable = (gpr?.in_writeEnable?.value ?? 0) !== 0;

  // The bank holds eight values but only one is interesting at a time, so the
  // headline is whichever register this tick touches — that is the part that
  // has to survive to mid zoom, where the table does not.
  const focusAddr = wrEnable ? writeAddr : readAddrA;
  const focusValue = regs[focusAddr]?.value ?? 0;

  return (
    <NodeShell
      component={component}
      zoom={zoom}
      sequential
      value={`R${focusAddr} ${formatNum(focusValue, base, bitWidth)}`}
      compactValue
    >
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-px px-1.5 py-1">
          {regs.map(({ value }, i) => {
            const isWriteTarget = wrEnable && i === writeAddr;
            const tag = isWriteTarget
              ? "W"
              : i === readAddrA && i === readAddrB
                ? "AB"
                : i === readAddrA
                  ? "A"
                  : i === readAddrB
                    ? "B"
                    : null;

            return (
              <GprRow
                key={i}
                index={i}
                value={value}
                bitWidth={bitWidth}
                base={base}
                tag={tag}
              />
            );
          })}
        </div>
      </div>
    </NodeShell>
  );
}

interface GprRowProps {
  index: number;
  value: number;
  bitWidth: number;
  base: NumericBase;
  tag: string | null;
}

function GprRow({ index, value, bitWidth, base, tag }: GprRowProps) {
  const displayed = formatNum(value, base, bitWidth);

  return (
    <div
      className="flex items-center gap-1.5 rounded px-1.5 py-[3px] transition-colors"
      style={tag ? { background: "color-mix(in srgb, var(--st-data) 8%, transparent)" } : undefined}
    >
      <span className="w-5 shrink-0 font-mono text-[12.5px] text-fg-faint">R{index}</span>
      <span className={`num flex-1 text-right font-mono text-[12.5px] ${tag ? "text-fg" : "text-fg-muted"}`}>
        {displayed}
      </span>
      {tag && <span className="w-4 shrink-0 font-mono text-[9px] text-fg-faint">{tag}</span>}
    </div>
  );
}
