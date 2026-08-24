"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import NodeShell from "@/components/widgets/NodeShell";
import { Opcode, INSTRUCTION_SET } from "@/lib/simulator/ISA";
import type { Decoder } from "@/lib/simulator/Decoder";

function hex16(n: number) {
  return `0x${n.toString(16).toUpperCase().padStart(4, "0")}`;
}
function bin5(n: number) {
  return n.toString(2).padStart(5, "0");
}

function getMnemonic(dec: Decoder): string {
  const op = dec.opcode as Opcode;
  const entry = Object.values(INSTRUCTION_SET).find((d) => d.opcode === op);
  return entry ? entry.mnemonic : "???";
}

/** One sliced-out field of the instruction word. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-1 px-2 py-[3px]">
      <span className="w-14 shrink-0 font-mono text-[10px] text-fg-faint">{label}</span>
      <span className="num font-mono text-[11px] text-fg-muted">{value}</span>
    </div>
  );
}

/**
 * The decoder is an inverted trapezoid — narrow on the input side, fanning out
 * towards its outputs. That is the opposite of the ALU and the MUX, which is
 * exactly why it reads as a different kind of block at a glance.
 *
 * Anatomy: the decoded mnemonic large, the opcode fields sliced out beneath it.
 */
export default function DecoderComponent({ component, zoom }: Props) {
  const revision = useSimulatorStore((s) => s.revision);
  const dec = useSimulatorStore((s) => s.getDecoder(component.id));
  void revision;

  const instr = dec?.instruction ?? 0;
  const op = dec ? (dec.opcode as Opcode) : Opcode.HLT;
  const decoded = dec?.decoded ?? null;
  const desc = decoded
    ? INSTRUCTION_SET[decoded.mnemonic as keyof typeof INSTRUCTION_SET]
    : null;
  const isUla = desc?.format === "ula";

  return (
    <NodeShell
      component={component}
      zoom={zoom}
      silhouette="decoder"
      value={
        <span className="flex flex-col items-center leading-none">
          <span className="font-mono text-[18px] font-medium">
            {dec ? getMnemonic(dec) : "HLT"}
          </span>
          <span className="num mt-1 font-mono text-[9px] text-fg-faint">
            {bin5(op)} · {hex16(instr)}
          </span>
        </span>
      }
    >
      <div className="flex-1 overflow-y-auto pl-4">
        {decoded && !isUla && decoded.format === "standard" && (() => {
          const d = decoded;
          const stdDesc = desc as typeof desc & { usesGPR?: boolean; usesOperand?: boolean };
          return (
            <>
              {stdDesc?.usesGPR && <Field label="gprAddr" value={`R${d.gprAddr}`} />}
              {stdDesc?.usesOperand && <Field label="operand" value={hex16(d.operand)} />}
            </>
          );
        })()}

        {decoded && isUla && decoded.format === "ula" && (() => {
          const d = decoded;
          const ulaDesc = desc as typeof desc & { usesSrcB?: boolean };
          return (
            <>
              <Field label="src A" value={`R${d.srcA}`} />
              {ulaDesc?.usesSrcB && <Field label="src B" value={`R${d.srcB}`} />}
              <Field label="dst" value={`R${d.dst}`} />
            </>
          );
        })()}
      </div>
    </NodeShell>
  );
}
