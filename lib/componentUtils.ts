/**
 * Utility functions for component rendering
 */

/**
 * Safely gets a numeric value with fallback.
 * Handles undefined, null, NaN values by returning the fallback.
 */
export function safeNumber(value: number | undefined | null, fallback: number): number {
  if (value == null || isNaN(value)) {
    return fallback;
  }
  return value;
}

/**
 * Default component dimensions from widget definitions
 */
export const DEFAULT_DIMENSIONS = {
  UlaComponent: { width: 128, height: 176 },
  AdderComponent: { width: 128, height: 176 },
  MuxComponent: { width: 64, height: 96 },
  MemoryComponent: { width: 160, height: 192 },
  InstructionMemoryComponent: { width: 160, height: 192 },
  GprComponent: { width: 176, height: 256 },
  CpuComponent: { width: 176, height: 304 },
  DecoderComponent: { width: 144, height: 192 },
  Register: { width: 144, height: 48 },
} as const;

/**
 * Get safe dimensions for a component type
 */
export function getSafeDimensions(
  componentType: string, 
  w: number | undefined, 
  h: number | undefined
): { width: number; height: number } {
  const defaults = DEFAULT_DIMENSIONS[componentType as keyof typeof DEFAULT_DIMENSIONS] || 
                   { width: 128, height: 128 };
  
  return {
    width: safeNumber(w, defaults.width),
    height: safeNumber(h, defaults.height)
  };
}