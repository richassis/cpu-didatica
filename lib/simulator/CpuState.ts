/**
 * CpuState.ts
 * 
 * CPU FSM states - separated to avoid circular dependencies.
 */

/**
 * FSM states for instruction execution.
 * RESET is the initial state where control signals are set to defaults
 * and no components tick. Transitions to FETCH on first tick.
 */
export enum CpuState {
  RESET = -1,     // Initial reset state - no components tick, default signals
  FETCH = 0,
  DECODE = 1,
  EXECUTE = 2,
  READMEM = 3,
  WRITEMEM = 4,
  READREG1 = 5,
  READREG2 = 6,
  WRITEREG1 = 7,
  WRITEREG2 = 8,
  WRITEREG3 = 9,
  WRITEPC = 10,
  HALT = 11,      // Halt state - executes when HLT opcode is encountered
}

/**
 * Human-readable labels for each CPU state.
 */
export const CPU_STATE_LABELS: Record<CpuState, string> = {
  [CpuState.RESET]: "RESET",
  [CpuState.FETCH]: "FETCH",
  [CpuState.DECODE]: "DECODE",
  [CpuState.EXECUTE]: "EXECUTE",
  [CpuState.READMEM]: "READMEM",
  [CpuState.WRITEMEM]: "WRITEMEM",
  [CpuState.READREG1]: "READREG1",
  [CpuState.READREG2]: "READREG2",
  [CpuState.WRITEREG1]: "WRITEREG1",
  [CpuState.WRITEREG2]: "WRITEREG2",
  [CpuState.WRITEREG3]: "WRITEREG3",
  [CpuState.WRITEPC]: "WRITEPC",
  [CpuState.HALT]: "HALT",
};

/**
 * All available CPU states as an array for UI iteration.
 * Note: RESET is excluded as it's only for initial/reset state, not tick configuration.
 */
export const ALL_CPU_STATES: CpuState[] = [
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
  CpuState.HALT,
];
