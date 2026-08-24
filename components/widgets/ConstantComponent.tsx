"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import NodeShell from "@/components/widgets/NodeShell";

/** A fixed value source. Combinational, so it carries no clock notch. */
export default function ConstantComponent({ component, zoom }: Props) {
  const revision = useSimulatorStore((s) => s.revision);
  const constant = useSimulatorStore((s) => s.getConstant(component.id));
  void revision;

  const base = useDisplayStore((s) => s.numericBase);
  const bitWidth = constant?.bitWidth ?? 16;

  return (
    <NodeShell
      component={component}
      zoom={zoom}
      value={formatNum(constant?.value ?? 1, base, bitWidth)}
    />
  );
}
