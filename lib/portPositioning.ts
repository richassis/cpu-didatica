import type { PortPosition } from "./simulator/Port";

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
 * Supports manual position/offset overrides via port metadata.
 *
 * Priority:
 * 1. If port has both manual position AND offset → use them directly
 * 2. If port has only manual position → calculate offset automatically
 * 3. Otherwise → use defaults (left for inputs, right for outputs)
 *
 * @example Component with manual port positioning
 * ```ts
 * // In your component constructor:
 * this.in_top = new InputPort("top", "number", 16, 0, "Top input", {
 *   position: "top",     // Override default "left"
 *   offset: 50           // Place at center (50%)
 * });
 * ```
 */
export function findPortPosition(
  component: { x: number; y: number; w: number; h: number },
  portName: string,
  direction: "input" | "output",
  allPorts: Array<{
    name: string;
    direction: "input" | "output";
    position?: PortPosition;
    offset?: number;
  }>
): { x: number; y: number } {
  // Find the specific port
  const port = allPorts.find((p) => p.name === portName);

  // If port has manual position AND offset, use them directly
  if (port?.position && port.offset !== undefined) {
    return calculatePortPosition(component, port.position, port.offset);
  }

  // Filter ports by direction (for auto-calculation)
  const portsInDirection = allPorts.filter((p) => p.direction === direction);

  // Find index of this port
  const portIndex = portsInDirection.findIndex((p) => p.name === portName);

  if (portIndex === -1) {
    // Fallback to center if port not found
    const position = direction === "input" ? "left" : "right";
    return calculatePortPosition(component, position, 50);
  }

  // Calculate offset automatically
  const offset = getPortOffset(portIndex, portsInDirection.length);

  // Use manual position if specified, otherwise default by direction
  const position = port?.position ?? (direction === "input" ? "left" : "right");

  return calculatePortPosition(component, position, offset);
}
