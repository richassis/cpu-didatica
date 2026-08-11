"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Props } from "@/lib/store";
import { useRevealState, revealStyle } from "@/lib/useRevealState";
import { useSimulatorStore } from "@/lib/simulatorStore";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";
import InstructionBuilder from "@/components/InstructionBuilder";
import type { InstructionMemory } from "@/lib/simulator/InstructionMemory";
import { INSTRUCTION_SET } from "@/lib/simulator/ISA";

const WINDOW = 3;

function decodeWord(word: number): string {
  if (word === 0) return "NOP";
  const opcode = (word >>> 11) & 0x1F;
  const entry = Object.values(INSTRUCTION_SET).find((d) => d.opcode === opcode);
  return entry ? entry.mnemonic : "???";
}

function fmtAddr(addr: number, addrBits: number) {
  return "0x" + addr.toString(16).toUpperCase().padStart(Math.ceil(addrBits / 4), "0");
}

export default function InstructionMemoryComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const revealStatus = useRevealState(id);
  const [configOpen, setConfigOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(0);

  const revision = useSimulatorStore((s) => s.revision);
  const imem = useSimulatorStore((s) => s.getInstructionMemory(id));
  void revision;

  const wordCount = imem?.wordCount ?? 256;
  const addrBits = Math.max(1, Math.ceil(Math.log2(wordCount)));
  const currentAddr = imem?.in_addr.value ?? 0;
  const isRevealed = revealStatus === "revealed";

  const startIdx = Math.max(0, currentAddr - WINDOW);
  const endIdx = Math.min(wordCount - 1, currentAddr + WINDOW);
  const windowRows = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => startIdx + i);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const correctedTransform = transform
    ? { ...transform, x: transform.x / zoom, y: transform.y / zoom }
    : null;
  const style: CSSProperties = {
    position: "absolute", left: x, top: y, width: w, height: h,
    transform: CSS.Translate.toString(correctedTransform),
    zIndex: isDragging ? 50 : 10, touchAction: "none",
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, ...revealStyle(revealStatus) }}
        {...listeners} {...attributes}
        data-draggable
        className={`select-none cursor-grab active:cursor-grabbing relative rounded-xl overflow-hidden flex flex-col
          border transition-all duration-200 bg-[#0a0a14]
          ${isDragging ? "border-violet-400" : isRevealed ? "border-violet-600/60" : "border-violet-900/40"}`}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between px-2 py-1.5 border-b
          ${isRevealed ? "bg-violet-900/40 border-violet-700/30" : "bg-violet-950/50 border-violet-900/20"}`}
        >
          <span className="text-[10px] font-bold text-violet-400/80 tracking-widest uppercase font-mono">{label || "IMEM"}</span>
          <span className={`text-[10px] font-mono ${isRevealed ? "text-violet-200" : "text-violet-600"}`}>
            PC:{fmtAddr(currentAddr, addrBits)}
          </span>
        </div>

        {/* Sliding window */}
        <div className="flex-1 flex flex-col justify-center px-1.5 py-1 gap-px overflow-hidden">
          {startIdx > 0 && (
            <div className="text-center text-[8px] text-gray-700 font-mono py-0.5">↑ {startIdx} above</div>
          )}
          {windowRows.map((a) => {
            const isCurrent = a === currentAddr;
            const val = imem?.peek(a) ?? 0;
            const mnem = decodeWord(val);
            return (
              <div
                key={a}
                onClick={(e) => { e.stopPropagation(); setSelectedAddress(a); setBuilderOpen(true); }}
                className={`flex items-center gap-2 px-1.5 rounded cursor-pointer transition-colors duration-100
                  ${isCurrent ? "bg-violet-900/40 py-[5px]" : "py-[2px] hover:bg-violet-900/10"}`}
              >
                {isCurrent && <span className="text-[9px] font-bold text-violet-400 leading-none shrink-0">▶</span>}
                <span className={`font-mono shrink-0 ${isCurrent ? "text-[11px] text-violet-300 font-semibold" : "text-[10px] text-gray-600"}`}>
                  {fmtAddr(a, addrBits)}
                </span>
                {isCurrent ? (
                  <span className="flex-1 text-right font-mono text-[13px] font-bold text-violet-100">{mnem}</span>
                ) : (
                  <span className="flex-1 text-right font-mono text-[9px] text-gray-600">{mnem}</span>
                )}
              </div>
            );
          })}
          {endIdx < wordCount - 1 && (
            <div className="text-center text-[8px] text-gray-700 font-mono py-0.5">↓ {wordCount - 1 - endIdx} below</div>
          )}
        </div>

        <div className="shrink-0 px-2 py-1 border-t border-gray-800/30 text-[8px] text-gray-700 text-center font-mono">
          click to edit
        </div>

        <PortsOverlay componentId={id} />
      </div>

      {configOpen && <ConfigModal component={component} onClose={() => setConfigOpen(false)} />}
      {builderOpen && imem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setBuilderOpen(false)} />
          <div className="relative z-10">
            <InstructionBuilder imem={imem} onClose={() => setBuilderOpen(false)} initialAddress={selectedAddress} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
