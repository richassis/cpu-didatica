"use client";

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
 * Branches run top-down as columns beside FETCH/DECODE — the longest branch
 * (ULA) is 3 states, so the whole graph is only 3 levels tall regardless of
 * how many branches exist, instead of growing a new floor per branch.
 *
 * FETCH and DECODE sit close together, centred on the branch rows, joined by
 * one vertical line at their shared x. That line also carries their exits:
 * above DECODE it jogs into the fan-out spine, below FETCH it jogs down to
 * the merge spine — both jogs leave through the box's own top/bottom edge,
 * which nothing else ever touches, so nothing crosses either box.
 *
 * Which mnemonics share a branch used to be printed above every column; that
 * duplicated the one instruction actually running (shown at the top, in
 * green) with five other labels the student wasn't looking at. Gone — one
 * readout, not six. That readout also stays off for the entire DECODE tick:
 * the opcode it reads isn't trustworthy until DECODE's own wire animation has
 * actually resolved, so showing it any earlier just flashes the previous
 * instruction. It appears the instant the branch's first state goes current,
 * never before.
 *
 * Laid out on an abstract viewBox rather than real pixels: nothing here has to
 * line up with a port, so a proportional grid stretched with
 * `preserveAspectRatio="none"` fills whatever size the control unit's body
 * has to give it, at any aspect ratio.
 */

type BranchKey = "LDA" | "LDAI" | "STA" | "ULA" | "JUMP" | "HLT";

interface Branch {
  key: BranchKey;
  /** Opcodes that select this branch. */
  opcodes: Opcode[];
  /** States walked after DECODE, top to bottom. */
  states: CpuState[];
  /** Column (horizontal slot) this branch occupies in the layout. */
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

const BOX_W = 156;
const BOX_H = 42;

const COL_X0 = 288;
const COL_W = 176;
const COL_X_LAST = COL_X0 + (BRANCHES.length - 1) * COL_W;

const FANOUT_Y = 58;
const ROW_Y0 = 106;
const ROW_H = 78;
const MERGE_Y = ROW_Y0 + (MAX_LEVELS - 1) * ROW_H + BOX_H / 2 + 32;

const FETCH_X = 100;
// FETCH and DECODE sit close together, centred on the row0–row2 span rather
// than pinned at the graph's own top/bottom — each still exits through its
// own top/bottom edge, which is what keeps every line crossing-free.
const ROWS_MID = (ROW_Y0 + (ROW_Y0 + (MAX_LEVELS - 1) * ROW_H)) / 2;
const DECODE_Y = ROWS_MID - 38;
const FETCH_Y = ROWS_MID + 38;

const INSTR_BADGE_X = (COL_X0 + COL_X_LAST) / 2;
const INSTR_BADGE_Y = 26;

const GRAPH_W = COL_X_LAST + BOX_W / 2 + 30;
const GRAPH_H = MERGE_Y + 26;

function colX(col: number): number {
  return COL_X0 + col * COL_W;
}

function rowY(row: number): number {
  return ROW_Y0 + row * ROW_H;
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
        fontSize={18}
        fontFamily="var(--font-mono, monospace)"
        fill={active ? "var(--st-active)" : "var(--fg-muted)"}
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

export interface CpuFsmGraphProps {
  /** The state that just executed (what should read as "current"). */
  currentState: CpuState;
  /** The state about to execute next tick. */
  nextState: CpuState;
  opcode: number;
  halted: boolean;
}

export default function CpuFsmGraph({ currentState, nextState, opcode, halted }: CpuFsmGraphProps) {
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
  // one tick it was chosen on — otherwise the wire the box lit up from goes
  // dark the moment execution moves on, which reads as the connection being
  // broken rather than as "this is the path we're on".
  const onDecodeTrail = !!activeBranch;

  return (
    <svg
      viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-label="Diagrama de estados da unidade de controle"
    >
      {/* The fixed link between the two shared steps, plus each box's own
          exit jog — all three segments share x = FETCH_X and never overlap,
          so together they read as one line with FETCH/DECODE sitting on it. */}
      <Edge x1={FETCH_X} y1={FANOUT_Y} x2={FETCH_X} y2={DECODE_Y - BOX_H / 2} active={onDecodeTrail} />
      <Edge x1={FETCH_X} y1={DECODE_Y + BOX_H / 2} x2={FETCH_X} y2={FETCH_Y - BOX_H / 2} active={isFetchCurrent || isDecodeCurrent} />
      <Edge x1={FETCH_X} y1={FETCH_Y + BOX_H / 2} x2={FETCH_X} y2={MERGE_Y} active={false} />

      {/* Fan-out spine. Track stays neutral end to end; the active overlay
          draws only as far as the column actually selected. */}
      <Edge x1={FETCH_X} y1={FANOUT_Y} x2={COL_X_LAST} y2={FANOUT_Y} active={false} />
      {onDecodeTrail && activeColX !== null && (
        <Edge x1={FETCH_X} y1={FANOUT_Y} x2={activeColX} y2={FANOUT_Y} active />
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

      {/* Merge spine: every non-HLT branch returns to FETCH. Corner at
          FETCH_X, then a vertical run up into FETCH's own bottom edge. */}
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
              d={`M ${COL_X0} ${MERGE_Y} L ${FETCH_X} ${MERGE_Y} L ${FETCH_X} ${FETCH_Y + BOX_H / 2}`}
              fill="none"
              stroke={returnActive ? "var(--st-active)" : "var(--fg-faint)"}
              strokeWidth={returnActive ? 2 : 1}
              vectorEffect="non-scaling-stroke"
              markerEnd="url(#cpu-fsm-arrow)"
            />
          </>
        );
      })()}

      <defs>
        <marker id="cpu-fsm-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--fg-faint)" />
        </marker>
      </defs>

      <StateBox x={FETCH_X} y={DECODE_Y} label="DECODE" active={isDecodeCurrent} />
      <StateBox x={FETCH_X} y={FETCH_Y} label={halted ? "HALT" : "FETCH"} active={isFetchCurrent && !halted} />

      {/* The instruction actually decoded, featured at the top — the single
          readout that replaced a static label over every branch, and that
          only appears once DECODE has actually finished. */}
      {currentMnemonic && (
        <g transform={`translate(${INSTR_BADGE_X - 68}, ${INSTR_BADGE_Y - 19})`}>
          <rect width={136} height={38} rx={19} fill="color-mix(in srgb, var(--st-active) 18%, transparent)" stroke="var(--st-active)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <text x={68} y={19} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={600} fontFamily="var(--font-mono, monospace)" fill="var(--st-active)">
            {currentMnemonic}
          </text>
        </g>
      )}

      {/* Next-state hint: a faint marker at the head of the upcoming edge. */}
      {nextState !== currentState && (
        <text
          x={GRAPH_W - 6}
          y={GRAPH_H - 6}
          textAnchor="end"
          fontSize={11}
          fontFamily="var(--font-mono, monospace)"
          fill="var(--fg-faint)"
        >
          próx.: {CPU_STATE_LABELS[nextState]}
        </text>
      )}
    </svg>
  );
}
