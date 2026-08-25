"use client";

import { CpuState, CPU_STATE_LABELS } from "@/lib/simulator/CpuState";
import { OPCODE_SEQUENCES } from "@/lib/simulator/Cpu";
import { Opcode } from "@/lib/simulator/ISA";

/**
 * The control unit's finite-state machine, drawn as the tree it actually is:
 * every instruction shares FETCH and DECODE, then follows exactly one branch
 * chosen by its opcode, and every branch (but HLT) rejoins FETCH for the next
 * instruction. Teaching the branches not taken is the point — they stay
 * visible, just dim, rather than disappearing the moment they're not current.
 *
 * Laid out on an abstract viewBox rather than real pixels: nothing here has to
 * line up with a port, so a proportional grid stretched with
 * `preserveAspectRatio="none"` fills whatever height the control unit's body
 * has to give it, at any aspect ratio.
 */

type BranchKey = "LDA" | "LDAI" | "STA" | "ULA" | "JUMP" | "HLT";

interface Branch {
  key: BranchKey;
  /** Opcodes that select this branch. */
  opcodes: Opcode[];
  /** Short edge label — the mnemonic(s) that pick this path at DECODE. */
  edgeLabel: string;
  /** States walked after DECODE, in order. */
  states: CpuState[];
  /** Row (vertical slot) this branch occupies in the layout. */
  row: number;
}

const BRANCHES: Branch[] = [
  { key: "LDA",  opcodes: [Opcode.LDA],  edgeLabel: "LDA",  states: OPCODE_SEQUENCES[Opcode.LDA]!,  row: 0 },
  { key: "LDAI", opcodes: [Opcode.LDAI], edgeLabel: "LDAI", states: OPCODE_SEQUENCES[Opcode.LDAI]!, row: 1 },
  { key: "STA",  opcodes: [Opcode.STA],  edgeLabel: "STA",  states: OPCODE_SEQUENCES[Opcode.STA]!,  row: 2 },
  {
    key: "ULA",
    opcodes: [Opcode.ADD, Opcode.SUB, Opcode.AND, Opcode.OR, Opcode.NOT],
    edgeLabel: "ADD SUB AND OR NOT",
    states: OPCODE_SEQUENCES[Opcode.ADD]!,
    row: 3,
  },
  {
    key: "JUMP",
    opcodes: [Opcode.JZ, Opcode.JC, Opcode.JN, Opcode.JMP],
    edgeLabel: "JZ JC JN JMP",
    states: OPCODE_SEQUENCES[Opcode.JZ]!,
    row: 4,
  },
  { key: "HLT", opcodes: [Opcode.HLT], edgeLabel: "HLT", states: [CpuState.HALT], row: 5 },
];

const ROW_H = 40;
const TOP_PAD = 24;
const GRAPH_H = TOP_PAD + BRANCHES.length * ROW_H;
const GRAPH_W = 640;

const FETCH_X = 56;
const DECODE_X = 170;
const SPINE_X = 226;
const BRANCH_X0 = 266;
const STEP_W = 92;
const MERGE_X = GRAPH_W - 40;
const CENTER_Y = TOP_PAD + (BRANCHES.length * ROW_H) / 2 - ROW_H / 2 + 8;

function rowY(row: number): number {
  return TOP_PAD + row * ROW_H + ROW_H / 2;
}

function findActiveBranch(opcode: number): Branch | null {
  return BRANCHES.find((b) => b.opcodes.includes(opcode as Opcode)) ?? null;
}

function StateBox({
  x, y, label, active, small = false,
}: { x: number; y: number; label: string; active: boolean; small?: boolean }) {
  const w = small ? 76 : 88;
  const h = 22;
  return (
    <g transform={`translate(${x - w / 2}, ${y - h / 2})`}>
      <rect
        width={w}
        height={h}
        rx={5}
        fill={active ? "color-mix(in srgb, var(--st-active) 16%, var(--surface-raised))" : "var(--surface-raised)"}
        stroke={active ? "var(--st-active)" : "var(--border)"}
        strokeWidth={active ? 1.5 : 1}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={w / 2}
        y={h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontFamily="var(--font-mono, monospace)"
        fill={active ? "var(--st-active)" : "var(--fg-muted)"}
      >
        {label}
      </text>
    </g>
  );
}

function Edge({
  x1, y1, x2, y2, active, dashed = false,
}: { x1: number; y1: number; x2: number; y2: number; active: boolean; dashed?: boolean }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={active ? "var(--st-active)" : "var(--border)"}
      strokeWidth={active ? 1.5 : 1}
      strokeDasharray={dashed ? "3 3" : undefined}
      vectorEffect="non-scaling-stroke"
    />
  );
}

