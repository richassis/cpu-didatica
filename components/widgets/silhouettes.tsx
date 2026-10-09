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
import { ALU_PATH, ALU_VIEWBOX } from "@/lib/aluShape";

/**
 * Component identity, in two redundant layers.
 *
 * The redundancy is deliberate — each layer works at a different zoom:
 *
 *   silhouette  legible at any zoom             — peripheral recognition
 *   anatomy     shown from 60% zoom (LOD rules) — detailed reading
 *
 * None of them is colour. That is the whole point: a node has to stay
 * identifiable in greyscale, so that colour is free to mean "this is what is
 * happening right now".
 *
 * The shapes follow the convention used in architecture diagrams (Patterson &
 * Hennessy) so the student recognises them outside the simulator too.
 */

export type SilhouetteKind = "alu" | "adder" | "incrementer" | "mux";

/**
 * `alu` keeps the geometry the old bitmap-filtered asset had: a
 * trapezoid with the wider base on the left and the canonical V notch on the
 * input side. The adder is the same family without the notch — that absence is
 * what separates "computes a chosen operation" from "always adds".
 */
const PATHS: Record<SilhouetteKind, { viewBox: string; d: string }> = {
  alu: { viewBox: `0 0 ${ALU_VIEWBOX.w} ${ALU_VIEWBOX.h}`, d: ALU_PATH },
  adder: { viewBox: "0 0 100 100", d: "M2 2 L98 26 L98 74 L2 98 Z" },
  // The adder mirrored: the PC+1 incrementer takes its input on the right, and
  // the input belongs on the wide side, the output on the narrow one.
  incrementer: { viewBox: "0 0 100 100", d: "M2 26 L98 2 L98 98 L2 74 Z" },
  mux: { viewBox: "0 0 100 100", d: "M2 2 L98 22 L98 78 L2 98 Z" },
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
 * The memory spine: three hairlines hugging the left border, reading as the
 * stacked edge of a block of storage. It is what separates a memory from a
 * register at a glance, before any of the anatomy is read.
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
 * One glyph per component type, used by the AddComponentModal palette (nodes on
 * the canvas no longer draw a corner badge). Monochrome line icons only — no
 * emoji: they carry their own colour and their own typeface.
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
