import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { useSimulatorStore } from "@/lib/simulatorStore";

export interface ComponentInstance {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Props {
  component: ComponentInstance;
  zoom: number;
}


interface CanvasConfig {
  width: number;
  height: number;
}

interface LayoutState {
  canvasSize: CanvasConfig;
  zoom: number;
  components: ComponentInstance[];
  addComponent: (type: string, label: string, w: number, h: number) => void;
  updatePosition: (id: string, dx: number, dy: number) => void;
  updateLabel: (id: string, label: string) => void;
  removeComponent: (id: string) => void;
  clearComponents: () => void;
  setCanvasSize: (width: number, height: number) => void;
  setZoom: (zoom: number) => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      canvasSize: { width: 3000, height: 2000 },
      zoom: 1,
      components: [],

      addComponent: (type, label, w, h) =>
        set((state) => {
          const { width, height } = state.canvasSize;
          const id = uuidv4();

          // Create the backing data-layer object (if applicable)
          useSimulatorStore.getState().createObject(id, type, label);

          return {
            components: [
              ...state.components,
              {
                id,
                type,
                label,
                w,
                h,
                x: Math.floor((width - w) / 2),
                y: Math.floor((height - h) / 2),
              },
            ],
          };
        }),

      updateLabel: (id, label) =>
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id ? { ...c, label } : c
          ),
        })),

      updatePosition: (id, dx, dy) =>
        set((state) => {
          const { width, height } = state.canvasSize;
          return {
            components: state.components.map((c) =>
              c.id === id
                ? {
                    ...c,
                    x: Math.max(0, Math.min(width - c.w, c.x + dx)),
                    y: Math.max(0, Math.min(height - c.h, c.y + dy)),
                  }
                : c
            ),
          };
        }),

      removeComponent: (id) => {
        useSimulatorStore.getState().removeObject(id);
        set((state) => ({
          components: state.components.filter((c) => c.id !== id),
        }));
      },

      clearComponents: () => {
        useSimulatorStore.getState().clearObjects();
        set({ components: [] });
      },

      setCanvasSize: (width, height) =>
        set({ canvasSize: { width, height } }),

      setZoom: (zoom) =>
        set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),
    }),
    {
      name: "simulator-layout",
      onRehydrateStorage: () => (state) => {
        // After rehydrating persisted components from localStorage,
        // bootstrap the data-layer objects so UI reads work immediately.
        if (!state) return;
        const sim = useSimulatorStore.getState();
        for (const c of state.components) {
          if (!sim.objects.has(c.id)) {
            sim.createObject(c.id, c.type, c.label);
          }
        }
      },
    }
  )
);

export const ZOOM_STEP = 0.1;
export const ZOOM_MIN = MIN_ZOOM;
export const ZOOM_MAX = MAX_ZOOM;