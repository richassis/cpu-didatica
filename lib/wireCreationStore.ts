import { create } from "zustand";

interface WireCreationState {
  isCreating: boolean;
  sourceComponentId: string | null;
  sourcePortName: string | null;
  sourceDirection: "input" | "output" | null;
  mousePosition: { x: number; y: number } | null;
  
  startWireCreation: (componentId: string, portName: string, direction: "input" | "output") => void;
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

  startWireCreation: (componentId, portName, direction) => {
    set({
      isCreating: true,
      sourceComponentId: componentId,
      sourcePortName: portName,
      sourceDirection: direction,
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
    
    // Validate: source must be output, target must be input
    if (state.sourceDirection === "output" && targetDirection === "input") {
      set({
        isCreating: false,
        sourceComponentId: null,
        sourcePortName: null,
        sourceDirection: null,
        mousePosition: null,
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
    });
  },
}));
