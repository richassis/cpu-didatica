import { create } from "zustand";

interface WireCreationState {
  isCreating: boolean;
  sourceComponentId: string | null;
  sourcePortName: string | null;
  sourceDirection: "input" | "output" | null;
  mousePosition: { x: number; y: number } | null;
  // For bifurcation from existing wire nodes
  sourceWireId: string | null;
  sourceNodeId: string | null;
  
  startWireCreation: (componentId: string, portName: string, direction: "input" | "output") => void;
  startWireCreationFromNode: (wireId: string, nodeId: string) => void;
  updateMousePosition: (x: number, y: number) => void;
  completeWireCreation: (targetComponentId: string, targetPortName: string, targetDirection: "input" | "output") => boolean;
  cancelWireCreation: () => void;
}

export const useWireCreationStore = create<WireCreationState>((set, get) => ({
  isCreating: false,
  sourceComponentId: null,
  sourcePortName: null,
  sourceDirection: null,
  mousePosition: null,
  sourceWireId: null,
  sourceNodeId: null,

  startWireCreation: (componentId, portName, direction) => {
    set({
      isCreating: true,
      sourceComponentId: componentId,
      sourcePortName: portName,
      sourceDirection: direction,
      sourceWireId: null,
      sourceNodeId: null,
    });
  },

  startWireCreationFromNode: (wireId, nodeId) => {
    set({
      isCreating: true,
      sourceComponentId: null,
      sourcePortName: null,
      sourceDirection: "output", // Treat node as output
      sourceWireId: wireId,
      sourceNodeId: nodeId,
    });
  },

  updateMousePosition: (x, y) => {
    const state = get();
    if (state.isCreating) {
      set({ mousePosition: { x, y } });
    }
  },

  completeWireCreation: (targetComponentId, targetPortName, targetDirection) => {
    const state = get();
    
    // Validate: source must be output (or node), target must be input
    if ((state.sourceDirection === "output" || state.sourceWireId) && targetDirection === "input") {
      set({
        isCreating: false,
        sourceComponentId: null,
        sourcePortName: null,
        sourceDirection: null,
        mousePosition: null,
        sourceWireId: null,
        sourceNodeId: null,
      });
      return true;
    }
    
    // Invalid connection - cancel
    set({
      isCreating: false,
      sourceComponentId: null,
      sourcePortName: null,
      sourceDirection: null,
      mousePosition: null,
      sourceWireId: null,
      sourceNodeId: null,
    });
    return false;
  },

  cancelWireCreation: () => {
    set({
      isCreating: false,
      sourceComponentId: null,
      sourcePortName: null,
      sourceDirection: null,
      mousePosition: null,
      sourceWireId: null,
      sourceNodeId: null,
    });
  },
}));
