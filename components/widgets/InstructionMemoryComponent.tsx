"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import NodeShell from "@/components/widgets/NodeShell";
import InstructionBuilder from "@/components/InstructionBuilder";
import { INSTRUCTION_SET } from "@/lib/simulator/ISA";

const WINDOW = 3;

function decodeWord(word: number): string {
  if (word === 0) return "NOP";
  const opcode = (word >>> 11) & 0x1f;
  const entry = Object.values(INSTRUCTION_SET).find((d) => d.opcode === opcode);
  return entry ? entry.mnemonic : "???";
}

function fmtAddr(addr: number, addrBits: number) {
  return "0x" + addr.toString(16).toUpperCase().padStart(Math.ceil(addrBits / 4), "0");
}

/**
 * Instruction memory. Same shape family as data memory — a spine and an
 * address list — because they are the same class of thing; what differs is
 * that the values read as mnemonics. Click a row to edit that word.
 */
export default function InstructionMemoryComponent({ component, zoom }: Props) {
  const { id } = component;
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(0);

  const revision = useSimulatorStore((s) => s.revision);
  const imem = useSimulatorStore((s) => s.getInstructionMemory(id));
  void revision;

  const wordCount = imem?.wordCount ?? 256;
  const addrBits = Math.max(1, Math.ceil(Math.log2(wordCount)));
  const currentAddr = imem?.in_addr.value ?? 0;

  const startIdx = Math.max(0, currentAddr - WINDOW);
  const endIdx = Math.min(wordCount - 1, currentAddr + WINDOW);
  const windowRows = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => startIdx + i);

  return (
    <>
      <NodeShell
        component={component}
        zoom={zoom}
        sequential
        spine
        actions={
          <span className="num shrink-0 font-mono text-[10px] text-fg-muted">
            {fmtAddr(currentAddr, addrBits)}
          </span>
        }
      >
        <div className="flex flex-1 flex-col justify-center gap-px overflow-hidden px-1.5 py-1 pl-3">
          {startIdx > 0 && (
            <div className="py-0.5 text-center font-mono text-[9px] text-fg-faint">
              + {startIdx} above
            </div>
          )}

          {windowRows.map((a) => {
            const isCurrent = a === currentAddr;
            return (
              <div
                key={a}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAddress(a);
                  setBuilderOpen(true);
                }}
                className="flex cursor-pointer items-center gap-1.5 rounded px-1 transition-colors"
                style={{
                  paddingBlock: isCurrent ? 5 : 2,
                  background: isCurrent
                    ? "color-mix(in srgb, var(--st-data) 8%, transparent)"
                    : undefined,
                }}
              >
                <span
                  className={`shrink-0 font-mono text-[9px] leading-none ${
                    isCurrent ? "text-fg" : "text-transparent"
                  }`}
                >
                  ▶
                </span>
                <span className="num shrink-0 font-mono text-[10px] text-fg-faint">
                  {fmtAddr(a, addrBits)}
                </span>
                <span
                  className={`flex-1 text-right font-mono ${
                    isCurrent ? "text-[13px] text-fg" : "text-[9px] text-fg-muted"
                  }`}
                >
                  {decodeWord(imem?.peek(a) ?? 0)}
                </span>
              </div>
            );
          })}

          {endIdx < wordCount - 1 && (
            <div className="py-0.5 text-center font-mono text-[9px] text-fg-faint">
              + {wordCount - 1 - endIdx} below
            </div>
          )}
        </div>
      </NodeShell>

      {builderOpen &&
        imem &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setBuilderOpen(false)}
            />
            <div className="relative z-10">
              <InstructionBuilder
                imem={imem}
                onClose={() => setBuilderOpen(false)}
                initialAddress={selectedAddress}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
