// import type { WidgetDefinition } from "@/lib/widgetDefinitions";

// export type { WidgetDefinition } from "@/lib/widgetDefinition";

import type { ComponentPortConfig } from "@/lib/portPositioning";

/** Shared type — imported by both widget files and widgetDefinitions.ts */
export interface WidgetDefinition {
  /** Unique string key matching ComponentInstance.type */
  type: string;
  /** Human-readable label shown in the picker */
  label: string;
  /** Short uppercase prefix used for auto-naming instances: GPR1, REG2, ... */
  namePrefix: string;
  /** Emoji or short icon for the picker */
  icon: string;
  /** Default instance width in canvas pixels */
  defaultWidth: number;
  /** Default instance height in canvas pixels */
  defaultHeight: number;
  /** Short description shown in the picker */
  description: string;
  /** Optional port positioning configuration (hardcoded per component type) */
  portConfig?: ComponentPortConfig;
}


/**
 * Central registry of all widget definitions.
 * Each widget also exports its own `definition` for co-location,
 * but THIS array is the single source for the Add Component modal.
 * Add a new entry here when creating a new widget type.
 * 
 * Note: All dimensions are aligned to GRID_SIZE (16px) for proper grid snapping.
 */

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: "GprComponent",
    label: "GPR Bank",
    namePrefix: "GPR",
    icon: "\u{1F5C2}",
    defaultWidth: 160,  // 10 grid cells
    defaultHeight: 256, // 16 grid cells
    description: "General Purpose Registers bank",
    // GPR: addresses and data on left, outputs on right, control signals on top
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
      ports: {
        "in_writeEnable": { side: "top" },  // Control signal → top
        // Address and data ports stay on left (default)
        // Output ports stay on right (default)
      },
    },
  },
  {
    type: "MemoryComponent",
    label: "Memory",
    namePrefix: "MEM",
    icon: "\u{1F9E0}",
    defaultWidth: 160,  // 10 grid cells
    defaultHeight: 192, // 12 grid cells
    description: "Unified memory — addr/data/rdMem/wrMem ports, 256×16b default",
    // Memory: addresses on left, data output on right, control signals on top
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
      ports: {
        "addr": { side: "left" },    // Address signal → left
        "data": { side: "left" },    // Data input → left  
        "rdMem": { side: "top" , offset: 45},    // Control signal → top
        "wrMem": { side: "top" , offset: 55},    // Control signal → top
      },
    },
  },
  {
    type: "InstructionMemoryComponent",
    label: "Instruction Memory",
    namePrefix: "IMEM",
    icon: "\u{1F4C0}",
    defaultWidth: 192,  // 12 grid cells (increased from 10)
    defaultHeight: 240, // 15 grid cells (increased from 12)
    description: "Read-only instruction memory — addr input, instruction output",
    // InstructionMemory: address on left, output on right
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
      ports: {
        "addr": { side: "left" },    // Address signal → left
      },
    },
  },
  {
    type: "UlaComponent",
    label: "ULA / ALU",
    namePrefix: "ULA",
    icon: "\u2699\uFE0F",
    defaultWidth: 128,  // 8 grid cells
    defaultHeight: 176, // 11 grid cells
    description: "Arithmetic Logic Unit",
    // ULA: data operands from left, result on right, operation control on top, flags on right
    portConfig: {
      ports: {
        "a": { side: "left", offset: 33 },        // Data input → left
        "b": { side: "left", offset: 67 },        // Data input → left
        "operation": { side: "top", offset: 50 }, // Control signal → top
        "result": { side: "right", offset: 52 },  // Data output → right
        "zero": { side: "bottom", offset: 25 },    // Status flag → right
        "carry": { side: "bottom", offset: 50 },   // Status flag → right
        "negative": { side: "bottom", offset: 75 }, // Status flag → right
      },
    },
  },
  {
    type: "AdderComponent",
    label: "Adder",
    namePrefix: "ADD",
    icon: "\u2795",
    defaultWidth: 128,  // 8 grid cells
    defaultHeight: 176, // 11 grid cells
    description: "Dedicated adder \u2014 always performs A + B",
    // Adder mirrored: inputs from right, output to left
    portConfig: {
      defaultInputSide: "right",
      defaultOutputSide: "left",
    },
  },
  {
    type: "MuxComponent",
    label: "Multiplexer",
    namePrefix: "MUX",
    icon: "\u2195",
    defaultWidth: 64,   // 4 grid cells
    defaultHeight: 96,  // 6 grid cells
    description: "Selects one of 2–3 inputs based on a select signal",
    // Mux: data inputs on left, output on right, select control signal on top
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
      ports: {
        "sel": { side: "top", offset: 50 },  // Control signal → top
      },
    },
  },
  {
    type: "Register",
    label: "Register",
    namePrefix: "REG",
    icon: "\u{1F4C1}",
    defaultWidth: 144,  // 9 grid cells
    defaultHeight: 48,  // 3 grid cells
    description: "A single register showing its label and value on hover",
    // Register: data on left, output on right, control signals on top
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
      ports: {
        "writeEnable": { side: "top", offset: 50 },  // Control signal → top
      },
    },
  },
  {
    type: "ConstantComponent",
    label: "Constant N",
    namePrefix: "CONST",
    icon: "N",
    defaultWidth: 112,  // 7 grid cells
    defaultHeight: 48,  // 3 grid cells
    description: "Constant numeric source with configurable N",
    // Constant source: single output on right
    portConfig: {
      defaultOutputSide: "right",
      ports: {
        "value": { side: "right", offset: 50 },
      },
    },
  },
  {
    type: "DecoderComponent",
    label: "Decoder",
    namePrefix: "DEC",
    icon: "\u{1F4DC}",
    defaultWidth: 144,  // 9 grid cells
    defaultHeight: 192, // 12 grid cells
    description: "Instruction decoder — shows opcode, fields, and format",
    // Decoder with standard left/right layout
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
    },
  },
  {
    type: "CpuComponent",
    label: "CPU Unit",
    namePrefix: "CPU",
    icon: "\u{1F9EE}",
    defaultWidth: 176,  // 11 grid cells
    defaultHeight: 304, // 19 grid cells
    description: "CPU control unit — FSM state and control signals",
    // CPU: input ports (opcode/flags) on left, all control signal outputs on top
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
      ports: {
        // All CPU outputs are control signals → go to top
        "out_wrIR": { side: "bottom" },
        "out_wrReg": { side: "bottom" },
        "out_muxAReg": { side: "bottom" },
        "out_muxDReg": { side: "bottom" },
        "out_wrPC": { side: "bottom" },
        "out_muxPC": { side: "bottom" },
        "out_rdMem": { side: "bottom" },
        "out_wrMem": { side: "bottom" },
        "out_muxAMem": { side: "bottom" },
        "out_opULA": { side: "bottom" },
      },
    },
  },
];

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return WIDGET_DEFINITIONS.find((d) => d.type === type);
}

/**
 * Returns the next auto-generated label for a widget type, e.g. "GPR1", "GPR2".
 * Pass the current components array from the store to count existing instances.
 */
export function generateDefaultLabel(
  def: WidgetDefinition,
  existingComponents: { type: string }[]
): string {
  const count = existingComponents.filter((c) => c.type === def.type).length;
  return `${def.namePrefix}${count + 1}`;
}
