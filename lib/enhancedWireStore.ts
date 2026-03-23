import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * A waypoint/node in a wire path that can be dragged to reshape the wire.
 */
export interface WireNode {
  id: string;
  x: number;
  y: number;
}

/**
 * Enhanced wire descriptor that supports multiple segments and bifurcation.
 */
export interface EnhancedWire {
  id: string;
  /** Source component and port */
  source: {
    componentId: string;
    portName: string;
  };
  /** Multiple targets for bifurcation */
  targets: Array<{
    componentId: string;
    portName: string;
  }>;
  /** Intermediate waypoints that define the wire path */
  nodes: WireNode[];
  /** Visual style */
  color?: string;
}

interface EnhancedWireState {
  wires: EnhancedWire[];
  selectedWireId: string | null;
  selectedNodeId: string | null;
  
  addWire: (sourceCompId: string, sourcePort: string, targetCompId: string, targetPort: string) => string;
  removeWire: (wireId: string) => void;
  addWireTarget: (wireId: string, targetCompId: string, targetPort: string) => void;
  removeWireTarget: (wireId: string, targetCompId: string, targetPort: string) => void;
  addWireNode: (wireId: string, x: number, y: number, insertIndex?: number) => string;
  updateWireNode: (wireId: string, nodeId: string, x: number, y: number) => void;
  removeWireNode: (wireId: string, nodeId: string) => void;
  selectWire: (wireId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  getWire: (wireId: string) => EnhancedWire | undefined;
  clearAll: () => void;
}

export const useEnhancedWireStore = create<EnhancedWireState>()(
  persist(
    (set, get) => ({
      wires: [],
      selectedWireId: null,
      selectedNodeId: null,

      addWire: (sourceCompId, sourcePort, targetCompId, targetPort) => {
        const wireId = `wire-${Date.now()}-${Math.random()}`;
        const wire: EnhancedWire = {
          id: wireId,
          source: {
            componentId: sourceCompId,
            portName: sourcePort,
          },
          targets: [
            {
              componentId: targetCompId,
              portName: targetPort,
            },
          ],
          nodes: [], // Empty initially - will be auto-routed
        };
        
        set((state) => ({
          wires: [...state.wires, wire],
        }));
        
        return wireId;
      },

      removeWire: (wireId) => {
        set((state) => ({
          wires: state.wires.filter((w) => w.id !== wireId),
          selectedWireId: state.selectedWireId === wireId ? null : state.selectedWireId,
        }));
      },

      addWireTarget: (wireId, targetCompId, targetPort) => {
        set((state) => ({
          wires: state.wires.map((w) =>
            w.id === wireId
              ? {
                  ...w,
                  targets: [
                    ...w.targets,
                    { componentId: targetCompId, portName: targetPort },
                  ],
                }
              : w
          ),
        }));
      },

      removeWireTarget: (wireId, targetCompId, targetPort) => {
        set((state) => ({
          wires: state.wires.map((w) =>
            w.id === wireId
              ? {
                  ...w,
                  targets: w.targets.filter(
                    (t) => !(t.componentId === targetCompId && t.portName === targetPort)
                  ),
                }
              : w
          ),
        }));
      },

      addWireNode: (wireId, x, y, insertIndex) => {
        const nodeId = `node-${Date.now()}-${Math.random()}`;
        const node: WireNode = { id: nodeId, x, y };
        
        set((state) => ({
          wires: state.wires.map((w) => {
            if (w.id !== wireId) return w;
            
            const nodes = [...w.nodes];
            if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= nodes.length) {
              nodes.splice(insertIndex, 0, node);
            } else {
              nodes.push(node);
            }
            
            return { ...w, nodes };
          }),
        }));
        
        return nodeId;
      },

      updateWireNode: (wireId, nodeId, x, y) => {
        set((state) => ({
          wires: state.wires.map((w) =>
            w.id === wireId
              ? {
                  ...w,
                  nodes: w.nodes.map((n) =>
                    n.id === nodeId ? { ...n, x, y } : n
                  ),
                }
              : w
          ),
        }));
      },

      removeWireNode: (wireId, nodeId) => {
        set((state) => ({
          wires: state.wires.map((w) =>
            w.id === wireId
              ? { ...w, nodes: w.nodes.filter((n) => n.id !== nodeId) }
              : w
          ),
          selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        }));
      },

      selectWire: (wireId) => set({ selectedWireId: wireId }),
      
      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      getWire: (wireId) => get().wires.find((w) => w.id === wireId),

      clearAll: () => set({ wires: [], selectedWireId: null, selectedNodeId: null }),
    }),
    {
      name: "enhanced-wire-storage",
      partialize: (state) => ({
        wires: state.wires,
      }),
    }
  )
);
