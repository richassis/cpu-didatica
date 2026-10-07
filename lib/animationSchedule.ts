/**
 * animationSchedule.ts
 *
 * When each wire of a tick animates.
 *
 * A long wire takes longer than a short one, but not proportionally longer:
 * the dot speeds up with the wire's length (see `LENGTH_EXPONENT`), so one
 * long run doesn't drag out the whole step while the short ones wait. Substeps still run in sequence — the data-flow order the
 * per-state configuration defines — and a substep lasts as long as its longest
 * wire. Within a substep each wire lands on its own, which is what lets a
 * component react the moment its incoming wires arrive instead of waiting for
 * the slowest wire of the step.
 *
 * Pure, and in milliseconds throughout, so it can be checked without a browser.
 */

export interface ScheduledWire {
  id: string;
  /** Length of the wire's path, in canvas pixels. */
  length: number;
}

export interface WireTiming {
  id: string;
  /** When the dot leaves the source, ms from the start of the pass. */
  start: number;
  /** How long the dot takes to cross the wire. */
  duration: number;
  /** `start + duration`. */
  arrival: number;
}

export interface GroupTiming {
  order: number;
  start: number;
  /** The longest wire of the group, never less than `minStepMs`. */
  duration: number;
  wires: WireTiming[];
}

export interface Schedule {
  /** The control-signal phase, which runs first. Zero-length when nothing changed. */
  cpu: { start: number; duration: number; wires: WireTiming[] };
  groups: GroupTiming[];
  /** Length of the whole pass. */
  total: number;
}

/**
 * How a wire's crossing time grows with its length:
 * `duration = durationMs × (length / referencePx) ^ LENGTH_EXPONENT`.
 *
 * 1 would be one constant speed for every wire — a 1600 px wire then took four
 * times as long as a 400 px one and stood out. 0 would be one fixed duration,
 * where the long wires raced. At 0.5 a wire of `referencePx` still takes
 * exactly `durationMs`, a quarter of that length takes half the time and four
 * times that length twice the time: longer still means later, but the longest
 * runs move faster instead of dominating the step.
 */
export const LENGTH_EXPONENT = 0.5;

function timeWires(
  wires: ScheduledWire[],
  start: number,
  durationMs: number,
  referencePx: number,
): WireTiming[] {
  return wires.map((w) => {
    const duration =
      w.length > 0 && referencePx > 0
        ? durationMs * Math.pow(w.length / referencePx, LENGTH_EXPONENT)
        : 0;
    return { id: w.id, start, duration, arrival: start + duration };
  });
}

export function buildSchedule({
  cpuWires,
  dataGroups,
  durationMs,
  referencePx,
  minStepMs,
}: {
  cpuWires: ScheduledWire[];
  /** Substep groups in the order they run. */
  dataGroups: Array<{ order: number; wires: ScheduledWire[] }>;
  /** How long a wire of `referencePx` takes to cross (the speed slider). */
  durationMs: number;
  referencePx: number;
  /** A step of only very short wires still lasts this long, so it can be seen. */
  minStepMs: number;
}): Schedule {
  const cpuTimings = timeWires(cpuWires, 0, durationMs, referencePx);
  const cpuDuration = cpuTimings.reduce((longest, w) => Math.max(longest, w.duration), 0);

  let cursor = cpuDuration;
  const groups: GroupTiming[] = dataGroups.map(({ order, wires }) => {
    const timings = timeWires(wires, cursor, durationMs, referencePx);
    const duration = Math.max(minStepMs, timings.reduce((longest, w) => Math.max(longest, w.duration), 0));
    const group = { order, start: cursor, duration, wires: timings };
    cursor += duration;
    return group;
  });

  return { cpu: { start: 0, duration: cpuDuration, wires: cpuTimings }, groups, total: cursor };
}

/** Progress of a wire's dot, 0 to 1, at `elapsed` ms into the pass. */
export function wireProgress(wire: WireTiming, elapsed: number): number {
  if (elapsed <= wire.start) return 0;
  if (wire.duration <= 0) return 1;
  return Math.min(1, (elapsed - wire.start) / wire.duration);
}
