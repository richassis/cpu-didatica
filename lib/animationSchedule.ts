/**
 * animationSchedule.ts
 *
 * When each wire of a tick animates.
 *
 * A dot crosses every wire at the same speed, so a long wire takes longer than
 * a short one. Substeps still run in sequence — the data-flow order the
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

function timeWires(wires: ScheduledWire[], start: number, speedPxPerMs: number): WireTiming[] {
  return wires.map((w) => {
    const duration = speedPxPerMs > 0 ? w.length / speedPxPerMs : 0;
    return { id: w.id, start, duration, arrival: start + duration };
  });
}

export function buildSchedule({
  cpuWires,
  dataGroups,
  speedPxPerMs,
  minStepMs,
}: {
  cpuWires: ScheduledWire[];
  /** Substep groups in the order they run. */
  dataGroups: Array<{ order: number; wires: ScheduledWire[] }>;
  speedPxPerMs: number;
  /** A step of only very short wires still lasts this long, so it can be seen. */
  minStepMs: number;
}): Schedule {
  const cpuTimings = timeWires(cpuWires, 0, speedPxPerMs);
  const cpuDuration = cpuTimings.reduce((longest, w) => Math.max(longest, w.duration), 0);

  let cursor = cpuDuration;
  const groups: GroupTiming[] = dataGroups.map(({ order, wires }) => {
    const timings = timeWires(wires, cursor, speedPxPerMs);
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
