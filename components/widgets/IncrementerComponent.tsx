"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import NodeShell from "@/components/widgets/NodeShell";

/**
 * PC+1 incrementer.
 *
 * One input, one output, so it needs no constant-1 source beside it. It stays
 * the smallest block on the canvas on purpose — it is plumbing, not one of the
 * CPU's teaching blocks. The value it carries is shown on the wire, not here;
 * only the operation is.
 */
export default function IncrementerComponent({ component, zoom }: Props) {
  const revision = useSimulatorStore((s) => s.revision);
  const incrementer = useSimulatorStore((s) => s.getIncrementer(component.id));
  void revision;

  return (
    <NodeShell
      component={component}
      zoom={zoom}
      silhouette="adder"
      value={`+${incrementer?.step ?? 1}`}
    />
  );
}
