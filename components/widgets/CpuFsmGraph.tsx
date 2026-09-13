"use client";

import { useEffect, useRef, useState } from "react";
import { CpuState, CPU_STATE_LABELS } from "@/lib/simulator/CpuState";
import { OPCODE_SEQUENCES } from "@/lib/simulator/Cpu";
import { Opcode, opcodeToMnemonic } from "@/lib/simulator/ISA";

/**
 * The control unit's finite-state machine, drawn as the tree it actually is:
 * every instruction shares FETCH and DECODE, then follows exactly one branch
 * chosen by its opcode, and every branch (but HLT) rejoins FETCH for the next
 * instruction. Teaching the branches not taken is the point — they stay
 * visible, just dim, rather than disappearing the moment they're not current.
 *
 * FETCH and DECODE are stacked at the top, centred over the branch fan; below
 * DECODE the fan-out spine splits into one column per branch, each running
 * top-down (the longest, ULA, is 3 states). Every non-HLT branch drops to the
 * merge spine at the bottom, which loops back up the left rail into FETCH.
 *
 * The instruction badge (top-left) is the single readout that replaced a static
 * label over every branch. It stays off for the whole DECODE tick — the opcode
 * it reads isn't trustworthy until DECODE's wire animation resolves — and
 * appears the instant the branch's first state goes current.
 *
 * The control unit's body can be resized taller or shorter by the user, and
 * this graph is inherently wide (six columns). Rather than stretch the fixed
 * layout to fill whatever box it's given (which distorts boxes and text
 * non-uniformly), a ResizeObserver measures the actual rendered aspect ratio
 * and a `vScale` factor grows only the *spacing* between rows — FETCH/DECODE
 * gaps, row height, merge margins — so a taller box gets more breathing room
 * between states instead of warped glyphs. Element sizes (box width/height,
 * font size) stay fixed; only whitespace grows. `preserveAspectRatio="xMidYMid
 * meet"` then scales that matched-aspect viewBox uniformly, so scaleX ===
 * scaleY and nothing is ever non-uniformly stretched.
 */

type BranchKey = "LDA" | "LDAI" | "STA" | "ULA" | "JUMP" | "HLT";

interface Branch {
  key: BranchKey;
  opcodes: Opcode[];
  states: CpuState[];
  col: number;
}

const BRANCHES: Branch[] = [
  { key: "LDA",  opcodes: [Opcode.LDA],  states: OPCODE_SEQUENCES[Opcode.LDA]!,  col: 0 },
  { key: "LDAI", opcodes: [Opcode.LDAI], states: OPCODE_SEQUENCES[Opcode.LDAI]!, col: 1 },
  { key: "STA",  opcodes: [Opcode.STA],  states: OPCODE_SEQUENCES[Opcode.STA]!,  col: 2 },
  {
    key: "ULA",
    opcodes: [Opcode.ADD, Opcode.SUB, Opcode.AND, Opcode.OR, Opcode.NOT],
    states: OPCODE_SEQUENCES[Opcode.ADD]!,
    col: 3,
  },
  {
    key: "JUMP",
    opcodes: [Opcode.JZ, Opcode.JC, Opcode.JN, Opcode.JMP],
    states: OPCODE_SEQUENCES[Opcode.JZ]!,
    col: 4,
  },
  { key: "HLT", opcodes: [Opcode.HLT], states: [CpuState.HALT], col: 5 },
];

const MAX_LEVELS = 3; // the ULA branch: READREG2 → EXECUTE → WRITEREG3

// Element sizes — fixed regardless of the container's aspect ratio, so
// nothing individually distorts. Narrower than the original design, both to
// give the return rail clear room on the left and to fit six columns more
// comfortably.
const BOX_W = 130;
const BOX_H = 42;

const COL_X0 = 110;
const COL_W = 150;
const COL_X_LAST = COL_X0 + (BRANCHES.length - 1) * COL_W;

// The return-to-FETCH rail. Kept a clear margin to the left of the first
// branch column's box edge (COL_X0 - BOX_W / 2) so it always reads as its own
// line hugging the control unit's left edge, never passing under a box.
const RAIL_X = COL_X0 - BOX_W / 2 - 24;

// FETCH / DECODE stacked at the top, centred over the branch fan.
const HEADER_X = (COL_X0 + COL_X_LAST) / 2;

// Base (unscaled) vertical gaps, tuned for the original wide/short aspect
// ratio. Multiplied by `vScale` at render time to fill a taller container.
const FETCH_Y_BASE = 44;
const DECODE_GAP_BASE = 60;
const FANOUT_GAP_BASE = 44;
const ROW_GAP0_BASE = 54;
const ROW_H_BASE = 74;
const MERGE_MARGIN_BASE = 30;
const BOTTOM_MARGIN_BASE = 24;

