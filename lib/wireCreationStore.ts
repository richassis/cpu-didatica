import { create } from "zustand";
import { snapToGrid } from "@/lib/wireRouting";

const GRID_SIZE = 16;

type Direction = "input" | "output";

type Point = { x: number; y: number };

/**
 * Calculates a simple orthogonal path with at most one corner (90-degree turn).
 * The path goes: start -> corner -> end
 * The corner direction is determined by comparing distances.
 */
function calculateSingleCornerPath(start: Point, end: Point): Point[] {
  // If start and end are the same, return just the point
  if (start.x === end.x && start.y === end.y) {
    return [start];
  }

  // If already aligned horizontally or vertically, return direct line
  if (start.x === end.x || start.y === end.y) {
    return [start, end];
  }

  // Determine corner position based on which axis has larger delta
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  // Go horizontal first, then vertical (or vice versa based on distances)
  if (dx >= dy) {
    // Horizontal first, then vertical
    const corner = { x: end.x, y: start.y };
    return [start, corner, end];
  } else {
    // Vertical first, then horizontal
    const corner = { x: start.x, y: end.y };
    return [start, corner, end];
  }
}

interface WireCreationState {
  isCreating: boolean;
  sourceComponentId: string | null;
  sourcePortName: string | null;
  sourceDirection: Direction | null;
  mousePosition: { x: number; y: number } | null;
  /** Start position of the wire (snapped to grid) */
  startPosition: Point | null;
  /** Current path points: [start, corner?, end] */
  pathPoints: Point[];

  startWireCreation: (
    componentId: string,
    portName: string,
    direction: Direction,
    startPosition: Point,
  ) => void;
  updateMousePosition: (x: number, y: number) => void;
  completeWireCreation: (
    targetComponentId: string,
    targetPortName: string,
    targetDirection: Direction,
  ) => boolean;
  finishWireCreation: () => void;
  cancelWireCreation: () => void;
}

export const useWireCreationStore = create<WireCreationState>((set, get) => ({
  isCreating: false,
  sourceComponentId: null,
  sourcePortName: null,
  sourceDirection: null,
  mousePosition: null,
  startPosition: null,
  pathPoints: [],

  startWireCreation: (componentId, portName, direction, startPos) => {
    const snappedStart = {
      x: snapToGrid(startPos.x, GRID_SIZE),
      y: snapToGrid(startPos.y, GRID_SIZE),
    };

    set({
      isCreating: true,
      sourceComponentId: componentId,
      sourcePortName: portName,
      sourceDirection: direction,
      mousePosition: snappedStart,
      startPosition: snappedStart,
      pathPoints: [snappedStart],
    });
  },

  updateMousePosition: (x, y) => {
    const state = get();
    if (!state.isCreating || !state.startPosition) return;

    const snappedMouse = {
      x: snapToGrid(x, GRID_SIZE),
      y: snapToGrid(y, GRID_SIZE),
    };

    // Calculate path with single corner from start to current mouse position
    const pathPoints = calculateSingleCornerPath(state.startPosition, snappedMouse);

    set({
      mousePosition: snappedMouse,
      pathPoints,
    });
  },

  completeWireCreation: (targetComponentId, targetPortName, targetDirection) => {
    const state = get();

    if (
      !state.isCreating ||
      !state.sourceComponentId ||
      !state.sourcePortName ||
      !state.sourceDirection
    ) {
      return false;
    }

    if (state.sourceComponentId === targetComponentId && state.sourcePortName === targetPortName) {
      return false;
    }

    const isCompatibleDirection = state.sourceDirection !== targetDirection;

    if (!isCompatibleDirection) {
      return false;
    }

    set({
      isCreating: false,
      sourceComponentId: null,
      sourcePortName: null,
      sourceDirection: null,
      mousePosition: null,
      startPosition: null,
      pathPoints: [],
    });

    return true;
  },

  finishWireCreation: () => {
    set({
      isCreating: false,
      sourceComponentId: null,
      sourcePortName: null,
      sourceDirection: null,
      mousePosition: null,
      startPosition: null,
      pathPoints: [],
    });
  },

  cancelWireCreation: () => {
    set({
      isCreating: false,
      sourceComponentId: null,
      sourcePortName: null,
      sourceDirection: null,
      mousePosition: null,
      startPosition: null,
      pathPoints: [],
    });
  },
}));
