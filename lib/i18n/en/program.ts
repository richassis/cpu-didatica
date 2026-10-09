import type { Messages } from "../index";
import { common } from "./common";

export const program: Messages["program"] = {
  defaultName: "program",

  columns: {
    addr: "Addr",
    word: "Word",
    opcode: "Opcode",
    name: "Name",
  },

  layout: {
    expand: (panel: string) => `Expand ${panel}`,
    resize: "Resize the code panels",
  },

  assembly: {
    collapse: `Collapse ${common.ui.assemblyPanel}`,
    locked: "locked",
    custom: "Custom",
    source: "Assembly source code",
    errors: (n: number) => `Assembly ${n === 1 ? "error" : "errors"} (${n})`,
    empty: "Empty code — nothing to assemble",
  },

  assembled: {
    collapse: `Collapse ${common.ui.machinePanel}`,
    outdated: "outdated",
    notAssembled: `Press ${common.ui.assemble} to see the assembled code`,
    failed: (n: number) => `Assembly failed (${n})`,
    seeErrors: `See the errors in ${common.ui.assemblyPanel}.`,
    programSection: "Program",
    dataSection: "Data",
  },

  save: {
    title: "Save program",
    name: "Name",
    savedAs: "Will be saved as",
    type: "Type",
    stats: (lines: number, bytes: number) =>
      `${lines} ${lines === 1 ? "line" : "lines"} · ${bytes} ${bytes === 1 ? "byte" : "bytes"}`,
    cancel: "Cancel",
  },

  memoryPanel: {
    back: "Back to code",
  },
};
