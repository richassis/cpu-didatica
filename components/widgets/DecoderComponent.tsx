"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import NodeShell from "@/components/widgets/NodeShell";
import { Opcode, INSTRUCTION_SET } from "@/lib/simulator/ISA";
import type { Decoder } from "@/lib/simulator/Decoder";

function bin5(n: number) {
  return n.toString(2).padStart(5, "0");
}

function getMnemonic(dec: Decoder): string {
  const op = dec.opcode as Opcode;
  const entry = Object.values(INSTRUCTION_SET).find((d) => d.opcode === op);
  return entry ? entry.mnemonic : "???";
}

/**
 * The decoder, drawn as a thin vertical bar: the instruction word in on the
 * left, the sliced-out fields out on the right. It is plumbing between the IR
 * and the rest of the datapath — the decoded fields it produces are read off
 * the wires leaving it, not off the block — so it stays narrow and quiet
 * rather than competing with the ALU and the register bank for attention.
 *
 * Headline: the decoded mnemonic, with the raw opcode bits under it.
 */
export default function DecoderComponent({ component, zoom }: Props) {
  const revision = useSimulatorStore((s) => s.revision);
  const dec = useSimulatorStore((s) => s.getDecoder(component.id));
  void revision;

  const op = dec ? (dec.opcode as Opcode) : Opcode.HLT;

  return (
    <NodeShell
      component={component}
      zoom={zoom}
      value={
        <span className="flex flex-col items-center leading-none">
          <span className="font-mono text-[13px] font-medium">
            {dec ? getMnemonic(dec) : "HLT"}
          </span>
          <span className="num mt-1 font-mono text-[9px] text-fg-faint">{bin5(op)}</span>
        </span>
      }
    />
  );
}
