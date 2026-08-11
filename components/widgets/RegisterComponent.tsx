"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import NodeShell from "@/components/widgets/NodeShell";

/**
 * PC, IR, MAR, MDR and the A/B latches are all this component — they differ
 * only by label. Anatomy is a single centred slot, which is what separates a
 * register from the register bank (a table) at reading distance.
 */
export default function RegisterComponent({ component, zoom }: Props) {
  const revision = useSimulatorStore((s) => s.revision);
  const reg = useSimulatorStore((s) => s.getRegister(component.id));
  void revision;

  const base = useDisplayStore((s) => s.numericBase);
  const displayValue = reg ? formatNum(reg.value, base, reg.bitWidth) : "0x0000";

  return (
    <NodeShell component={component} zoom={zoom} sequential value={displayValue} />
  );
}
