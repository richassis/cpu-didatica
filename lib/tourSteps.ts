/**
 * tourSteps.ts
 *
 * The guided tour, step by step. A step points at an element by a CSS selector
 * (`data-tour` anchors, mostly) and says how it ends: on the student's own
 * click, or on Next. The text of each step lives in the catalog
 * (`onboarding.tour.steps`), under the step's id.
 */

import { useProgramDataStore, mountStatus } from "./programDataStore";
import { useExecutionStore } from "./executionStore";
import type { Messages } from "./i18n";

/** A step's id is its key in the catalog, so a step without text fails `tsc`. */
export type TourStepId = keyof Messages["onboarding"]["tour"]["steps"];

export interface TourStep {
  id: TourStepId;
  /** Element to light up. Without one — or when it is not on screen — the step is centred. */
  target?: string;
  /**
   * A step that waits for the student to do something: `done` says when it has
   * been done, `run` does it for them ("Do it for me"). Its hint is the step's
   * `hint` in the catalog.
   */
  action?: { done: () => boolean; run: () => void };
  /** Steps that make no sense in the current state are skipped. */
  applicable?: () => boolean;
}

const exists = (selector: string) => () => document.querySelector(selector) !== null;
const timelineActive = () => useExecutionStore.getState().isTimelineActive;

export const TOUR_STEPS: TourStep[] = [
  { id: "intro" },
  {
    id: "editor",
    target: '[data-tour="editor"]',
  },
  {
    id: "assemble",
    target: '[data-tour="montar"]',
    action: {
      done: () => useProgramDataStore.getState().mountedSource !== null,
      run: () => useProgramDataStore.getState().mountProgram(),
    },
    applicable: () => {
      const s = useProgramDataStore.getState();
      return mountStatus(s) !== "ok";
    },
  },
  {
    id: "machine",
    target: '[data-tour="machine"]',
  },
  {
    id: "simulate",
    target: '[data-tour="simular"]',
    action: {
      done: timelineActive,
      run: () => useProgramDataStore.getState().runProgram(),
    },
    applicable: () => !timelineActive(),
  },
  {
    id: "player",
    target: '[data-tour="bar"]',
  },
  {
    id: "datapath",
    target: '[data-tour="datapath"]',
  },
  {
    id: "controlUnit",
    target: '[data-node-type="CpuComponent"]',
    applicable: exists('[data-node-type="CpuComponent"]'),
  },
  {
    id: "memories",
    target: '[data-tour="imem-list"]',
    applicable: exists('[data-tour="imem-list"]'),
  },
  {
    id: "settings",
    target: '[data-tour="settings"]',
  },
  {
    id: "zoom",
    target: '[data-tour="zoom"]',
  },
  {
    id: "help",
    target: '[data-tour="help"]',
  },
];

/** The index of the next applicable step after `from`, or -1 at the end. */
export function nextApplicable(from: number): number {
  for (let i = from + 1; i < TOUR_STEPS.length; i++) {
    if (!TOUR_STEPS[i].applicable || TOUR_STEPS[i].applicable!()) return i;
  }
  return -1;
}

/** The index of the previous applicable step before `from`, or -1 at the start. */
export function previousApplicable(from: number): number {
  for (let i = from - 1; i >= 0; i--) {
    if (!TOUR_STEPS[i].applicable || TOUR_STEPS[i].applicable!()) return i;
  }
  return -1;
}
