/**
 * Port side position options
 */
export type PortSide = "left" | "right" | "top" | "bottom";

/**
 * Configuration for a single port's position
 */
export interface PortConfig {
  /** Which side of the component the port should appear on */
  side: PortSide;
  /** Position offset percentage (0-100). If undefined, will be auto-calculated based on port index */
  offset?: number;
}

/**
 * Port configuration mapping for a component
 * Maps port names to their positioning configuration
 */
export interface ComponentPortConfig {
  /** Port-specific configurations. Ports not listed here will use defaults */
  ports?: Record<string, PortConfig>;
  /** Default side for input ports (default: "left") */
  defaultInputSide?: PortSide;
  /** Default side for output ports (default: "right") */
  defaultOutputSide?: PortSide;
}

/**
 * Calculates the exact position of a port on a component.
 * Matches the logic in PortIndicator positioning.
 */
export function calculatePortPosition(
  component: { x: number; y: number; w: number; h: number },
  position: PortSide,
  offset: number
): { x: number; y: number } {
  switch (position) {
    case "left":
      return {
        x: component.x,
        y: component.y + (component.h * offset) / 100,
      };
    case "right":
      return {
        x: component.x + component.w,
        y: component.y + (component.h * offset) / 100,
      };
    case "top":
      return {
        x: component.x + (component.w * offset) / 100,
        y: component.y,
      };
    case "bottom":
      return {
        x: component.x + (component.w * offset) / 100,
        y: component.y + component.h,
      };
  }
}

/**
 * Gets the port offset percentage for a specific port on a component.
 */
export function getPortOffset(portIndex: number, totalPorts: number): number {
  if (totalPorts === 1) return 50;
  return ((portIndex + 1) * 100) / (totalPorts + 1);
}

/**
 * Gets the configured position and offset for a specific port.
 * Returns the side and offset, using the port config or falling back to defaults.
 */
export function getPortPlacement(
  portName: string,
  direction: "input" | "output",
  allPorts: Array<{ name: string; direction: "input" | "output" }>,
  portConfig?: ComponentPortConfig
): { side: PortSide; offset: number } {
  // Check if there's a specific config for this port
  const specificConfig = portConfig?.ports?.[portName];

  if (specificConfig) {
    // Use specific port configuration
    const side = specificConfig.side;

    // If offset is specified, use it; otherwise auto-calculate
    if (specificConfig.offset !== undefined) {
      return { side, offset: specificConfig.offset };
    }

    // Auto-calculate offset based on ports on the same side with same direction
    const portsOnSameSide = allPorts.filter(p => {
      const pConfig = portConfig?.ports?.[p.name];
      const pSide = pConfig?.side ?? (p.direction === "input"
        ? (portConfig?.defaultInputSide ?? "left")
        : (portConfig?.defaultOutputSide ?? "right"));
      return pSide === side && p.direction === direction;
    });

    const indexOnSide = portsOnSameSide.findIndex(p => p.name === portName);
    const offset = getPortOffset(indexOnSide !== -1 ? indexOnSide : 0, portsOnSameSide.length);

    return { side, offset };
  }

  // Use default side based on direction
  const defaultSide = direction === "input"
    ? (portConfig?.defaultInputSide ?? "left")
    : (portConfig?.defaultOutputSide ?? "right");

  // Calculate offset based on ports with same direction on the default side
  const portsOnDefaultSide = allPorts.filter(p => {
    const pConfig = portConfig?.ports?.[p.name];
    // Skip ports with specific configs that put them on a different side
    if (pConfig?.side && pConfig.side !== defaultSide) return false;
    return p.direction === direction;
  });

  const portIndex = portsOnDefaultSide.findIndex(p => p.name === portName);
  const offset = getPortOffset(portIndex !== -1 ? portIndex : 0, portsOnDefaultSide.length);

  return { side: defaultSide, offset };
}

/**
 * Finds a specific port's position on a component.
 * Now supports custom port configurations from widget definitions.
 */
export function findPortPosition(
  component: { x: number; y: number; w: number; h: number },
  portName: string,
  direction: "input" | "output",
  allPorts: Array<{ name: string; direction: "input" | "output" }>,
  portConfig?: ComponentPortConfig
): { x: number; y: number } {
  const { side, offset } = getPortPlacement(portName, direction, allPorts, portConfig);
  return calculatePortPosition(component, side, offset);
}
