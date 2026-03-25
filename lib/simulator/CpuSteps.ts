/**
 * CpuSteps.ts
 * 
 * Centralized definitions for CPU execution steps/states.
 * Each component can be configured to tick on specific steps.
 */

import { CpuState, ALL_CPU_STATES } from "./CpuState";

// Re-export for convenience
export { CpuState, CPU_STATE_LABELS, ALL_CPU_STATES } from "./CpuState";

/**
 * Default tick steps for each component type.
 * These define when a component should be ticked during CPU execution.
 * 
 * A component ticks when the CPU enters any of the listed states.
 */
export const DEFAULT_TICK_STEPS: Record<string, CpuState[]> = {
  // Registers tick on states where they might latch data
  Register: [
    CpuState.FETCH,    // IR latches instruction
    CpuState.DECODE,   // PC increments
    CpuState.WRITEPC,  // PC updated on jumps
  ],

  // GPR ticks on read and write operations
  GprComponent: [
    CpuState.READREG1,
    CpuState.READREG2,
    CpuState.WRITEREG1,
    CpuState.WRITEREG2,
    CpuState.WRITEREG3,
  ],

  // Memory ticks on read and write operations
  MemoryComponent: [
    CpuState.FETCH,    // Instruction fetch
    CpuState.READMEM,  // Data read
    CpuState.WRITEMEM, // Data write
  ],

  // Instruction memory ticks only on instruction fetch
  InstructionMemoryComponent: [
    CpuState.FETCH,    // Instruction fetch
  ],

  // Main memory ticks only on data read/write (not instruction fetch)
  MainMemoryComponent: [
    CpuState.READMEM,  // Data read
    CpuState.WRITEMEM, // Data write
  ],

  // ULA ticks during execute phase
  UlaComponent: [
    CpuState.EXECUTE,
  ],

  // Adder ticks on fetch (PC+1) and execute
  AdderComponent: [
    CpuState.FETCH,
    CpuState.EXECUTE,
  ],

  // Mux is combinational, ticks whenever its inputs might change
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

  // Decoder ticks on decode phase
  DecoderComponent: [
    CpuState.DECODE,
  ],

  // CPU always ticks (it controls everything)
  CpuComponent: ALL_CPU_STATES,
};

/**
 * Interface for components that support step-based ticking.
 */
export interface StepTickable {
  /** The steps on which this component should tick. */
  tickSteps: CpuState[];
  
  /** Set the tick steps for this component. */
  setTickSteps(steps: CpuState[]): void;
  
  /** Check if this component should tick on the given state. */
  shouldTickOnState(state: CpuState): boolean;
}

/**
 * Mixin implementation for StepTickable.
 * Components can use this as a base for implementing StepTickable.
 */
export function createStepTickableMixin(defaultSteps: CpuState[]): {
  tickSteps: CpuState[];
  setTickSteps: (steps: CpuState[]) => void;
  shouldTickOnState: (state: CpuState) => boolean;
} {
  let tickSteps = [...defaultSteps];
  
  return {
    get tickSteps() {
      return tickSteps;
    },
    set tickSteps(steps: CpuState[]) {
      tickSteps = steps;
    },
    setTickSteps(steps: CpuState[]) {
      tickSteps = steps;
    },
    shouldTickOnState(state: CpuState) {
      return tickSteps.includes(state);
    },
  };
}
