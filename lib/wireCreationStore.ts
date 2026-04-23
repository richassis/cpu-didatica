import { create } from "zustand";
import { autoRoute, snapToGrid, type Point, type AABB } from "@/lib/wireRouting";
import type { PortSide } from "@/lib/portPositioning";

const GRID_SIZE = 16;

type Direction = "input" | "output";

export interface DragSource {
  componentId: string;
  portName: string;
  direction: Direction;
  position: Point;
  portSide: PortSide;
}

export interface HoveredPort {
  componentId: string;
  portName: string;
  direction: Direction;
  position: Point;
  portSide: PortSide;
}

export interface DragResult {
  sourceComponentId: string;
  sourcePortName: string;
  targetComponentId: string;
  targetPortName: string;
  /** Auto-routed path nodes (excluding start/end port positions) for persistence. */
  nodes: Point[];
}

interface WireCreationState {
  /** idle = nothing happening, dragging = user is dragging from a port */
  phase: "idle" | "dragging";

  // Source info (set on drag start)
  sourceComponentId: string | null;
  sourcePortName: string | null;
  sourceDirection: Direction | null;
  sourcePosition: Point | null;
  sourcePortSide: PortSide | null;

  // Live preview
  mousePosition: Point | null;
  /** Complete auto-routed preview path from source to cursor/target. */
  previewPath: Point[];

  /** Component AABBs to avoid during routing (set once on drag start). */
  obstacles: AABB[];

  // Target highlight
  hoveredTargetPort: HoveredPort | null;

  // Actions
  startDrag: (source: DragSource, obstacles: AABB[]) => void;
  updateDrag: (mousePos: Point, hoveredPort?: HoveredPort | null) => void;
  completeDrag: () => DragResult | null;
  cancelDrag: () => void;
}

const resetState = {
  phase: "idle" as const,
  sourceComponentId: null,
  sourcePortName: null,
  sourceDirection: null,
  sourcePosition: null,
  sourcePortSide: null,
  mousePosition: null,
  previewPath: [],
  obstacles: [],
  hoveredTargetPort: null,
};

export const useWireCreationStore = create<WireCreationState>((set, get) => ({
  ...resetState,

  startDrag: (source, obstacles) => {
    set({
      phase: "dragging",
      sourceComponentId: source.componentId,
      sourcePortName: source.portName,
      sourceDirection: source.direction,
      sourcePosition: source.position,
      sourcePortSide: source.portSide,
      obstacles,
      mousePosition: source.position,
      previewPath: [source.position],
      hoveredTargetPort: null,
    });
  },

  updateDrag: (mousePos, hoveredPort) => {
    const state = get();
    if (state.phase !== "dragging" || !state.sourcePosition || !state.sourcePortSide) return;

    const snappedMouse = {
      x: snapToGrid(mousePos.x, GRID_SIZE),
      y: snapToGrid(mousePos.y, GRID_SIZE),
    };

    // If hovering over a compatible target port, snap the preview to it
    const targetPos = hoveredPort ? hoveredPort.position : snappedMouse;
    const targetSide: PortSide = hoveredPort
      ? hoveredPort.portSide
      // When no target port is hovered, guess a reasonable entry side
      // based on relative position to source.
      : guessTargetSide(state.sourcePosition, snappedMouse, state.sourcePortSide);

    const previewPath = autoRoute(
      state.sourcePosition,
      state.sourcePortSide,
      targetPos,
      targetSide,
      state.obstacles,
    );

    set({
      mousePosition: snappedMouse,
      previewPath,
      hoveredTargetPort: hoveredPort ?? null,
    });
  },

  completeDrag: () => {
    const state = get();
    if (state.phase !== "dragging") return null;
    if (
      !state.sourceComponentId ||
      !state.sourcePortName ||
      !state.sourceDirection ||
      !state.hoveredTargetPort
    ) {
      // No valid target — cancel
      set(resetState);
      return null;
    }

    const target = state.hoveredTargetPort;

    // Validate compatibility
    if (state.sourceComponentId === target.componentId && state.sourcePortName === target.portName) {
      set(resetState);
      return null;
    }
    if (state.sourceDirection === target.direction) {
      set(resetState);
      return null;
    }

    // Normalize direction: source must be output, target must be input
    const isReversed = state.sourceDirection === "input";
    const sourceId = isReversed ? target.componentId : state.sourceComponentId;
    const sourcePort = isReversed ? target.portName : state.sourcePortName;
    const targetId = isReversed ? state.sourceComponentId : target.componentId;
    const targetPort = isReversed ? state.sourcePortName : target.portName;

    // Extract persisted nodes from the preview path.
    // Path shape is: [source, sourceEscape, ...mid, targetEscape, target].
    // Persist only the middle custom points (exclude both escape points).
    const routedNodes = state.previewPath.length > 4
      ? state.previewPath.slice(2, -2)
      : [];

    const nodes = isReversed ? [...routedNodes].reverse() : routedNodes;

    const result: DragResult = {
      sourceComponentId: sourceId,
      sourcePortName: sourcePort,
      targetComponentId: targetId,
      targetPortName: targetPort,
      nodes,
    };

    set(resetState);
    return result;
  },

  cancelDrag: () => {
    set(resetState);
  },
}));

/**
 * When no target port is hovered, guess a reasonable entry side
 * for the preview endpoint based on direction from source.
 */
function guessTargetSide(source: Point, target: Point, sourceSide: PortSide): PortSide {
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  // Opposite of dominant direction from source
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "left" : "right";
  }
  return dy > 0 ? "top" : "bottom";
}
