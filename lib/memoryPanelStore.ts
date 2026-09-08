/**
 * memoryPanelStore.ts
 *
 * Which memory (if any) is currently being inspected in the Program Mode side
 * panel. Inspecting a memory used to pop a modal over the canvas — you could no
 * longer see the datapath while reading the values. Now it opens where the code
 * panels are, so a student can step the clock and watch a cell change.
 *
 * One slot: opening a different memory replaces the current one.
 */

import { create } from "zustand";

interface MemoryPanelState {
  /** Component id of the memory being inspected, or null when showing code. */
  inspectedMemoryId: string | null;
  openMemoryPanel: (id: string) => void;
  closeMemoryPanel: () => void;
}

export const useMemoryPanelStore = create<MemoryPanelState>()((set) => ({
  inspectedMemoryId: null,
  openMemoryPanel: (id) => set({ inspectedMemoryId: id }),
  closeMemoryPanel: () => set({ inspectedMemoryId: null }),
}));
