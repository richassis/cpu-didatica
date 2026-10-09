"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import NodeShell from "@/components/widgets/NodeShell";
import { Opcode, formatOpcodeBits, lookupInstruction } from "@/lib/simulator/ISA";

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
          <span className="font-mono text-cv-md font-medium">
            {dec ? (lookupInstruction(op)?.mnemonic ?? "???") : "HLT"}
          </span>
          <span className="num mt-1 font-mono text-cv-xs text-fg-faint">{formatOpcodeBits(op)}</span>
        </span>
      }
    />
  );
}
