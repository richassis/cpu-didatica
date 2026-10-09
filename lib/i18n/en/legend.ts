import type { Messages } from "../index";

export const legend: Messages["legend"] = {
  shapeHeading: "Shape — what it is",
  colorHeading: "Color — what is happening",

  shapes: {
    register: { label: "Register", note: "holds a single value" },
    memory: { label: "Memory", note: "spine on the left edge" },
    alu: { label: "ALU", note: "trapezoid with a notch" },
    mux: { label: "Multiplexer", note: "trapezoid, no notch" },
    decoder: { label: "Decoder", note: "thin vertical bar" },
    control: { label: "Control unit", note: "dashed — commands the datapath" },
  },

  states: {
    active: { label: "Active", note: "component running this tick" },
    dataWire: { label: "Data wire", note: "blue when moving; register holding a value" },
    controlWire: { label: "Control wire", note: "green when moving; CU signal" },
    warning: { label: "Warning", note: "flag set" },
    error: { label: "Error", note: "CPU halted by HLT" },
    idle: { label: "Idle", note: "not part of this tick" },
  },
};
