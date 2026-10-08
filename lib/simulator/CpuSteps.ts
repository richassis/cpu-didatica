/**
 * CpuSteps.ts
 *
 * Default animation steps per component type.
 */

import { CpuState } from "./CpuState";

/**
 * Default tick steps for each component type, used when a component has no
 * `tickSteps` of its own in the project file.
 *
 * These are animation metadata only: they say in which CPU states the
 * timeline shows a component (and the wires leaving it) as active. They do
 * not gate execution — every registered component evaluates and commits on
 * every CPU tick (see `CPU.registerComponent`).
 */
export const DEFAULT_TICK_STEPS: Record<string, CpuState[]> = {
  // Registers animate on the states where they latch or feed data
  Register: [
    CpuState.FETCH,    // IR latches the instruction, PC latches PC+1
    CpuState.DECODE,   // IR feeds the decoder
    CpuState.WRITEPC,  // PC updated on jumps
  ],

  // Pipeline registers (A, B) latch GPR outputs only during READREG states
  PipelineRegister: [
    CpuState.READREG1,
    CpuState.READREG2,
  ],

  // GPR is active on read and write operations
  GprComponent: [
    CpuState.READREG1,
    CpuState.READREG2,
    CpuState.WRITEREG1,
    CpuState.WRITEREG2,
    CpuState.WRITEREG3,
  ],

  // Data memory is active on read and write operations
  MemoryComponent: [
    CpuState.READMEM,  // Data read
    CpuState.WRITEMEM, // Data write
  ],

  InstructionMemoryComponent: [
    CpuState.FETCH,    // Instruction fetch
  ],

  // ULA is active during the execute phase
  UlaComponent: [
    CpuState.EXECUTE,
  ],

  // Standalone adder (not in the default datapath; PC+1 is the Incrementer)
  AdderComponent: [
    CpuState.FETCH,
  ],

  // The PC+1 incrementer is relevant during fetch
  IncrementerComponent: [
    CpuState.FETCH,
  ],

  // Constant sources are relevant in datapaths like PC+1 during fetch
  ConstantComponent: [
    CpuState.FETCH,
  ],

  // Mux is combinational, active whenever its inputs might change
  MuxComponent: [
    CpuState.FETCH,
    CpuState.DECODE,
    CpuState.EXECUTE,
    CpuState.READMEM,
    CpuState.WRITEMEM,
    CpuState.READREG1,
    CpuState.READREG2,
    CpuState.WRITEREG1,
    CpuState.WRITEREG2,
    CpuState.WRITEREG3,
    CpuState.WRITEPC,
  ],

  // Decoder is active in the decode phase
  DecoderComponent: [
    CpuState.DECODE,
  ],
};
