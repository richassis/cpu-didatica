/**
 * displaySnapshotStore.ts — Display Latch Model
 *
 * `displayedValues` is a persistent mirror of what widgets show.
 * It is ONLY updated when an animation dot delivers data to a component.
 * It is NEVER cleared between ticks — values persist until explicitly committed.
 *
 * This solves indirect-propagation: when IR propagates to Decoder.in_instruction
 * during FETCH, Decoder's displayed value stays at its old instruction until the
 * DECODE animation dot explicitly reaches Decoder.
 */

import { create } from "zustand";
import type { SimulatorObject } from "@/lib/simulatorStore";
import { Register, Gpr } from "@/lib/simulator";
import type { WireDescriptor } from "@/lib/simulator";
import type { Point } from "@/lib/wireRouting";

interface WireRenderData {
  wire: WireDescriptor;
  path: Point[];
  isCpuControlSignal: boolean;
}

export type ComponentSnapshot = Record<string, unknown>;

interface DisplayLatchState {
  /** What widgets currently show. Only updated by animation commits. */
  displayedValues: Map<string, ComponentSnapshot>;
  /** componentId → ms at which displayedValues[id] should be updated */
  commitTimes: Map<string, number>;

  /**
   * Initialize from real simulator state (call once on mount and after reset).
   * Also called when new components are added.
   */
  initialize: (objects: Map<string, SimulatorObject>) => void;

  /**
   * Schedule commit times for this animation cycle.
   * Does NOT touch displayedValues — only sets the schedule.
   */
  startAnimation: (
    wireData: WireRenderData[],
    cpuDuration: number,
    componentDuration: number,
    sortedNonCpuGroups: string[][],
    cpuIds: string[],
    objects: Map<string, SimulatorObject>,
  ) => void;

  /**
   * Called every rAF frame. Commits elapsed entries by updating
   * displayedValues[id] from the real simulator object.
   */
  tick: (now: number, objects: Map<string, SimulatorObject>) => void;

  /**
   * Called when the rAF loop ends. Clears commit schedule only —
   * displayedValues is left intact so values persist to the next cycle.
   */
  finishAnimation: () => void;

  /**
   * Force-sync a single component's display value (for manual pokes/edits).
   */
  forceUpdate: (id: string, objects: Map<string, SimulatorObject>) => void;

  /** Full reinitialize (simulation reset). */
  reset: (objects: Map<string, SimulatorObject>) => void;
}

// ── Value extractor ────────────────────────────────────────────────────────

function snapshotObject(obj: SimulatorObject): ComponentSnapshot {
  const snap: ComponentSnapshot = {};

  if (obj instanceof Register) {
    snap["value"] = obj.value;
    return snap;
  }

  if (obj instanceof Gpr) {
    obj.snapshot().forEach(({ value }, i) => { snap[`reg_${i}`] = value; });
    snap["out_readDataA"] = obj.out_readDataA.value;
    snap["out_readDataB"] = obj.out_readDataB.value;
    return snap;
  }

  if ("getPorts" in obj && typeof (obj as { getPorts: unknown }).getPorts === "function") {
    const ports = (obj as { getPorts: () => Record<string, { value: unknown }> }).getPorts();
    for (const [k, p] of Object.entries(ports)) snap[k] = p.value;
  }
  return snap;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useDisplaySnapshotStore = create<DisplayLatchState>()((set, get) => ({
  displayedValues: new Map(),
  commitTimes: new Map(),

  initialize: (objects) => {
    const { displayedValues } = get();
    const next = new Map(displayedValues);
    for (const [id, obj] of objects) {
      if (!next.has(id)) next.set(id, snapshotObject(obj));
    }
    set({ displayedValues: next });
  },

  startAnimation: (wireData, cpuDuration, componentDuration, sortedNonCpuGroups, cpuIds, objects) => {
    const now = Date.now();
    const times = new Map<string, number>();

    for (const wId of cpuIds) {
      const wd = wireData.find(w => w.wire.id === wId);
      if (!wd) continue;
      const t = wd.wire.targetComponentId;
      times.set(t, Math.max(times.get(t) ?? 0, now + cpuDuration));
    }

    sortedNonCpuGroups.forEach((groupIds, idx) => {
      const commitTime = now + cpuDuration + (idx + 1) * componentDuration;
      for (const wId of groupIds) {
        const wd = wireData.find(w => w.wire.id === wId);
        if (!wd) continue;
        const t = wd.wire.targetComponentId;
        times.set(t, Math.max(times.get(t) ?? 0, commitTime));
      }
    });

    // Ensure any components NOT yet in displayedValues are seeded
    const { displayedValues } = get();
    const next = new Map(displayedValues);
    for (const [id, obj] of objects) {
      if (!next.has(id)) next.set(id, snapshotObject(obj));
    }

    set({ commitTimes: times, displayedValues: next });
  },

  tick: (now, objects) => {
    const { commitTimes, displayedValues } = get();
    let changed = false;
    const next = new Map(displayedValues);

    for (const [id, commitTime] of commitTimes) {
      if (now >= commitTime) {
        const obj = objects.get(id);
        if (obj) { next.set(id, snapshotObject(obj)); changed = true; }
      }
    }

    if (changed) set({ displayedValues: next });
  },

  finishAnimation: () => {
    // Clear schedule only — displayedValues persists across ticks
    set({ commitTimes: new Map() });
  },

  forceUpdate: (id, objects) => {
    const obj = objects.get(id);
    if (!obj) return;
    const { displayedValues } = get();
    const next = new Map(displayedValues);
    next.set(id, snapshotObject(obj));
    set({ displayedValues: next });
  },

  reset: (objects) => {
    const next = new Map<string, ComponentSnapshot>();
    for (const [id, obj] of objects) next.set(id, snapshotObject(obj));
    set({ displayedValues: next, commitTimes: new Map() });
  },
}));
