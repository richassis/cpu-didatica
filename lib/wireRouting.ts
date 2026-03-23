/**
 * Calculates orthogonal (Manhattan) routing path between two points.
 * Returns an array of points forming 90-degree angles.
 * 
 * Includes snapping support: if one dimension is much smaller than the other,
 * it snaps to zero to make straight lines easier to draw.
 */
export function calculateOrthogonalPath(
  start: { x: number; y: number },
  end: { x: number; y: number }
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [start];

  let dx = end.x - start.x;
  let dy = end.y - start.y;

  // Snapping threshold: if one dimension is much smaller than the other, snap it to zero
  // This makes it easier to draw pure horizontal/vertical lines
  const maxDimension = Math.max(Math.abs(dx), Math.abs(dy));
  const snapThreshold = Math.max(40, maxDimension * 0.15); // 15% or 40px, whichever is larger

  if (Math.abs(dx) < snapThreshold && Math.abs(dx) < Math.abs(dy)) {
    dx = 0; // Snap to pure vertical
  } else if (Math.abs(dy) < snapThreshold && Math.abs(dy) < Math.abs(dx)) {
    dy = 0; // Snap to pure horizontal
  }

  // Simple 2-segment routing: horizontal then vertical, or vice versa
  // Choose based on which direction is longer
  if (Math.abs(dx) > Math.abs(dy)) {
    // Go horizontal first, then vertical
    const midX = start.x + dx * 0.5;
    points.push({ x: midX, y: start.y });
    points.push({ x: midX, y: end.y });
  } else {
    // Go vertical first, then horizontal
    const midY = start.y + dy * 0.5;
    points.push({ x: start.x, y: midY });
    points.push({ x: end.x, y: midY });
  }

  points.push(end);
  return points;
}

/**
 * Converts an array of points to an SVG path string.
 */
export function pointsToSVGPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  
  return path;
}

/**
 * Gets a point along an orthogonal path at parameter t (0-1).
 */
export function getPointOnOrthogonalPath(
  points: { x: number; y: number }[],
  t: number
): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (t <= 0) return points[0];
  if (t >= 1) return points[points.length - 1];

  // Calculate total length
  let totalLength = 0;
  const segmentLengths: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const length = Math.sqrt(dx * dx + dy * dy);
    segmentLengths.push(length);
    totalLength += length;
  }

  // Find which segment we're in
  const targetLength = t * totalLength;
  let accumulatedLength = 0;
  
  for (let i = 0; i < segmentLengths.length; i++) {
    if (accumulatedLength + segmentLengths[i] >= targetLength) {
      // We're in this segment
      const segmentT = (targetLength - accumulatedLength) / segmentLengths[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      
      return {
        x: p1.x + (p2.x - p1.x) * segmentT,
        y: p1.y + (p2.y - p1.y) * segmentT,
      };
    }
    accumulatedLength += segmentLengths[i];
  }

  return points[points.length - 1];
}

/**
 * Snaps a value to the nearest grid point.
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}
