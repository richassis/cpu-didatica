/**
 * helpStore.ts
 *
 * Whether the Help window is open. The Ajuda button used to own this as local
 * state; the welcome screen and the tour open the Help too, so it lives here.
 */

import { create } from "zustand";

interface HelpState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useHelpStore = create<HelpState>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
