/**
 * aluShape.ts
 *
 * The ALU's trapezoid, kept apart from the component that draws it so the port
 * layout can follow the same geometry: the silhouette is stretched to the
 * node's box (`preserveAspectRatio="none"`), so its slanted top edge sits well
 * below the box's top border everywhere but the far left — a port placed on
 * the border would float above the drawing.
 */

export const ALU_VIEWBOX = { w: 161, h: 241 };

export const ALU_PATH =
  "M8.06348 0.376877C8.06961 0.379123 8.0759 0.381445 8.08203 0.383713L151.856 53.5539C157.351 55.5862 161 60.8256 161 66.6847V174.105C161 179.964 157.351 185.204 151.856 187.236L8.08203 240.407C8.0757 240.409 8.06883 240.411 8.0625 240.413C4.15341 241.859 0 238.967 0 234.799V171.109C0 166.473 2.29553 162.137 6.13017 159.531L27.96 144.693L46.6748 131.975C54.8487 126.419 54.8486 114.372 46.6748 108.816L38.1367 103.014L6.13036 81.2602C2.2956 78.6539 0 74.318 0 69.6814V5.99245C0 1.82391 4.15365 -1.06877 8.06348 0.376877Z";

/** The straight run of the top edge in `ALU_PATH` (the `L` segment). */
const TOP_EDGE = { x1: 8.08203, y1: 0.383713, x2: 151.856, y2: 53.5539 };

/**
 * How far below the box's top border the ALU's top edge runs at `offset`
 * (0–100, % of the width), as a % of the height — the `inset` of a port on
 * the ALU's top side. A percentage of the box, so it holds at any node size.
 */
export function aluTopEdgeInset(offset: number): number {
  const x = Math.min(Math.max((offset / 100) * ALU_VIEWBOX.w, TOP_EDGE.x1), TOP_EDGE.x2);
  const t = (x - TOP_EDGE.x1) / (TOP_EDGE.x2 - TOP_EDGE.x1);
  const y = TOP_EDGE.y1 + t * (TOP_EDGE.y2 - TOP_EDGE.y1);
  return (y / ALU_VIEWBOX.h) * 100;
}