const INSTR_BADGE_X = COL_X_LAST + BOX_W / 2 - 68;

const GRAPH_W = COL_X_LAST + BOX_W / 2 + 30;

const BASE_GRAPH_H =
  FETCH_Y_BASE + DECODE_GAP_BASE + FANOUT_GAP_BASE + ROW_GAP0_BASE +
  (MAX_LEVELS - 1) * ROW_H_BASE + BOX_H / 2 + MERGE_MARGIN_BASE + BOTTOM_MARGIN_BASE;
const BASE_ASPECT = GRAPH_W / BASE_GRAPH_H;

const MIN_VSCALE = 1; // never shrink below the tuned base layout
const MAX_VSCALE = 2.5; // cap how much whitespace can stretch on very tall boxes

function colX(col: number): number {
  return COL_X0 + col * COL_W;
}

function findActiveBranch(opcode: number): Branch | null {
  return BRANCHES.find((b) => b.opcodes.includes(opcode as Opcode)) ?? null;
}

function StateBox({
  x, y, label, active,
}: { x: number; y: number; label: string; active: boolean }) {
  return (
    <g transform={`translate(${x - BOX_W / 2}, ${y - BOX_H / 2})`}>
      <rect
        width={BOX_W}
        height={BOX_H}
        rx={8}
        fill={active ? "color-mix(in srgb, var(--st-active) 20%, var(--surface-raised))" : "var(--surface-raised)"}
        stroke={active ? "var(--st-active)" : "var(--border)"}
        strokeWidth={active ? 1.5 : 1}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={BOX_W / 2}
        y={BOX_H / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={16}
        fontFamily="var(--font-mono, monospace)"
        fill={active ? "var(--st-active)" : "var(--text-muted)"}
      >
        {label}
      </text>
    </g>
  );
}

function Edge({
  x1, y1, x2, y2, active,
}: { x1: number; y1: number; x2: number; y2: number; active: boolean }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={active ? "var(--st-active)" : "var(--border)"}
      strokeWidth={active ? 2 : 1}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface CpuFsmGraphProps {
  /** The state that just executed (what should read as "current"). */
  currentState: CpuState;
  /** The state about to execute next tick. */
  nextState: CpuState;
  opcode: number;
}

export default function CpuFsmGraph({ currentState, nextState, opcode }: CpuFsmGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vScale, setVScale] = useState(1);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      const currentAspect = width / height;
      setVScale(clamp(BASE_ASPECT / currentAspect, MIN_VSCALE, MAX_VSCALE));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Only whitespace scales with the container's height — box/text sizes above
  // are fixed, so nothing gets non-uniformly stretched.
  const FETCH_Y = FETCH_Y_BASE * vScale;
  const DECODE_Y = FETCH_Y + DECODE_GAP_BASE * vScale;
  const FANOUT_Y = DECODE_Y + FANOUT_GAP_BASE * vScale;
  const ROW_Y0 = FANOUT_Y + ROW_GAP0_BASE * vScale;
  const ROW_H = ROW_H_BASE * vScale;
  const MERGE_Y = ROW_Y0 + (MAX_LEVELS - 1) * ROW_H + BOX_H / 2 + MERGE_MARGIN_BASE * vScale;
  const GRAPH_H = MERGE_Y + BOTTOM_MARGIN_BASE * vScale;
  const INSTR_BADGE_Y = FETCH_Y;

  const rowY = (row: number) => ROW_Y0 + row * ROW_H;

  // Not just RESET/FETCH: DECODE too. The opcode this reads isn't settled
  // until DECODE's own wire animation resolves, so a branch "chosen" during
  // that tick would just be replaying the previous instruction's opcode.
  const activeBranch = currentState === CpuState.RESET
    || currentState === CpuState.FETCH
    || currentState === CpuState.DECODE
    ? null
    : findActiveBranch(opcode);

  const isFetchCurrent = currentState === CpuState.FETCH || currentState === CpuState.RESET;
  const isDecodeCurrent = currentState === CpuState.DECODE;

  const currentMnemonic = activeBranch ? (() => {
    try { return opcodeToMnemonic(opcode as Opcode); } catch { return null; }
  })() : null;

  const activeColX = activeBranch ? colX(activeBranch.col) : null;

  // The DECODE→branch trail stays lit for the whole instruction, not just the
  // one tick it was chosen on.
  const onDecodeTrail = !!activeBranch;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-label="Diagrama de estados da unidade de controle"
    >
      {/* FETCH → DECODE link, then DECODE → fan-out spine. */}
      <Edge x1={HEADER_X} y1={FETCH_Y + BOX_H / 2} x2={HEADER_X} y2={DECODE_Y - BOX_H / 2} active={isFetchCurrent || isDecodeCurrent} />
      <Edge x1={HEADER_X} y1={DECODE_Y + BOX_H / 2} x2={HEADER_X} y2={FANOUT_Y} active={onDecodeTrail} />

      {/* Fan-out spine. Track stays neutral end to end; the active overlay
          draws only as far as the column actually selected. */}
      <Edge x1={COL_X0} y1={FANOUT_Y} x2={COL_X_LAST} y2={FANOUT_Y} active={false} />
      {onDecodeTrail && activeColX !== null && (
        <Edge
          x1={Math.min(HEADER_X, activeColX)}
          y1={FANOUT_Y}
          x2={Math.max(HEADER_X, activeColX)}
          y2={FANOUT_Y}
          active
        />
      )}

      {BRANCHES.map((branch) => {
        const isActiveBranch = activeBranch?.key === branch.key;
        const x = colX(branch.col);
        const stubActive = isActiveBranch && onDecodeTrail;

        return (
          <g key={branch.key}>
            <Edge x1={x} y1={FANOUT_Y} x2={x} y2={ROW_Y0 - BOX_H / 2} active={stubActive} />

            {branch.states.map((state, i) => {
              const y = rowY(i);
              const isCurrent = currentState === state;
              return (
                <g key={state}>
                  {i > 0 && (
                    <Edge x1={x} y1={y - ROW_H + BOX_H / 2} x2={x} y2={y - BOX_H / 2} active={isActiveBranch} />
                  )}
                  <StateBox x={x} y={y} label={CPU_STATE_LABELS[state]} active={isCurrent} />
                </g>
              );
            })}

            {branch.key !== "HLT" ? (
              <Edge
                x1={x}
                y1={rowY(branch.states.length - 1) + BOX_H / 2}
                x2={x}
                y2={MERGE_Y}
                active={isActiveBranch}
              />
            ) : null}
          </g>
        );
      })}

      {/* Merge spine: every non-HLT branch returns to FETCH. Runs left to the
          rail, up the rail, and into FETCH's left edge. The rail sits clear
          of every branch box's horizontal footprint, so it always reads as a
          distinct line at the control unit's left edge. */}
      {(() => {
        const lastReturningCol = colX(BRANCHES.filter((b) => b.key !== "HLT").length - 1);
        const returnActive = !!activeBranch && activeBranch.key !== "HLT" && onDecodeTrail;
        return (
          <>
            <Edge x1={COL_X0} y1={MERGE_Y} x2={lastReturningCol} y2={MERGE_Y} active={false} />
            {returnActive && (
              <Edge x1={COL_X0} y1={MERGE_Y} x2={colX(activeBranch!.col)} y2={MERGE_Y} active />
            )}
            <path
              d={`M ${COL_X0} ${MERGE_Y} L ${RAIL_X} ${MERGE_Y} L ${RAIL_X} ${FETCH_Y} L ${HEADER_X - BOX_W / 2} ${FETCH_Y}`}
              fill="none"
              stroke={returnActive ? "var(--st-active)" : "var(--border)"}
              strokeWidth={returnActive ? 2 : 1}
              vectorEffect="non-scaling-stroke"
              markerEnd="url(#cpu-fsm-arrow)"
            />
          </>
        );
      })()}

      <defs>
        <marker id="cpu-fsm-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--border)" />
        </marker>
      </defs>

      {/* Stays "FETCH" even when halted — the dedicated HLT branch box below
          is already what lights up for that state; relabeling this one too
          suggested two different states were both "the halt state". */}
      <StateBox x={HEADER_X} y={FETCH_Y} label="FETCH" active={isFetchCurrent} />
      <StateBox x={HEADER_X} y={DECODE_Y} label="DECODE" active={isDecodeCurrent} />

      {/* The instruction actually decoded, top-right — appears only once DECODE
          has finished. */}
      {currentMnemonic && (
        <g transform={`translate(${INSTR_BADGE_X - 68}, ${INSTR_BADGE_Y - 19})`}>
          <rect width={136} height={38} rx={19} fill="color-mix(in srgb, var(--st-active) 18%, transparent)" stroke="var(--st-active)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <text x={68} y={19} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={600} fontFamily="var(--font-mono, monospace)" fill="var(--st-active)">
            {currentMnemonic}
          </text>
        </g>
      )}

      {/* Next-state hint. */}
      {nextState !== currentState && (
        <text
          x={GRAPH_W - 6}
          y={GRAPH_H - 6}
          textAnchor="end"
          fontSize={11}
          fontFamily="var(--font-mono, monospace)"
          fill="var(--text-faint)"
        >
          próx.: {CPU_STATE_LABELS[nextState]}
        </text>
      )}
    </svg>
  );
}
