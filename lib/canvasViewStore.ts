/**
 * canvasViewStore.ts
 *
 * The read-only canvas's view controls, published for the top bar.
 *
 * Zoom is implemented inside `SimulatorCanvas` — it needs the scroll container
 * to re-centre — but in Program Mode the buttons live in the top bar, outside
 * that component. The canvas registers its handlers here while mounted and the
 * bar calls them; the zoom level itself is already in the layout store.
 */

import { create } from "zustand";

interface CanvasViewState {
  zoomIn: (() => void) | null;
  zoomOut: (() => void) | null;
  fit: (() => void) | null;
  register: (handlers: { zoomIn: () => void; zoomOut: () => void; fit: () => void } | null) => void;
}

export const useCanvasViewStore = create<CanvasViewState>((set) => ({
  zoomIn: null,
  zoomOut: null,
  fit: null,
  register: (handlers) =>
    set({
      zoomIn: handlers?.zoomIn ?? null,
      zoomOut: handlers?.zoomOut ?? null,
      fit: handlers?.fit ?? null,
    }),
}));
