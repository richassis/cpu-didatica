import type { PortSide } from "@/lib/portPositioning";

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculates orthogonal (Manhattan) routing path between two points.
 * Returns an array of points forming 90-degree angles.
 * 
 * Includes snapping support: if one dimension is much smaller than the other,
 * it snaps to zero to make straight lines easier to draw.
 */
export function calculateOrthogonalPath(
  start: Point,
  end: Point
): Point[] {
  const points: Point[] = [start];

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
  points: Point[],
  t: number
): Point {
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

/**
 * Ensures all segments are orthogonal by inserting corner points when needed.
 */
export function enforceOrthogonal(points: Point[]): Point[] {
  if (points.length <= 1) return points;

  const normalized: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = normalized[normalized.length - 1];
    const next = points[i];

    if (prev.x === next.x && prev.y === next.y) {
      continue;
    }

    if (prev.x !== next.x && prev.y !== next.y) {
      const beforePrev = normalized.length > 1 ? normalized[normalized.length - 2] : null;

      // Keep continuity with the previous segment orientation when possible.
      const corner =
        beforePrev && beforePrev.y === prev.y
          ? { x: next.x, y: prev.y }
          : beforePrev && beforePrev.x === prev.x
            ? { x: prev.x, y: next.y }
            : { x: next.x, y: prev.y };

      if (corner.x !== prev.x || corner.y !== prev.y) {
        normalized.push(corner);
      }
    }

    normalized.push(next);
  }

  return simplifyOrthogonalPath(normalized);
}

/**
 * Builds a short segment away from the component before routing across canvas.
 */
export function escapePort(portPos: Point, portSide: PortSide, escapeDistance = 32): Point[] {
  switch (portSide) {
    case "left":
      return [portPos, { x: portPos.x - escapeDistance, y: portPos.y }];
    case "right":
      return [portPos, { x: portPos.x + escapeDistance, y: portPos.y }];
    case "top":
      return [portPos, { x: portPos.x, y: portPos.y - escapeDistance }];
    case "bottom":
      return [portPos, { x: portPos.x, y: portPos.y + escapeDistance }];
    default:
      return [portPos];
  }
}

// ── Auto-router types & helpers ──────────────────────────────────────────────

export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pad an AABB by `margin` on all sides. */
function inflateBounds(box: AABB, margin: number): AABB {
  return { x: box.x - margin, y: box.y - margin, w: box.w + margin * 2, h: box.h + margin * 2 };
}

/** Does the axis-aligned segment from A to B intersect the AABB? */
function segmentIntersectsAABB(a: Point, b: Point, box: AABB): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);

  // Horizontal segment
  if (a.y === b.y) {
    return a.y > box.y && a.y < box.y + box.h && maxX > box.x && minX < box.x + box.w;
  }
  // Vertical segment
  if (a.x === b.x) {
    return a.x > box.x && a.x < box.x + box.w && maxY > box.y && minY < box.y + box.h;
  }
  return false;
}

/** Does *any* segment in the path intersect the AABB? */
function pathIntersectsAABB(path: Point[], box: AABB): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    if (segmentIntersectsAABB(path[i], path[i + 1], box)) return true;
  }
  return false;
}

/**
 * Given source-escape and target-escape with their sides, produce
 * the intermediate orthogonal waypoints between them.
 */
function routeBetweenEscapes(
  srcEsc: Point,
  srcSide: PortSide,
  tgtEsc: Point,
  tgtSide: PortSide,
): Point[] {
  const dx = tgtEsc.x - srcEsc.x;
  const dy = tgtEsc.y - srcEsc.y;

  const srcHorizontal = srcSide === "left" || srcSide === "right";
  const tgtHorizontal = tgtSide === "left" || tgtSide === "right";

  // Both horizontal exits: Z-shape (horizontal → vertical → horizontal)
  if (srcHorizontal && tgtHorizontal) {
    if (srcEsc.y === tgtEsc.y) return [];
    const midX = srcEsc.x + dx / 2;
    return [
      { x: midX, y: srcEsc.y },
      { x: midX, y: tgtEsc.y },
    ];
  }

  // Both vertical exits: Z-shape (vertical → horizontal → vertical)
  if (!srcHorizontal && !tgtHorizontal) {
    if (srcEsc.x === tgtEsc.x) return [];
    const midY = srcEsc.y + dy / 2;
    return [
      { x: srcEsc.x, y: midY },
      { x: tgtEsc.x, y: midY },
    ];
  }

  // Mixed: one horizontal, one vertical → L-shape (1 corner)
  if (srcHorizontal && !tgtHorizontal) {
    return [{ x: tgtEsc.x, y: srcEsc.y }];
  }
  // src vertical, tgt horizontal
  return [{ x: srcEsc.x, y: tgtEsc.y }];
}

/**
 * enforceOrthogonal without calling simplify (avoids recursion).
 */
