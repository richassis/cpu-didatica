/**
 * portKinds.ts
 *
 * The one place that says what a port carries. Everything that treats ports
 * differently by what they mean reads it from here:
 *
 * - the port shape (`PortIndicator`): control ports get their own shape;
 * - the wire colour, its visibility toggle and its animation phase
 *   (`EnhancedBusOverlay`, `executionStore`): a wire is a control wire when
 *   its source port is;
 * - number formatting: only data is read as two's complement. On a control
 *   line, a flag, an address, an opcode or an instruction word the
 *   signed-decimal base (`decSigned`) only produces nonsense — a one-bit
 *   enable showing -1, an address showing R7 as -1, an instruction with its
 *   top bit set showing negative.
 *
 * Decided by component type and port key (the key of `getPorts()`). Keys are
 * unique within a component, so the direction is not needed.
 */

import { useMemo } from "react";
import { CONTROL_SIGNAL_DEFS, controlPortKey } from "@/lib/simulator/Cpu";
import type { WireDescriptor } from "@/lib/simulator";
import { useLayoutStore } from "@/lib/store";

export type PortKind = "control" | "flag" | "address" | "opcode" | "instruction" | "data";

type KindTable = Readonly<Record<string, PortKind>>;

const REGISTER_KINDS: KindTable = { writeEnable: "control" };

/** Every port that does not carry data, per component type. A port left out carries data. */
const PORT_KINDS: Readonly<Record<string, KindTable>> = {
  CpuComponent: {
    in_opcode: "opcode",
    in_flags: "flag",
    in_flagZeroGpr: "flag",
    in_flagNegativeGpr: "flag",
    ...Object.fromEntries(CONTROL_SIGNAL_DEFS.map((d) => [controlPortKey(d.name), "control"])),
    // The control unit's own status (hidden, never wired): every output of
    // the UC is a control line.
    out_state: "control",
    out_halted: "control",
  },
  Register: REGISTER_KINDS,
  PipelineRegister: REGISTER_KINDS,
  MemoryComponent: { addr: "address", rdMem: "control", wrMem: "control" },
  InstructionMemoryComponent: { addr: "address", out: "instruction" },
  GprComponent: {
    in_readAddrA: "address",
    in_readAddrB: "address",
    in_writeAddr: "address",
    in_writeEnable: "control",
    out_flagZero: "flag",
    out_flagNegative: "flag",
  },
  // `overflow` and the packed `flags` bus are still shown as data: marking
  // them as flags would change what the signed-decimal base shows today.
  UlaComponent: { operation: "control", zero: "flag", carry: "flag", negative: "flag" },
  AdderComponent: { carry: "flag" },
  IncrementerComponent: { carry: "flag" },
  MuxComponent: { sel: "control" },
  // `operand` (the 8-bit address/immediate field) is shown as data, as today.
  DecoderComponent: {
    instruction: "instruction",
    opcode: "opcode",
    gprAddrA: "address",
    gprAddrB: "address",
    dst: "address",
  },
};

/**
 * What the port carries.
 *
 * `isInstructionRegister` marks the IR: a plain `Register` like any other, it
 * is only recognisable by what feeds it (see `findInstructionRegisterIds`), so
 * its data ports carry an instruction word.
 */
export function portKind(
  componentType: string,
  portKey: string,
  isInstructionRegister = false,
): PortKind {
  const kind = PORT_KINDS[componentType]?.[portKey] ?? "data";
  return kind === "data" && isInstructionRegister ? "instruction" : kind;
}

/** True when the port never carries signed data. */
export function isUnsignedPort(
  componentType: string,
  portKey: string,
  isInstructionRegister = false,
): boolean {
  return portKind(componentType, portKey, isInstructionRegister) !== "data";
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

/** `portKind` bound to the current layout, for components that only know an id. */
export function usePortKind(): (componentId: string, portKey: string) => PortKind {
  const components = useLayoutStore((s) => s.components);
  const wires = useLayoutStore((s) => s.wires);
  return useMemo(() => {
    const types = new Map(components.map((c) => [c.id, c.type]));
    const instructionRegisters = findInstructionRegisterIds(components, wires);
    return (componentId, portKey) =>
      portKind(types.get(componentId) ?? "", portKey, instructionRegisters.has(componentId));
  }, [components, wires]);
}

/** `isUnsignedPort` bound to the current layout, for components that only know an id. */
export function useIsUnsignedPort(): (componentId: string, portKey: string) => boolean {
  const kindOf = usePortKind();
  return useMemo(() => (componentId, portKey) => kindOf(componentId, portKey) !== "data", [kindOf]);
}
