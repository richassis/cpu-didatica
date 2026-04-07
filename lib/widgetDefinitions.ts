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
    type: "LabelWidget",
    label: "Label",
    namePrefix: "LBL",
    icon: "\u{1F3F7}",
    defaultWidth: 160,  // 10 grid cells
    defaultHeight: 64,  // 4 grid cells
    description: "A static text label",
  },
  {
    type: "ValueDisplayWidget",
    label: "Value Display",
    namePrefix: "VAL",
    icon: "\u{1F4CA}",
    defaultWidth: 192,  // 12 grid cells
    defaultHeight: 128, // 8 grid cells
    description: "Displays a numeric or text value with a title",
  },
  {
    type: "GprComponent",
    label: "GPR Bank",
    namePrefix: "GPR",
    icon: "\u{1F5C2}",
    defaultWidth: 160,  // 10 grid cells
    defaultHeight: 256, // 16 grid cells
    description: "General Purpose Registers bank",
    // Baseline configuration (matches current behavior)
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
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
    // Memory with address bus from top
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
      ports: {
        "addr": { side: "top" },
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
    // Vertical layout: operands from top, result to bottom, flags on right
    portConfig: {
      ports: {
        "a": { side: "top", offset: 33 },
        "b": { side: "top", offset: 67 },
        "operation": { side: "left", offset: 50 },
        "result": { side: "bottom", offset: 50 },
        "zero": { side: "right", offset: 25 },
        "carry": { side: "right", offset: 50 },
        "negative": { side: "right", offset: 75 },
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
    // Adder with inputs from top, output to bottom
    portConfig: {
      defaultInputSide: "top",
      defaultOutputSide: "bottom",
    },
  },
  {
    type: "MuxComponent",
    label: "Multiplexer",
    namePrefix: "MUX",
    icon: "\u2195",
    defaultWidth: 64,   // 4 grid cells
    defaultHeight: 96,  // 6 grid cells
    description: "Selects one of 2\u20133 inputs based on a select signal",
    // Mux with data inputs on left, output on right, select at bottom
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
      ports: {
        "select": { side: "bottom", offset: 50 },
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
    // Register with clock signal at bottom
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
      ports: {
        "clk": { side: "bottom", offset: 50 },
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
    // CPU with standard left/right layout (can be refined based on testing)
    portConfig: {
      defaultInputSide: "left",
      defaultOutputSide: "right",
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
