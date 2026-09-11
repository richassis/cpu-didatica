import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { GRID_SIZE, snapToGrid } from "@/lib/wireRouting";
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
  /** CPU states this component should tick on (overrides defaults) */
  tickSteps?: number[];
  /** Animation substep order by CPU state (lower runs first). */
  tickOrderByState?: Partial<Record<number, number>>;
}

export interface Props {
  component: ComponentInstance;
  zoom: number;
}

/** Virtual canvas — smaller reasonable area for better navigation. */
export const CANVAS_WIDTH  = 4000;
export const CANVAS_HEIGHT = 3000;

interface LayoutState {
  zoom: number;
  components: ComponentInstance[];
  /** Serialised wire descriptors, mirrored from the active project. */
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
  /** Snapshot the current bus wires into layout state. Called by simulatorStore after every wire change. */
  saveWires: () => void;
  /** Snapshot current runtime values of all data-layer objects into each component's state field. */
  saveState: () => void;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;

/**
 * The canvas layout.
 *
 * Deliberately NOT persisted. `components`/`wires` here are a mirror of
 * `projectData[activeTabId]`, which `app/page.tsx` re-hydrates on mount and on
 * every project switch — persisting the mirror created a second source of
 * truth that raced the project load, and that race is how a stale datapath
 * survived a redeploy. `zoom` is equally pointless to keep: `fitToScreen()`
 * runs on mount and overrides whatever was stored.
 */
export const useLayoutStore = create<LayoutState>()((set) => ({
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

          const rawX = Math.max(0, Math.min(CANVAS_WIDTH  - w, Math.round(canvasLeft + (visW - w) / 2)));
          const rawY = Math.max(0, Math.min(CANVAS_HEIGHT - h, Math.round(canvasTop  + (visH - h) / 2)));
          
          // Snap to grid
          const x = snapToGrid(rawX, GRID_SIZE);
          const y = snapToGrid(rawY, GRID_SIZE);

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
                  x: snapToGrid(Math.max(0, Math.min(CANVAS_WIDTH  - c.w, c.x + dx)), GRID_SIZE),
                  y: snapToGrid(Math.max(0, Math.min(CANVAS_HEIGHT - c.h, c.y + dy)), GRID_SIZE),
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
}));

export const ZOOM_STEP = 0.05;
export const ZOOM_MIN = MIN_ZOOM;
export const ZOOM_MAX = MAX_ZOOM;