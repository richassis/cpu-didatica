import type { Messages } from "../index";
import { common } from "./common";

export const bar: Messages["bar"] = {
  topBar: {
    appName: "CPU Didática",
    lines: (n: number) => `${n} ${n === 1 ? "line" : "lines"}`,
    openTitle: "Open a text file with assembly code",
    saveTitle: "Save the code to a file",
    zoomOut: "Zoom out",
    fitToScreen: "Fit to screen",
    zoomIn: "Zoom in",
    settingsDialog: `Simulation ${common.ui.settings.toLowerCase()}`,
  },

  settings: {
    values: "Values",
    text: "Text",
    textSizes: {
      small: "Small text",
      medium: "Medium text",
      large: "Large text",
    },
    signals: "Signals",
    wiresAndPorts: "Wires and ports",
    controlSignals: "Control signals",
    dataWires: "Data wires",
    speed: "Speed",
    speedSlider: "Animation speed",
    low: "Low",
    high: "High",
    language: "Language",
  },

  theme: {
    toLight: "Switch to light mode",
    toDark: "Switch to dark mode",
    light: "Light",
    dark: "Dark",
  },

  toast: {
    close: "Close",
  },

  simulation: {
    assembleTitle: "Assemble (compile) the source code",
    simulating: "Simulating…",
    runTitle: {
      locked: "Simulation in progress",
      none: "Assemble the program first",
      stale: "Assembly is outdated — assemble again",
      errors: "Fix the assembly errors",
      ok: "Simulate the program until HLT",
    },
    status: {
      errors: (n: number) => `${n} assembly ${n === 1 ? "error" : "errors"}`,
      ready: (n: number) =>
        `${n} ${n === 1 ? "instruction" : "instructions"} — simulate to step through tick by tick`,
      stale: "code changed — assemble again",
      none: "assemble the program to simulate",
    },
    goToStart: "Go to start",
    stepBack: "Step back one tick",
    playTitle: "Play through every tick",
    play: "Play",
    pause: "Pause",
    stepForward: "Step forward one tick",
    goToEnd: "Go to end, without animating",
    boostTitle: "Hold to speed up the animation (F)",
    boost: "Speed up the animation",
    stopTitle: "Close the timeline",
    timeline: "Tick",
  },

  tick: {
    tick: "tick",
    halted: "halted",
    ofTotal: (total: number) => `of ${total}`,
    status: (current: number, total: number, halted: boolean) =>
      `Tick ${current} of ${total}${halted ? ", halted" : ""}`,
  },
};
