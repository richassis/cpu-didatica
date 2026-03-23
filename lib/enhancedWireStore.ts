import { create } from "zustand";
import { persist } from "zustand/middleware";
import { snapToGrid } from "@/lib/wireRouting";

const GRID_SIZE = 16;

/**
 * A waypoint/node in a wire path that can be dragged to reshape the wire.
 */
export interface WireNode {
  id: string;
  x: number;
  y: number;
}

export type WireDirection = "input" | "output";

export interface WireEndpoint {
  componentId: string;
  portName: string;
  direction: WireDirection;
}

/**
 * Enhanced wire descriptor that supports multiple segments and bifurcation.
 */
export interface EnhancedWire {
  id: string;
  /** Wire start endpoint (can be input or output while drawing). */
  start: WireEndpoint;
  /** Wire end endpoint (null when dangling/unattached). */
  end: WireEndpoint | null;
  /** Free endpoint when not attached to a second port. */
  floatingEnd: { x: number; y: number } | null;
  /** Intermediate waypoints that define the wire path */
  nodes: WireNode[];
  /** Visual style */
  color?: string;
}

interface EnhancedWireState {
  wires: EnhancedWire[];
  selectedWireId: string | null;
  selectedNodeId: string | null;

  createWire: (params: {
    start: WireEndpoint;
    nodes?: Array<{ x: number; y: number }>;
    floatingEnd?: { x: number; y: number } | null;
    end?: WireEndpoint | null;
  }) => string;
  attachWireEnd: (wireId: string, end: WireEndpoint) => void;
  setFloatingEnd: (wireId: string, x: number, y: number) => void;
  setWireNodes: (wireId: string, nodes: Array<{ x: number; y: number }>) => void;
  removeWire: (wireId: string) => void;
  addWireNode: (wireId: string, x: number, y: number, insertIndex?: number) => string;
  updateWireNode: (wireId: string, nodeId: string, x: number, y: number) => void;
  removeWireNode: (wireId: string, nodeId: string) => void;
  selectWire: (wireId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  getWire: (wireId: string) => EnhancedWire | undefined;
  getNodePosition: (wireId: string, nodeId: string) => { x: number; y: number } | null;
  clearAll: () => void;
}

export const useEnhancedWireStore = create<EnhancedWireState>()(
  persist(
    (set, get) => ({
      wires: [],
      selectedWireId: null,
      selectedNodeId: null,

      createWire: ({ start, nodes = [], floatingEnd = null, end = null }) => {
        const wireId = `wire-${Date.now()}-${Math.random()}`;
        const wire: EnhancedWire = {
          id: wireId,
          start,
          end,
          floatingEnd,
          nodes: nodes.map((node) => ({
            id: `node-${Date.now()}-${Math.random()}`,
            x: snapToGrid(node.x, GRID_SIZE),
            y: snapToGrid(node.y, GRID_SIZE),
          })),
        };

        set((state) => ({
          wires: [...state.wires, wire],
        }));

        return wireId;
      },

      attachWireEnd: (wireId, end) => {
        set((state) => ({
          wires: state.wires.map((wire) =>
            wire.id === wireId
              ? {
                  ...wire,
                  end,
                  floatingEnd: null,
                }
              : wire
          ),
        }));
      },

      setFloatingEnd: (wireId, x, y) => {
        set((state) => ({
          wires: state.wires.map((wire) =>
            wire.id === wireId
              ? {
                  ...wire,
                  end: null,
                  floatingEnd: {
                    x: snapToGrid(x, GRID_SIZE),
                    y: snapToGrid(y, GRID_SIZE),
                  },
                }
              : wire
          ),
        }));
      },

      setWireNodes: (wireId, nodes) => {
        set((state) => ({
          wires: state.wires.map((wire) =>
            wire.id === wireId
              ? {
                  ...wire,
                  nodes: nodes.map((node) => ({
                    id: `node-${Date.now()}-${Math.random()}`,
                    x: snapToGrid(node.x, GRID_SIZE),
                    y: snapToGrid(node.y, GRID_SIZE),
                  })),
                }
              : wire
          ),
        }));
      },

      removeWire: (wireId) => {
        set((state) => ({
          wires: state.wires.filter((w) => w.id !== wireId),
          selectedWireId: state.selectedWireId === wireId ? null : state.selectedWireId,
        }));
      },

      addWireNode: (wireId, x, y, insertIndex) => {
        const nodeId = `node-${Date.now()}-${Math.random()}`;
        const node: WireNode = {
          id: nodeId,
          x: snapToGrid(x, GRID_SIZE),
          y: snapToGrid(y, GRID_SIZE),
        };
        
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
                    n.id === nodeId
                      ? {
                          ...n,
                          x: snapToGrid(x, GRID_SIZE),
                          y: snapToGrid(y, GRID_SIZE),
                        }
                      : n
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

      getNodePosition: (wireId, nodeId) => {
        const wire = get().wires.find((w) => w.id === wireId);
        if (!wire) return null;
        
        const node = wire.nodes.find((n) => n.id === nodeId);
        return node ? { x: node.x, y: node.y } : null;
      },

      clearAll: () => set({ wires: [], selectedWireId: null, selectedNodeId: null }),
    }),
    {
      name: "enhanced-wire-storage",
      version: 2,
      migrate: (persistedState: unknown) => {
        const state = persistedState as { wires?: Array<Record<string, unknown>> } | undefined;
        const wires = state?.wires ?? [];

        const migratedWires: EnhancedWire[] = [];

        for (const maybeWire of wires) {
          if (maybeWire && "start" in maybeWire) {
            migratedWires.push(maybeWire as EnhancedWire);
            continue;
          }

          const oldWire = maybeWire as {
            id?: string;
            source?: { componentId?: string; portName?: string };
            targets?: Array<{ componentId?: string; portName?: string }>;
            nodes?: Array<{ id?: string; x?: number; y?: number }>;
            color?: string;
          };

          if (!oldWire.source?.componentId || !oldWire.source.portName) {
            continue;
          }

          const sharedNodes = (oldWire.nodes ?? [])
            .filter((node) => typeof node.x === "number" && typeof node.y === "number")
            .map((node) => ({
              id: node.id ?? `node-${Date.now()}-${Math.random()}`,
              x: snapToGrid(node.x as number, GRID_SIZE),
              y: snapToGrid(node.y as number, GRID_SIZE),
            }));

          const targets = oldWire.targets ?? [];

          if (targets.length === 0) {
            migratedWires.push({
              id: oldWire.id ?? `wire-${Date.now()}-${Math.random()}`,
              start: {
                componentId: oldWire.source.componentId,
                portName: oldWire.source.portName,
                direction: "output",
              },
              end: null,
              floatingEnd: null,
              nodes: sharedNodes,
              color: oldWire.color,
            });
            continue;
          }

          targets.forEach((target, index) => {
            if (!target.componentId || !target.portName) return;

            migratedWires.push({
              id:
                index === 0
                  ? oldWire.id ?? `wire-${Date.now()}-${Math.random()}`
                  : `wire-${Date.now()}-${Math.random()}`,
              start: {
                componentId: oldWire.source!.componentId!,
                portName: oldWire.source!.portName!,
                direction: "output",
              },
              end: {
                componentId: target.componentId,
                portName: target.portName,
                direction: "input",
              },
              floatingEnd: null,
              nodes: sharedNodes,
              color: oldWire.color,
            });
          });
        }

        return {
          wires: migratedWires,
          selectedWireId: null,
          selectedNodeId: null,
        };
      },
      partialize: (state) => ({
        wires: state.wires,
      }),
    }
  )
);
