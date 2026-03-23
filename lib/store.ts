import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { useSimulatorStore } from "@/lib/simulatorStore";
import type { WireDescriptor } from "@/lib/simulator";

/**
 * Plain-JSON snapshot of a single component's runtime state.
 * Port values keyed by port map key, plus type-specific bulk data.
 */
export interface ComponentState {
  /** Port map key → current port value */
  ports: Record<string, number>;
  /** GPR register bank values (GprComponent only) */
  registers?: number[];
  /** Memory cell values (MemoryComponent only) */
  cells?: number[];
}

/** Plain-JSON snapshot that can be written to / read from a file. */
export interface ProjectSnapshot {
  version: 1;
  zoom: number;
  components: ComponentInstance[];
  wires: WireDescriptor[];
}

export interface ComponentInstance {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional per-type metadata (e.g. bitWidth for Register, numInputs for Mux) */
  meta?: Record<string, unknown>;
  /** Persisted runtime state — port values, register bank, memory cells. */
  state?: ComponentState;
}

export interface Props {
  component: ComponentInstance;
  zoom: number;
}

/** Virtual canvas is effectively infinite — much larger than any screen. */
export const CANVAS_WIDTH  = 20000;
export const CANVAS_HEIGHT = 20000;

interface LayoutState {
  zoom: number;
  components: ComponentInstance[];
  /** Serialised wire descriptors — persisted alongside components. */
  wires: WireDescriptor[];
  /**
   * Current scroll offset of the canvas scroll container (in CSS px).
   * Updated by SimulatorCanvas so addComponent can place new items in view.
   */
  viewportScroll: { left: number; top: number };
  /** Viewport dimensions (clientWidth / clientHeight of the scroll container). */
  viewportSize: { width: number; height: number };
  setViewport: (scroll: { left: number; top: number }, size: { width: number; height: number }) => void;
  addComponent: (type: string, label: string, w: number, h: number, meta?: Record<string, unknown>) => void;
  updatePosition: (id: string, dx: number, dy: number) => void;
  updateLabel: (id: string, label: string) => void;
  updateMeta: (id: string, meta: Record<string, unknown>) => void;
  removeComponent: (id: string) => void;
  clearComponents: () => void;
  setZoom: (zoom: number) => void;
  /** Snapshot the current bus wires into persisted state. Called by simulatorStore after every wire change. */
  saveWires: () => void;
  /** Snapshot current runtime values of all data-layer objects into each component's state field. */
  saveState: () => void;
  /** Serialise the entire project to a JSON blob and trigger a browser download. */
  saveProject: () => void;
  /** Replace the entire project with data loaded from a ProjectSnapshot. */
  loadProject: (snapshot: ProjectSnapshot) => void;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      zoom: 1,
      components: [],
      wires: [],
      viewportScroll: { left: CANVAS_WIDTH * 0.5, top: CANVAS_HEIGHT * 0.5 },
      viewportSize: { width: 800, height: 600 },

      setViewport: (scroll, size) => set({ viewportScroll: scroll, viewportSize: size }),

      addComponent: (type, label, w, h, meta) =>
        set((state) => {
          const id = uuidv4();

          // Create the backing data-layer object (if applicable)
          useSimulatorStore.getState().createObject(id, type, label, meta);

          // Place new component at centre of the current visible viewport
          const { viewportScroll, viewportSize, zoom } = state;
          const canvasLeft = viewportScroll.left / zoom;
          const canvasTop  = viewportScroll.top  / zoom;
          const visW = viewportSize.width  / zoom;
          const visH = viewportSize.height / zoom;

          const x = Math.max(0, Math.min(CANVAS_WIDTH  - w, Math.round(canvasLeft + (visW - w) / 2)));
          const y = Math.max(0, Math.min(CANVAS_HEIGHT - h, Math.round(canvasTop  + (visH - h) / 2)));

          return {
            components: [...state.components, { id, type, label, w, h, x, y, ...(meta ? { meta } : {}) }],
          };
        }),

