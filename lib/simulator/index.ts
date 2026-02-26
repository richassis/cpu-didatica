/**
 * Barrel export for the simulator data layer.
 *
 * All domain classes live under lib/simulator/ and are
 * re-exported from here for convenience.
 */
export { Register } from "./Register";
export { Gpr } from "./Gpr";
export { Ula, type UlaOperation } from "./Ula";
export { Clock } from "./Clock";
export {
  type ClockStep,
  type Clockable,
  CLOCK_STEP_ORDER,
  isClockable,
} from "./Clockable";
