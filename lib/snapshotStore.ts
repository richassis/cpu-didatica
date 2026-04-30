/**
 * snapshotStore.ts
 *
 * Manages pre-tick display snapshots so that widget components can show
 * "old" values while wire animations are in progress, then progressively
 * reveal committed values as each animation substep completes.
 *
 * This is a pure display concern — it never mutates the simulation engine.
 *
 * Design decisions:
 * - Reveal granularity is **component-level** (not per-port).
 * - Deferred display is **automatic**: active when animation is in progress,
 *   instant when animations are off (controlled by wire visibility toggles).
 * - Components with **no outgoing wires** are revealed immediately at the
 *   start of the animation — no wire means no reason to defer.
 */

import { create } from "zustand";
import type { SimulatorObject } from "@/lib/simulatorStore";
import { Register, Constant, Gpr, Ula, Adder, Mux, Memory, InstructionMemory, CPU, Decoder } from "@/lib/simulator";

// ── Types ────────────────────────────────────────────────────────────────────

/** Snapshot of a single component's display-relevant values. */
export interface ComponentSnapshot {
  /** Output port name → value at snapshot time */
  ports: Record<string, number>;
  /** For GPR: register bank values at snapshot time */
  registers?: number[];
}

interface SnapshotState {
  /** True while an animation is in progress and display should use snapshot values */
  isAnimating: boolean;

  /** Per-component: snapshot of display values captured BEFORE the tick */
  snapshots: Map<string, ComponentSnapshot>;

  /** Set of component IDs that have been "revealed" (animation reached them) */
  revealedIds: Set<string>;

  /** Monotonic counter bumped whenever reveal state changes, so React selectors re-fire */
  revealRevision: number;

  /**
   * Capture snapshots of all simulator objects before a tick runs.
   * Must be called BEFORE cpu.tick().
   *
   * @param objects  The current simulator object map
   */
  captureSnapshot: (objects: Map<string, SimulatorObject>) => void;

  /**
   * Begin the animation phase.  Sets `isAnimating = true` and immediately
   * reveals any component IDs in `immediateRevealIds` (components with no
   * outgoing wires).
   */
  startAnimation: (immediateRevealIds?: string[]) => void;

  /**
   * Mark a set of component IDs as revealed — their display values switch
   * from snapshot to committed (live) values.
   */
  revealComponents: (ids: string[]) => void;

  /**
   * End the animation: reveal everything, clear snapshots.
   */
  finishAnimation: () => void;

  /**
   * Get the snapshot value for a specific component port.
   * Returns `undefined` if no snapshot exists for this component/port.
   */
  getSnapshotPortValue: (componentId: string, portName: string) => number | undefined;

  /**
   * Get the snapshot register bank for a GPR component.
   * Returns `undefined` if no snapshot exists.
   */
  getSnapshotRegisters: (componentId: string) => number[] | undefined;

  /**
   * Convenience: should this component show snapshot (old) values?
   * Returns true when animating AND this component has NOT been revealed yet.
   */
  shouldDefer: (componentId: string) => boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isConnectable(obj: unknown): obj is { getPorts: () => Record<string, { direction: string; value: unknown }> } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "getPorts" in obj &&
    typeof (obj as { getPorts: unknown }).getPorts === "function"
  );
}

function snapshotObject(obj: SimulatorObject): ComponentSnapshot {
  const snap: ComponentSnapshot = { ports: {} };

  if (isConnectable(obj)) {
    for (const [key, port] of Object.entries(obj.getPorts())) {
      if (port.direction === "output" && typeof port.value === "number") {
        snap.ports[key] = port.value;
      }
    }
  }

  // GPR: also snapshot the register bank
  if (obj instanceof Gpr) {
    snap.registers = obj.snapshot().map((r) => r.value);
  }

  return snap;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useSnapshotStore = create<SnapshotState>()((set, get) => ({
  isAnimating: false,
  snapshots: new Map(),
  revealedIds: new Set(),
  revealRevision: 0,

  captureSnapshot: (objects) => {
    const snapshots = new Map<string, ComponentSnapshot>();
    for (const [id, obj] of objects) {
      snapshots.set(id, snapshotObject(obj));
    }
    // Reset reveal state for the new tick
    set({
      snapshots,
      revealedIds: new Set(),
      isAnimating: false,
    });
  },

  startAnimation: (immediateRevealIds) => {
    const revealedIds = new Set<string>(immediateRevealIds ?? []);
    set((s) => ({
      isAnimating: true,
      revealedIds,
      revealRevision: s.revealRevision + 1,
    }));
  },

  revealComponents: (ids) => {
    const { revealedIds } = get();
    const next = new Set(revealedIds);
    let changed = false;
    for (const id of ids) {
      if (!next.has(id)) {
        next.add(id);
        changed = true;
      }
    }
    if (changed) {
      set((s) => ({
        revealedIds: next,
        revealRevision: s.revealRevision + 1,
      }));
    }
  },

  finishAnimation: () => {
    set((s) => ({
      isAnimating: false,
      snapshots: new Map(),
      revealedIds: new Set(),
      revealRevision: s.revealRevision + 1,
    }));
  },

  getSnapshotPortValue: (componentId, portName) => {
    const snap = get().snapshots.get(componentId);
    if (!snap) return undefined;
    return snap.ports[portName];
  },

  getSnapshotRegisters: (componentId) => {
    const snap = get().snapshots.get(componentId);
    return snap?.registers;
  },

  shouldDefer: (componentId) => {
    const { isAnimating, revealedIds } = get();
    return isAnimating && !revealedIds.has(componentId);
  },
}));
