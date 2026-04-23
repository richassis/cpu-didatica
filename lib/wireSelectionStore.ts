import { create } from "zustand";
import type { Point } from "@/lib/wireRouting";

type SegmentOrientation = "horizontal" | "vertical";

export interface DragSegmentState {
  wireId: string;
  segmentIndex: number;
  orientation: SegmentOrientation;
  startAxisValue: number;
  initialNodes: Point[];
}

export interface DragNodeState {
  wireId: string;
  nodeIndex: number;
}

interface WireSelectionState {
  /** Currently selected wire (click) */
  selectedWireId: string | null;
  /** Currently hovered wire (mouse over) */
  hoveredWireId: string | null;
  /** Selected corner-node index within the selected wire */
  selectedNodeIndex: number | null;

  // Drag sub-state (active during routing edit)
  dragSegment: DragSegmentState | null;
  dragNode: DragNodeState | null;

  // Actions
  selectWire: (wireId: string) => void;
  deselectWire: () => void;
  setHoveredWire: (wireId: string | null) => void;
  selectNode: (wireId: string, nodeIndex: number) => void;
  deselectNode: () => void;

  startSegmentDrag: (state: DragSegmentState) => void;
  startNodeDrag: (state: DragNodeState) => void;
  endDrag: () => void;
}

export const useWireSelectionStore = create<WireSelectionState>((set) => ({
  selectedWireId: null,
  hoveredWireId: null,
  selectedNodeIndex: null,
  dragSegment: null,
  dragNode: null,

  selectWire: (wireId) =>
    set({
      selectedWireId: wireId,
      selectedNodeIndex: null,
    }),

  deselectWire: () =>
    set({
      selectedWireId: null,
      selectedNodeIndex: null,
      hoveredWireId: null,
      dragSegment: null,
      dragNode: null,
    }),

  setHoveredWire: (wireId) =>
    set({ hoveredWireId: wireId }),

  selectNode: (wireId, nodeIndex) =>
    set({
      selectedWireId: wireId,
      selectedNodeIndex: nodeIndex,
    }),

  deselectNode: () =>
    set({ selectedNodeIndex: null }),

  startSegmentDrag: (state) =>
    set({
      selectedWireId: state.wireId,
      selectedNodeIndex: null,
      dragSegment: state,
      dragNode: null,
    }),

  startNodeDrag: (state) =>
    set({
      selectedWireId: state.wireId,
      selectedNodeIndex: state.nodeIndex,
      dragNode: state,
      dragSegment: null,
    }),

  endDrag: () =>
    set({
      dragSegment: null,
      dragNode: null,
    }),
}));
