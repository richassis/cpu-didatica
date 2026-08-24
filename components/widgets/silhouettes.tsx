"use client";

import { useId } from "react";
import {
  RectangleHorizontal,
  Rows3,
  Database,
  Sigma,
  Plus,
  Merge,
  Split,
  Cpu,
  Hash,
  type LucideIcon,
} from "lucide-react";

/**
 * Component identity, in three redundant layers.
 *
 * The redundancy is deliberate — each layer fails at a different zoom:
 *
 *   silhouette  legible at any zoom, down to 25%   — peripheral recognition
 *   glyph       legible at >= 50%                   — disambiguation
 *   anatomy     legible at >= 100%                  — detailed reading
 *
 * None of them is colour. That is the whole point: a node has to stay
 * identifiable in greyscale, so that colour is free to mean "this is what is
 * happening right now".
 *
 * The shapes follow the convention used in architecture diagrams (Patterson &
 * Hennessy) so the student recognises them outside the simulator too. One rule
 * falls out for free and is worth stating in the legend: whatever carries a
 * clock notch is sequential, whatever does not is combinational.
 */

export type SilhouetteKind = "alu" | "adder" | "mux" | "decoder";

/**
 * `alu` keeps the geometry the old bitmap-filtered asset had: a
 * trapezoid with the wider base on the left and the canonical V notch on the
 * input side. The adder is the same family without the notch — that absence is
 * what separates "computes a chosen operation" from "always adds".
 */
const PATHS: Record<SilhouetteKind, { viewBox: string; d: string }> = {
  alu: {
    viewBox: "0 0 161 241",
    d: "M8.06348 0.376877C8.06961 0.379123 8.0759 0.381445 8.08203 0.383713L151.856 53.5539C157.351 55.5862 161 60.8256 161 66.6847V174.105C161 179.964 157.351 185.204 151.856 187.236L8.08203 240.407C8.0757 240.409 8.06883 240.411 8.0625 240.413C4.15341 241.859 0 238.967 0 234.799V171.109C0 166.473 2.29553 162.137 6.13017 159.531L27.96 144.693L46.6748 131.975C54.8487 126.419 54.8486 114.372 46.6748 108.816L38.1367 103.014L6.13036 81.2602C2.2956 78.6539 0 74.318 0 69.6814V5.99245C0 1.82391 4.15365 -1.06877 8.06348 0.376877Z",
  },
  adder: { viewBox: "0 0 100 100", d: "M2 2 L98 26 L98 74 L2 98 Z" },
  mux: { viewBox: "0 0 100 100", d: "M2 2 L98 22 L98 78 L2 98 Z" },
  // Inverted: the narrow side faces the inputs, and the outputs fan out.
  decoder: { viewBox: "0 0 100 100", d: "M2 26 L98 2 L98 98 L2 74 Z" },
};

/**
 * The outline of a non-rectangular node.
 *
 * Drawn as a 1px stroke with an interior glow, never as a filled block — a
 * solid orange ALU would blow the "no saturated fill larger than 24px" budget
 * on its own. `non-scaling-stroke` keeps the outline at 1px even though the
 * viewBox is stretched to the node's real dimensions.
 */
export function Silhouette({ kind }: { kind: SilhouetteKind }) {
  const gradientId = useId();
  const { viewBox, d } = PATHS[kind];

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full pointer-events-none"
      aria-hidden
    >
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="115%" r="95%">
          <stop offset="0%" stopColor="var(--node-glow)" />
          <stop offset="70%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <path d={d} fill="var(--surface-raised)" />
      <path
        d={d}
        fill={`url(#${gradientId})`}
        stroke="var(--node-line)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * The clock notch: a hollow triangle in the bottom-left corner marking a
 * sequential component. Registers, the register bank and the memories carry
 * it; the ALU, the adder, the MUX and the decoder do not. That distinction is
 * exactly what the course wants to teach, and here it is encoded in the shape
 * rather than written in a caption.
 */
export function ClockNotch() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      className="absolute bottom-1.5 left-1.5 pointer-events-none"
      aria-hidden
    >
      <path
        d="M0.5 0.5 L7.5 4 L0.5 7.5 Z"
        fill="none"
        stroke="var(--node-line)"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The memory spine: three hairlines hugging the left border, reading as the
 * stacked edge of a block of storage. It is what separates a memory from a
 * register at 25% zoom, where neither the glyph nor the address list survives.
 */
export function MemorySpine() {
  return (
    <svg
      className="absolute inset-y-2 left-1 w-2 pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 8 100"
      aria-hidden
    >
      {[24, 50, 76].map((y) => (
        <line
          key={y}
          x1="0"
          x2="8"
          y1={y}
          y2={y}
          stroke="var(--node-line)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/**
 * Corner-badge glyphs. Monochrome line icons only — they inherit --node-ink,
 * so they are muted at rest and take the state colour when the node fires.
 * No emoji: they carry their own colour and their own typeface, and would
 * break both rules at once.
 */
export const GLYPHS: Record<string, LucideIcon> = {
  Register: RectangleHorizontal,
  PipelineRegister: RectangleHorizontal,
  GprComponent: Rows3,
  MemoryComponent: Database,
  InstructionMemoryComponent: Database,
  UlaComponent: Sigma,
  AdderComponent: Plus,
  IncrementerComponent: Plus,
  MuxComponent: Merge,
  DecoderComponent: Split,
  CpuComponent: Cpu,
  ConstantComponent: Hash,
};