      updateLabel: (id, label) =>
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id ? { ...c, label } : c
          ),
        })),

      updateMeta: (id, meta) =>
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id ? { ...c, meta: { ...c.meta, ...meta } } : c
          ),
        })),

      updatePosition: (id, dx, dy) =>
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id
              ? {
                  ...c,
                  x: Math.max(0, Math.min(CANVAS_WIDTH  - c.w, c.x + dx)),
                  y: Math.max(0, Math.min(CANVAS_HEIGHT - c.h, c.y + dy)),
                }
              : c
          ),
        })),

      removeComponent: (id) => {
        useSimulatorStore.getState().removeObject(id);
        set((state) => ({
          components: state.components.filter((c) => c.id !== id),
        }));
      },

      clearComponents: () => {
        useSimulatorStore.getState().clearObjects();
        set({ components: [], wires: [] });
      },

      setZoom: (zoom) =>
        set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),

      saveWires: () => {
        const wires = useSimulatorStore.getState().getWires();
        set({ wires });
      },

      saveState: () => {
        const stateMap = useSimulatorStore.getState().serializeObjects();
        set((s) => ({
          components: s.components.map((c) =>
            stateMap.has(c.id) ? { ...c, state: stateMap.get(c.id) } : c
          ),
        }));
      },

      saveProject: () => {
        // Capture latest runtime values before serialising
        const stateMap = useSimulatorStore.getState().serializeObjects();
        const wires    = useSimulatorStore.getState().getWires();
        const { zoom, components } = useLayoutStore.getState();
        const enriched = components.map((c) =>
          stateMap.has(c.id) ? { ...c, state: stateMap.get(c.id) } : c
        );
        const snapshot: ProjectSnapshot = { version: 1, zoom, components: enriched, wires };
        const json = JSON.stringify(snapshot, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = `cpu-project-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },

      loadProject: (snapshot) => {
        const sim = useSimulatorStore.getState();
        // Tear down current state
        sim.clearObjects();
        // Recreate all components
        for (const c of snapshot.components) {
          sim.createObject(c.id, c.type, c.label, c.meta);
        }
        // Restore wires
        if (snapshot.wires.length > 0) {
          sim.restoreWires(snapshot.wires);
        }
        // Restore runtime values (port values, register banks, memory cells)
        const stateEntries = snapshot.components
          .filter((c) => c.state)
          .map((c) => [c.id, c.state!] as const);
        if (stateEntries.length > 0) {
          sim.applyObjectStates(new Map(stateEntries));
        }
        // Replace layout state (also updates localStorage via persist middleware)
        set({
          zoom: snapshot.zoom,
          components: snapshot.components,
          wires: snapshot.wires,
        });
      },
    }),
    {
      name: "simulator-layout",
      // Don't persist transient viewport state
      partialize: (state) => ({
        zoom: state.zoom,
        components: state.components,
        wires: state.wires,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydrating persisted components from localStorage,
        // bootstrap the data-layer objects so UI reads work immediately.
        if (!state) return;
        const sim = useSimulatorStore.getState();
        for (const c of state.components) {
          if (!sim.objects.has(c.id)) {
            sim.createObject(c.id, c.type, c.label, c.meta);
          }
        }
        // Restore wire connections after all components are registered.
        if (state.wires.length > 0) {
          sim.restoreWires(state.wires);
        }
        // Restore runtime values (port values, register banks, memory cells)
        const stateEntries = state.components
          .filter((c) => c.state)
          .map((c) => [c.id, c.state!] as const);
        if (stateEntries.length > 0) {
          sim.applyObjectStates(new Map(stateEntries));
        }
      },
    }
  )
);

export const ZOOM_STEP = 0.05;
export const ZOOM_MIN = MIN_ZOOM;
export const ZOOM_MAX = MAX_ZOOM;