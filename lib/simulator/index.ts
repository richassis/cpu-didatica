/**
 * Barrel export for the simulator data layer.
 *
 * All domain classes live under lib/simulator/ and are
 * re-exported from here for convenience.
 */
export { Register } from "./Register";
export { Constant } from "./Constant";
export { Gpr } from "./Gpr";
export { Ula } from "./Ula";
export { Adder } from "./Adder";
export { Mux } from "./Mux";
export { Memory } from "./Memory";
export { InstructionMemory } from "./InstructionMemory";
export { Clock } from "./Clock";
export {
  type Clockable,
  isClockable,
} from "./Clockable";
export {
  Opcode,
  INSTRUCTION_SET,
  ISA_WORD_SIZE,
  ISA_WORD_MAX,
  type InstructionFormat,
  type InstructionDescriptor,
  type StandardDescriptor,
  type ULADescriptor,
  type DecodedInstruction,
  type DecodedStandardInstruction,
  type DecodedULAInstruction,
  opcodeToMnemonic,
  getDescriptor,
  UlaOperation,
  OPCODE_TO_ULA_OP,
} from "./ISA";
export { Encoder } from "./Encoder";
export { Decoder } from "./Decoder";
export { CPU, OPCODE_SEQUENCES, CONTROL_SIGNAL_DEFS, type ControlSignalDef } from "./Cpu";
// CpuState exported from its own module to avoid circular dependencies
export { CpuState, CPU_STATE_LABELS, ALL_CPU_STATES } from "./CpuState";
export {
  DEFAULT_TICK_STEPS,
  type StepTickable,
  createStepTickableMixin,
} from "./CpuSteps";

// ── Reactive signal bus ────────────────────────────────────────
export {
  InputPort,
  OutputPort,
  assertPortsCompatible,
  type Connectable,
  type PortMap,
  type PortDataType,
} from "./Port";
export { Wire, type WireDescriptor } from "./Wire";
export { Bus } from "./Bus";