function enforceOrthogonalRaw(points: Point[]): Point[] {
  if (points.length <= 1) return points;

  const normalized: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = normalized[normalized.length - 1];
    const next = points[i];

    if (prev.x === next.x && prev.y === next.y) continue;

    if (prev.x !== next.x && prev.y !== next.y) {
      const beforePrev = normalized.length > 1 ? normalized[normalized.length - 2] : null;
      const corner =
        beforePrev && beforePrev.y === prev.y
          ? { x: next.x, y: prev.y }
          : beforePrev && beforePrev.x === prev.x
            ? { x: prev.x, y: next.y }
            : { x: next.x, y: prev.y };
      if (corner.x !== prev.x || corner.y !== prev.y) {
        normalized.push(corner);
      }
    }
    normalized.push(next);
  }

  return normalized;
}

/**
 * Attempt to route around obstacles by inserting detour waypoints.
 */
function avoidObstacles(path: Point[], obstacles: AABB[]): Point[] {
  const MARGIN = 16;
  let current = path;

  for (const rawObs of obstacles) {
    const obs = inflateBounds(rawObs, MARGIN);

    if (!pathIntersectsAABB(current, obs)) continue;

    // Find the first intersecting segment
    let hitIdx = -1;
    for (let i = 0; i < current.length - 1; i++) {
      if (segmentIntersectsAABB(current[i], current[i + 1], obs)) {
        hitIdx = i;
        break;
      }
    }
    if (hitIdx === -1) continue;

    const before = current[hitIdx];
    const after = current[hitIdx + 1];

    const centerX = obs.x + obs.w / 2;
    const centerY = obs.y + obs.h / 2;
    const midPathX = (before.x + after.x) / 2;
    const midPathY = (before.y + after.y) / 2;

    // Horizontal segment: detour above or below
    if (before.y === after.y) {
      const detourY = midPathY < centerY ? obs.y : obs.y + obs.h;
      const detour: Point[] = [
        ...current.slice(0, hitIdx + 1),
        { x: before.x, y: detourY },
        { x: after.x, y: detourY },
        ...current.slice(hitIdx + 1),
      ];
      current = simplifyOrthogonalPath(enforceOrthogonalRaw(detour));
    }
    // Vertical segment: detour left or right
    else if (before.x === after.x) {
      const detourX = midPathX < centerX ? obs.x : obs.x + obs.w;
      const detour: Point[] = [
        ...current.slice(0, hitIdx + 1),
        { x: detourX, y: before.y },
        { x: detourX, y: after.y },
        ...current.slice(hitIdx + 1),
      ];
      current = simplifyOrthogonalPath(enforceOrthogonalRaw(detour));
    }
  }

  return current;
}

/**
 * Smart auto-router that considers port sides.
 *
 * Produces an orthogonal path from `source` to `target` that:
 *  1. Exits from the correct port side with an escape segment.
 *  2. Routes with L/Z-shape depending on relative positions and sides.
 *  3. Optionally routes around component bounding boxes (obstacles).
 *
 * @param source       Port pixel position.
 * @param sourceSide   Which side of the component the source port sits on.
 * @param target       Port pixel position.
 * @param targetSide   Which side of the component the target port sits on.
 * @param obstacles    Component AABBs to avoid.
 * @param escapeDistance  How far to escape from the port before routing (default 32).
 * @returns  Array of points forming the complete path (including source & target).
 */
export function autoRoute(
  source: Point,
  sourceSide: PortSide,
  target: Point,
  targetSide: PortSide,
  obstacles: AABB[] = [],
  escapeDistance = 32,
): Point[] {
  // 1. Escape segments
  const srcEscapePoints = escapePort(source, sourceSide, escapeDistance);
  const tgtEscapePoints = escapePort(target, targetSide, escapeDistance);

  const srcEsc = srcEscapePoints[srcEscapePoints.length - 1];
  const tgtEsc = tgtEscapePoints[tgtEscapePoints.length - 1];

  // 2. Route between escape endpoints
  const midPoints = routeBetweenEscapes(srcEsc, sourceSide, tgtEsc, targetSide);

  // 3. Assemble full path
  let path = [source, srcEsc, ...midPoints, tgtEsc, target];
  path = simplifyOrthogonalPath(enforceOrthogonalRaw(path));

  // 4. Obstacle avoidance
  if (obstacles.length > 0) {
    path = avoidObstacles(path, obstacles);
  }

  return path;
}

/**
 * Removes duplicate points, zero-length segments and redundant collinear corners.
 */
export function simplifyOrthogonalPath(points: Point[]): Point[] {
  if (points.length <= 2) return points;

  const deduped: Point[] = [];
  for (const point of points) {
    const last = deduped[deduped.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) {
      deduped.push(point);
    }
  }

  if (deduped.length <= 2) return deduped;

  const simplified: Point[] = [deduped[0]];

  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = deduped[i];
    const next = deduped[i + 1];

    const collinearVertical = prev.x === curr.x && curr.x === next.x;
    const collinearHorizontal = prev.y === curr.y && curr.y === next.y;

    if (!collinearVertical && !collinearHorizontal) {
      simplified.push(curr);
    }
  }

  simplified.push(deduped[deduped.length - 1]);
  return simplified;
}
