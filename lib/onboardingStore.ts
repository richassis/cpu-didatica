/**
 * onboardingStore.ts
 *
 * First-run state: whether the welcome screen has been seen, and the guided
 * tour — whether it is running and which step it is on.
 *
 * Only the "welcome seen" flag is persisted. A tour left open must not come back
 * after a reload, halfway through a step that assumed a state the reload wiped.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useExecutionStore } from "./executionStore";
import { usePlaybackStore } from "./playbackStore";
import { useMemoryPanelStore } from "./memoryPanelStore";
import { useProgramDataStore } from "./programDataStore";
import { PRESET_PROGRAMS } from "./presetPrograms";

interface OnboardingState {
  welcomeSeen: boolean;

  /** The welcome screen was asked for again (from the Help), seen or not. */
  welcomeForced: boolean;
  tourActive: boolean;
  stepIndex: number;

  openWelcome: () => void;
  dismissWelcome: () => void;
  /** Start the tour from the first step, on a clean, unmounted program. */
  startTour: () => void;
  goToStep: (index: number) => void;
  endTour: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      welcomeSeen: false,
      welcomeForced: false,
      tourActive: false,
      stepIndex: 0,

      openWelcome: () => set({ welcomeForced: true }),
      dismissWelcome: () => set({ welcomeSeen: true, welcomeForced: false }),

      startTour: () => {
        // Everyone starts from the same place: no run, no memory panel, the
        // first example loaded and not yet assembled — the tour asks the
        // student to press Montar, which has to still be pending.
        usePlaybackStore.getState().pause();
        const execution = useExecutionStore.getState();
        if (execution.isTimelineActive) execution.exitTimeline();
        useMemoryPanelStore.getState().closeMemoryPanel();
        useProgramDataStore.setState({
          assemblySource: PRESET_PROGRAMS[0].source,
          assembled: null,
          assemblyErrors: [],
          mountedSource: null,
        });
        set({ welcomeSeen: true, welcomeForced: false, tourActive: true, stepIndex: 0 });
      },

      goToStep: (index) => set({ stepIndex: index }),

      endTour: () => set({ tourActive: false, stepIndex: 0 }),
    }),
    {
      name: "simulator-onboarding",
      version: 1,
      partialize: (s) => ({ welcomeSeen: s.welcomeSeen }),
    },
  ),
);
