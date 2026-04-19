import { create } from "zustand";
import { enforceOrthogonal, snapToGrid, type Point } from "@/lib/wireRouting";

const GRID_SIZE = 16;

type Direction = "input" | "output";

interface WireCreationState {
  isCreating: boolean;
  sourceComponentId: string | null;
  sourcePortName: string | null;
  sourceDirection: Direction | null;
  mousePosition: { x: number; y: number } | null;
  /** Start position of the wire (snapped to grid) */
  startPosition: Point | null;
  /** Committed waypoints (does not include start point) */
  waypoints: Point[];
  /** Current preview path points: [start, waypoints..., previewEnd] */
  pathPoints: Point[];

  startWireCreation: (
    componentId: string,
    portName: string,
    direction: Direction,
    startPosition: Point,
  ) => void;
  addWaypoint: (x: number, y: number) => void;
  updateMousePosition: (x: number, y: number) => void;
  completeWireCreation: (
    targetComponentId: string,
    targetPortName: string,
    targetDirection: Direction,
  ) => boolean;
  cancelWireCreation: () => void;
}

const resetCreationState = {
  isCreating: false,
  sourceComponentId: null,
  sourcePortName: null,
  sourceDirection: null,
  mousePosition: null,
  startPosition: null,
  waypoints: [],
  pathPoints: [],
};

export const useWireCreationStore = create<WireCreationState>((set, get) => ({
  ...resetCreationState,

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
      waypoints: [],
      pathPoints: [snappedStart],
    });
  },

  addWaypoint: (x, y) => {
    const state = get();
    if (!state.isCreating || !state.startPosition) return;

    const snappedPoint = {
      x: snapToGrid(x, GRID_SIZE),
      y: snapToGrid(y, GRID_SIZE),
    };

    const committedPath = enforceOrthogonal([
      state.startPosition,
      ...state.waypoints,
      snappedPoint,
    ]);

    set({
      mousePosition: snappedPoint,
      waypoints: committedPath.slice(1),
      pathPoints: committedPath,
    });
  },

  updateMousePosition: (x, y) => {
    const state = get();
    if (!state.isCreating || !state.startPosition) return;

    const snappedMouse = {
      x: snapToGrid(x, GRID_SIZE),
      y: snapToGrid(y, GRID_SIZE),
    };

    const pathPoints = enforceOrthogonal([
      state.startPosition,
      ...state.waypoints,
      snappedMouse,
    ]);

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

    set(resetCreationState);

    return true;
  },

  cancelWireCreation: () => {
    set(resetCreationState);
  },
}));
