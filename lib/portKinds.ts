/**
 * portKinds.ts
 *
 * Which port values are *not* data, and so must never be read as two's
 * complement. The signed-decimal display (`decSigned`) is meaningful for data;
 * on a control line, a flag, an address, an opcode or an instruction word it
 * only produces nonsense — a one-bit enable showing -1, an address showing
 * R7 as -1, an instruction with its top bit set showing negative.
 *
 * Decided by component type and port key (the key of `getPorts()`), not by the
 * displayed name.
 */

import { useMemo } from "react";
import type { WireDescriptor } from "@/lib/simulator";
import { useLayoutStore } from "@/lib/store";

/** Port keys that are control, flag, address, opcode or instruction on any component. */
const UNSIGNED_PORT_KEYS = new Set([
  // control
  "sel", "operation", "rdMem", "wrMem", "writeEnable", "in_writeEnable",
  // flags
  "zero", "carry", "negative", "out_flagZero", "out_flagNegative",
  // addresses
  "addr", "in_readAddrA", "in_readAddrB", "in_writeAddr", "gprAddrA", "gprAddrB", "dst",
  // opcode and instruction word
  "opcode", "instruction",
]);

/**
 * True when the port never carries signed data.
 *
 * `isInstructionRegister` marks the IR: a plain `Register` like any other, it
 * is only recognisable by what feeds it (see `findInstructionRegisterIds`).
 */
export function isUnsignedPort(
  componentType: string,
  portKey: string,
  isInstructionRegister = false,
): boolean {
  if (componentType === "CpuComponent") return true;
  if (isInstructionRegister) return true;
  if (componentType === "InstructionMemoryComponent" && portKey === "out") return true;
  return UNSIGNED_PORT_KEYS.has(portKey);
}

/** Ids of the registers that latch an instruction — those fed by an instruction memory's output. */
export function findInstructionRegisterIds(
  components: ReadonlyArray<{ id: string; type: string }>,
  wires: ReadonlyArray<WireDescriptor>,
): Set<string> {
  const imemIds = new Set(
    components.filter((c) => c.type === "InstructionMemoryComponent").map((c) => c.id),
  );
  const registerIds = new Set(
    components.filter((c) => c.type === "Register" || c.type === "PipelineRegister").map((c) => c.id),
  );
  const ids = new Set<string>();
  for (const w of wires) {
    if (imemIds.has(w.sourceComponentId) && registerIds.has(w.targetComponentId)) {
      ids.add(w.targetComponentId);
    }
  }
  return ids;
}

/** `isUnsignedPort` bound to the current layout, for components that only know an id. */
export function useIsUnsignedPort(): (componentId: string, portKey: string) => boolean {
  const components = useLayoutStore((s) => s.components);
  const wires = useLayoutStore((s) => s.wires);
  return useMemo(() => {
    const types = new Map(components.map((c) => [c.id, c.type]));
    const instructionRegisters = findInstructionRegisterIds(components, wires);
    return (componentId, portKey) =>
      isUnsignedPort(types.get(componentId) ?? "", portKey, instructionRegisters.has(componentId));
  }, [components, wires]);
}
