"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { UlaOperation } from "@/lib/simulator/ISA";
import NodeShell from "@/components/widgets/NodeShell";
import FlagSquares from "@/components/widgets/FlagSquares";

function opName(op: number): string {
  switch (op) {
    case UlaOperation.ADD: return "ADD";
    case UlaOperation.SUB: return "SUB";
    case UlaOperation.AND: return "AND";
    case UlaOperation.OR:  return "OR";
    case UlaOperation.NOT: return "NOT";
    default: return "?";
  }
}

/**
 * The ALU keeps its trapezoid — it is the signature shape of the screen and
 * the canonical form in architecture diagrams — but as a 1px outline with an
 * interior glow, never as a solid block of colour.
 *
 * Inside, only the operation it is set to and the flags. The operands and the
 * result are already on the wires and in A, B and R — writing the sum out
 * again here only cluttered it.
 */
export default function UlaComponent({ component, zoom }: Props) {
  const revision = useSimulatorStore((s) => s.revision);
  const ula = useSimulatorStore((s) => s.getUla(component.id));
  // The ULA's own flags: what its last operation produced, cleared until the
  // first one. LDA/LDAI change the control unit's Z/N but never these. The CPU
  // owns that latch, so read it there rather than from the ULA's live
  // combinational outputs (which follow whatever opULA is driving now).
  const cpu = useSimulatorStore((s) => s.getPrimaryCpu());
  void revision;

  const op = ula?.operation ?? UlaOperation.ADD;

  return (
    <NodeShell component={component} zoom={zoom} silhouette="alu">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
        <span className="node-value t-value">{opName(op)}</span>

        <div>
          <FlagSquares
            flags={[
              { label: "Z", on: cpu?.ulaFlags.zero ?? false, title: "Zero" },
              { label: "C", on: cpu?.ulaFlags.carry ?? false, title: "Carry" },
              { label: "N", on: cpu?.ulaFlags.negative ?? false, title: "Negative" },
              { label: "V", on: cpu?.ulaFlags.overflow ?? false, title: "Overflow" },
            ]}
          />
        </div>
      </div>
    </NodeShell>
  );
}
