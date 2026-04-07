# Port Configuration Guide

This document explains how to configure port positions on components in the CPU Didática simulator.

## Overview

By default, all input ports are positioned on the **left** side of components and output ports on the **right** side. Port configurations are **hardcoded in widget definitions** to prevent bugs and ensure wire connections follow port positions correctly.

## Configuration Location

Port configurations are defined in `lib/widgetDefinitions.ts` within the `WIDGET_DEFINITIONS` array. This central location makes it easy for programmers to configure and test component port layouts.

## How to Configure Port Positions

### 1. Open Widget Definitions

Edit the file: `lib/widgetDefinitions.ts`

### 2. Add Port Configuration to a Widget

Locate the widget definition you want to configure and add a `portConfig` field:

```typescript
{
  type: "UlaComponent",
  label: "ULA / ALU",
  namePrefix: "ULA",
  icon: "⚙️",
  defaultWidth: 128,
  defaultHeight: 176,
  description: "Arithmetic Logic Unit",
  portConfig: {
    // Default sides for all ports
    defaultInputSide: "top",
    defaultOutputSide: "bottom",

    // Optional: Individual port overrides
    ports: {
      "in_clk": { side: "right", offset: 50 },
      "out_result": { side: "bottom", offset: 50 },
    }
  },
}
```

### 3. Save and Test

After saving the file, the changes will be reflected immediately. All instances of that component type will use the new port configuration.

## Configuration Options

### ComponentPortConfig Interface

```typescript
interface ComponentPortConfig {
  /** Default side for input ports (default: "left") */
  defaultInputSide?: "left" | "right" | "top" | "bottom";

  /** Default side for output ports (default: "right") */
  defaultOutputSide?: "left" | "right" | "top" | "bottom";

  /** Port-specific configurations */
  ports?: {
    [portName: string]: {
      /** Which side of the component */
      side: "left" | "right" | "top" | "bottom";
      /** Offset percentage (0-100). Undefined = auto-calculated */
      offset?: number;
    }
  };
}
```

### Offset Behavior

- **Undefined/omitted**: Ports are automatically spaced evenly along their side
- **0-100**: Exact percentage position along the side (0 = top/left edge, 100 = bottom/right edge)
- **50**: Center of the side

## Examples

### Example 1: Vertical Flow (Top to Bottom)

```typescript
{
  type: "UlaComponent",
  // ... other fields
  portConfig: {
    defaultInputSide: "top",
    defaultOutputSide: "bottom",
  },
}
```

### Example 2: All Ports on Left Side

```typescript
{
  type: "RegisterComponent",
  // ... other fields
  portConfig: {
    defaultInputSide: "left",
    defaultOutputSide: "left",
  },
}
```

### Example 3: Mixed Configuration with Specific Port Positions

```typescript
{
  type: "GprComponent",
  // ... other fields
  portConfig: {
    defaultInputSide: "left",
    defaultOutputSide: "right",
    ports: {
      "in_clk": {
        side: "bottom",
        offset: 50  // Clock at bottom center
      },
      "in_wr": {
        side: "bottom",
        offset: 30  // Write enable near clock
      },
      "out_status": {
        side: "top",
        offset: 20  // Status flag at top
      },
    }
  },
}
```

### Example 4: Symmetric Layout

```typescript
{
  type: "MuxComponent",
  // ... other fields
  portConfig: {
    defaultInputSide: "left",
    defaultOutputSide: "right",
    ports: {
      "in_select": {
        side: "top",
        offset: 50  // Selector signal at top center
      },
    }
  },
}
```

## Port Positioning Logic

1. **Check for specific port configuration**: If a port has an entry in `portConfig.ports`, use that side and offset
2. **Use default side**: Otherwise, use `defaultInputSide` or `defaultOutputSide` based on port direction
3. **Auto-calculate offset**: If offset is not specified, ports on the same side are evenly spaced
4. **Group by direction**: Ports are grouped by direction when auto-spacing (inputs separate from outputs on the same side)

## Tips

- **Keep it simple**: Only configure ports when the default (left for inputs, right for outputs) doesn't work
- **Test with wires**: Create sample connections to verify port positions work well with wire routing
- **Document unusual layouts**: Add comments explaining why a non-standard configuration is used
- **Consistent offsets**: Use common offsets (25, 33, 50, 66, 75) for easier visual alignment

## Use Cases

- **Vertical ALU/ULA designs**: Inputs on top, outputs on bottom for cleaner datapath diagrams
- **Clock and control signals**: Position control signals separately from data signals (e.g., clock on bottom)
- **Bidirectional buses**: Group related bidirectional ports on one side
- **Bus-based architectures**: Align bus connections for cleaner wire routing
- **Educational clarity**: Position ports to make data flow more obvious to students

## Why Hardcoded?

Port configurations are hardcoded in widget definitions rather than user-configurable for several reasons:

1. **Consistency**: All instances of a component type behave the same way
2. **Bug prevention**: Prevents users from accidentally breaking wire connections
3. **Wire routing**: Ensures wires always connect to the correct port positions
4. **Simplicity**: No need for complex UI to manage per-instance configurations
5. **Version control**: Port layouts are tracked in source control with the rest of the codebase
