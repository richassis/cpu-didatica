import type { Messages } from "../index";

export const errors: Messages["errors"] = {
  tickLimit: (maxTicks) =>
    `Execution stopped after ${maxTicks} ticks (possible infinite loop).`,
  fileUnreadable: "The file could not be read as text.",
  fileNotText: (fileName) =>
    `"${fileName}" does not look like a text file. Choose a file with the source code.`,
  fileOpenFailed: "Could not open the file.",
};
