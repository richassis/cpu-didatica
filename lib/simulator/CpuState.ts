/**
 * CpuState.ts
 * 
 * CPU FSM states - separated to avoid circular dependencies.
 */

/**
 * FSM states for instruction execution.
 * RESET is never a state the FSM sits in: `CPU.reset()` uses it to put every
 * control signal back at rest and then leaves the CPU in FETCH. It also
 * serves as the "nothing executed yet" value of `previousState`. HALT and
 * invalid opcodes stay in HALT until the next reset.
 */
export enum CpuState {
  RESET = -1,     // Control signals at rest; see above
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
  HALT = 11,
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
 * The states a component can be configured to animate on, for UI iteration.
 * RESET and HALT are excluded: RESET is never executed as a tick, and HALT
 * only stops the control unit — no other component does anything in it.
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
