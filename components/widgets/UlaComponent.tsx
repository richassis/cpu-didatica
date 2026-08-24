"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import { UlaOperation } from "@/lib/simulator/ISA";
import NodeShell from "@/components/widgets/NodeShell";
import FlagSquares from "@/components/widgets/FlagSquares";

function opSymbol(op: number): string {
  switch (op) {
    case UlaOperation.ADD: return "+";
    case UlaOperation.SUB: return "−";
    case UlaOperation.AND: return "&";
    case UlaOperation.OR:  return "|";
    case UlaOperation.NOT: return "~";
    default: return "?";
  }
}

/**
 * The ALU keeps its trapezoid — it is the signature shape of the screen and
 * the canonical form in architecture diagrams — but as a 1px outline with an
 * interior glow, never as a solid block of colour.
 *
 * Anatomy reads as an equation: two stacked operands, the operation between
 * them, the result under a hairline, flags along the bottom.
 */
export default function UlaComponent({ component, zoom }: Props) {
  const revision = useSimulatorStore((s) => s.revision);
  const ula = useSimulatorStore((s) => s.getUla(component.id));
  void revision;

  const base = useDisplayStore((s) => s.numericBase);
  const op = ula?.operation ?? UlaOperation.ADD;
  const bw = ula?.bitWidth ?? 16;

  return (
    <NodeShell component={component} zoom={zoom} silhouette="alu">
      <div className="flex flex-1 flex-col items-center justify-center gap-0.5 px-4">
        <span className="t-value-sm text-fg-muted">
          {formatNum(ula?.in_a?.value ?? 0, base, bw)}
        </span>

        <span className="font-mono text-[15px] leading-none text-fg">{opSymbol(op)}</span>

        {op !== UlaOperation.NOT && (
          <span className="t-value-sm text-fg-muted">
            {formatNum(ula?.in_b?.value ?? 0, base, bw)}
          </span>
        )}

        <div className="mt-1 w-full border-t border-line pt-1 text-center">
          <span className="node-value t-value">{formatNum(ula?.result ?? 0, base, bw)}</span>
        </div>

        <div className="mt-1">
          <FlagSquares
            flags={[
              { label: "Z", on: ula?.zero ?? false, title: "Zero" },
              { label: "C", on: ula?.carry ?? false, title: "Carry" },
              { label: "N", on: ula?.negative ?? false, title: "Negative" },
            ]}
          />
        </div>
      </div>
    </NodeShell>
  );
}
