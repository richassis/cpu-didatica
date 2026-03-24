/**
 * CpuState.ts
 * 
 * CPU FSM states - separated to avoid circular dependencies.
 */

/**
 * FSM states for instruction execution.
 * IDLE is the default state before FETCH, used for demonstration purposes.
 */
export enum CpuState {
  IDLE = -1,      // Default demonstrative state before FETCH
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
}

/**
 * Human-readable labels for each CPU state.
 */
export const CPU_STATE_LABELS: Record<CpuState, string> = {
  [CpuState.IDLE]: "IDLE",
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
};

/**
 * All available CPU states as an array for UI iteration.
 * Note: IDLE is excluded as it's only for reset/initial state, not tick configuration.
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
];
