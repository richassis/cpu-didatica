/**
 * Calculates the exact position of a port on a component.
 * Matches the logic in PortIndicator positioning.
 */
export function calculatePortPosition(
  component: { x: number; y: number; w: number; h: number },
  position: "left" | "right" | "top" | "bottom",
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
 * Finds a specific port's position on a component.
 */
export function findPortPosition(
  component: { x: number; y: number; w: number; h: number },
  portName: string,
  direction: "input" | "output",
  allPorts: Array<{ name: string; direction: "input" | "output" }>
): { x: number; y: number } {
  // Filter ports by direction
  const portsInDirection = allPorts.filter((p) => p.direction === direction);
  
  // Find index of this port
  const portIndex = portsInDirection.findIndex((p) => p.name === portName);
  
  if (portIndex === -1) {
    // Fallback to center if port not found
    const position = direction === "input" ? "left" : "right";
    return calculatePortPosition(component, position, 50);
  }
  
  // Calculate offset
  const offset = getPortOffset(portIndex, portsInDirection.length);
  
  // Determine position (inputs on left, outputs on right)
  const position = direction === "input" ? "left" : "right";
  
  return calculatePortPosition(component, position, offset);
}
