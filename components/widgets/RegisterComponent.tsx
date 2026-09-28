"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatPortValue } from "@/lib/displayStore";
import { useIsUnsignedPort } from "@/lib/portKinds";
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
  // The IR holds an instruction word, which is never read as signed.
  const isUnsignedPort = useIsUnsignedPort();
  const displayValue = reg
    ? formatPortValue(reg.value, base, reg.bitWidth, isUnsignedPort(component.id, "value"))
    : "0x0000";

  return (
    <NodeShell component={component} zoom={zoom} sequential value={displayValue} />
  );
}