export interface CpuFsmGraphProps {
  /** The state that just executed (what should read as "current"). */
  currentState: CpuState;
  /** The state about to execute next tick. */
  nextState: CpuState;
  opcode: number;
  halted: boolean;
}

export default function CpuFsmGraph({ currentState, nextState, opcode, halted }: CpuFsmGraphProps) {
  const activeBranch = currentState === CpuState.RESET || currentState === CpuState.FETCH
    ? null
    : findActiveBranch(opcode);

  const isFetchCurrent = currentState === CpuState.FETCH || currentState === CpuState.RESET;
  const isDecodeCurrent = currentState === CpuState.DECODE;

  return (
    <svg
      viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-label="Diagrama de estados da unidade de controle"
    >
      {/* FETCH → DECODE */}
      <Edge x1={FETCH_X + 44} y1={CENTER_Y} x2={DECODE_X - 44} y2={CENTER_Y} active={isFetchCurrent || isDecodeCurrent} />
      {/* Fan-out spine after DECODE */}
      <Edge x1={SPINE_X} y1={TOP_PAD} x2={SPINE_X} y2={TOP_PAD + BRANCHES.length * ROW_H - ROW_H / 2 + 2} active={false} />
      <Edge x1={DECODE_X + 44} y1={CENTER_Y} x2={SPINE_X} y2={CENTER_Y} active={isDecodeCurrent} />

      {BRANCHES.map((branch) => {
        const isActiveBranch = activeBranch?.key === branch.key;
        const y = rowY(branch.row);
        const spineToStub = isActiveBranch && currentState === CpuState.DECODE;

        return (
          <g key={branch.key}>
            <Edge x1={SPINE_X} y1={y} x2={BRANCH_X0 - 4} y2={y} active={spineToStub} />
            <text
              x={(SPINE_X + BRANCH_X0) / 2}
              y={y - 6}
              textAnchor="middle"
              fontSize={7}
              fontFamily="var(--font-mono, monospace)"
              fill={isActiveBranch ? "var(--st-active)" : "var(--fg-faint)"}
            >
              {branch.edgeLabel}
            </text>

            {branch.states.map((state, i) => {
              const x = BRANCH_X0 + i * STEP_W;
              const isCurrent = currentState === state;
              const edgeActiveIn = isActiveBranch && (
                i === 0 ? currentState === CpuState.DECODE || isCurrent
                        : currentState === branch.states[i - 1] || isCurrent
              );
              return (
                <g key={state}>
                  {i > 0 && (
                    <Edge x1={x - STEP_W + 44} y1={y} x2={x - 44} y2={y} active={edgeActiveIn} />
                  )}
                  <StateBox x={x} y={y} label={CPU_STATE_LABELS[state]} active={isCurrent} small />
                </g>
              );
            })}

            {branch.key !== "HLT" ? (
              <Edge
                x1={BRANCH_X0 + (branch.states.length - 1) * STEP_W + 44}
                y1={y}
                x2={MERGE_X}
                y2={y}
                active={isActiveBranch && currentState === branch.states[branch.states.length - 1]}
              />
            ) : null}
          </g>
        );
      })}

      {/* Merge spine: every non-HLT branch returns to FETCH. */}
      <Edge x1={MERGE_X} y1={rowY(0)} x2={MERGE_X} y2={rowY(4)} active={false} />
      <path
        d={`M ${MERGE_X} ${rowY(2)} C ${MERGE_X + 26} ${rowY(2)}, ${MERGE_X + 26} ${TOP_PAD - 10}, ${FETCH_X} ${TOP_PAD - 10} L ${FETCH_X} ${CENTER_Y - 12}`}
        fill="none"
        stroke={activeBranch && activeBranch.key !== "HLT" && currentState === activeBranch.states[activeBranch.states.length - 1] ? "var(--st-active)" : "var(--border)"}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        markerEnd="url(#cpu-fsm-arrow)"
      />

      <defs>
        <marker id="cpu-fsm-arrow" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--fg-faint)" />
        </marker>
      </defs>

      <StateBox x={FETCH_X} y={CENTER_Y} label={halted ? "HALT" : "FETCH"} active={isFetchCurrent && !halted} />
      <StateBox x={DECODE_X} y={CENTER_Y} label="DECODE" active={isDecodeCurrent} />

      {/* Next-state hint: a faint marker at the head of the upcoming edge. */}
      {nextState !== currentState && (
        <text
          x={GRAPH_W - 4}
          y={GRAPH_H - 4}
          textAnchor="end"
          fontSize={8}
          fontFamily="var(--font-mono, monospace)"
          fill="var(--fg-faint)"
        >
          → {CPU_STATE_LABELS[nextState]}
        </text>
      )}
    </svg>
  );
}
