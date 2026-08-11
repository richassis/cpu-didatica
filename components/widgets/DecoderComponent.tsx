"use client";
import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Props } from "@/lib/store";
import { useRevealState, revealStyle } from "@/lib/useRevealState";
import { useSimulatorStore } from "@/lib/simulatorStore";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";
import { Opcode, INSTRUCTION_SET } from "@/lib/simulator/ISA";
import type { Decoder } from "@/lib/simulator/Decoder";

function hex16(n: number) { return `0x${n.toString(16).toUpperCase().padStart(4, "0")}`; }
function bin5(n: number)  { return n.toString(2).padStart(5, "0"); }

function getMnemonic(dec: Decoder): string {
  const op = dec.opcode as Opcode;
  const entry = Object.values(INSTRUCTION_SET).find((d) => d.opcode === op);
  return entry ? entry.mnemonic : "???";
}

function Field({ label, value, accent = "text-yellow-200" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-1 px-2 py-[4px] odd:bg-gray-800/30 rounded-sm">
      <span className="text-[10px] text-gray-500 font-mono w-14 shrink-0">{label}</span>
      <span className={`text-[11px] font-mono font-semibold ${accent}`}>{value}</span>
    </div>
  );
}

export default function DecoderComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const revealStatus = useRevealState(id);
  const [configOpen, setConfigOpen] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const dec = useSimulatorStore((s) => s.getDecoder(id));
  void revision;
  const isRevealed = revealStatus === "revealed";

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const correctedTransform = transform
    ? { ...transform, x: transform.x / zoom, y: transform.y / zoom }
    : null;
  const style: CSSProperties = {
    position: "absolute", left: x, top: y, width: w, height: h,
    transform: CSS.Translate.toString(correctedTransform),
    zIndex: isDragging ? 50 : 10, touchAction: "none",
  };

  const instr = dec?.instruction ?? 0;
  const op = dec ? (dec.opcode as Opcode) : Opcode.HLT;
  const opMnem = dec ? getMnemonic(dec) : "HLT";
  const decoded = dec?.decoded ?? null;
  const desc = decoded ? INSTRUCTION_SET[decoded.mnemonic as keyof typeof INSTRUCTION_SET] : null;
  const isUla = desc?.format === "ula";

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, ...revealStyle(revealStatus) }}
        {...listeners} {...attributes}
        data-draggable
        className={`select-none cursor-grab active:cursor-grabbing rounded-xl overflow-hidden flex flex-col
          border transition-all duration-200 bg-[#0a0a14]
          ${isDragging ? "border-yellow-400" : isRevealed ? "border-yellow-600/60" : "border-yellow-900/40"}`}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* Header strip */}
        <div className={`shrink-0 flex items-center justify-between px-2 py-1.5 border-b
          ${isRevealed ? "bg-yellow-900/40 border-yellow-700/30" : "bg-yellow-950/50 border-yellow-900/20"}`}
        >
          <span className="text-[10px] font-bold text-yellow-500/70 tracking-widest uppercase font-mono">{label}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
            className="text-yellow-600/40 hover:text-yellow-300 text-[9px] leading-none"
          >⚙</button>
        </div>

        {/* BIG mnemonic section */}
        <div className={`shrink-0 flex flex-col items-center justify-center py-3 border-b
          ${isRevealed ? "border-yellow-800/30" : "border-gray-800/40"}`}
        >
          <span className={`font-mono font-black tracking-wider transition-all
            ${isRevealed ? "text-[22px] text-yellow-200" : "text-[20px] text-yellow-600/50"}`}
          >
            {opMnem}
          </span>
          <span className="text-[9px] font-mono text-gray-600 mt-0.5">
            {bin5(op)} · {hex16(instr)}
          </span>
        </div>

        {/* Field breakdown */}
        <div className="flex-1 overflow-y-auto py-0.5">
          {!decoded && (
            <div className="px-2 py-2 text-[10px] text-gray-600 italic text-center">no decode yet</div>
          )}
          {decoded && !isUla && decoded.format === "standard" && (() => {
            const d = decoded;
            const stdDesc = desc as typeof desc & { usesGPR?: boolean; usesOperand?: boolean };
            return (
              <>
                {stdDesc?.usesGPR && <Field label="gprAddr" value={`R${d.gprAddr}`} accent="text-cyan-300" />}
                {stdDesc?.usesOperand && <Field label="operand" value={hex16(d.operand)} accent="text-yellow-200" />}
              </>
            );
          })()}
          {decoded && isUla && decoded.format === "ula" && (() => {
            const d = decoded;
            const ulaDesc = desc as typeof desc & { usesSrcB?: boolean };
            return (
              <>
                <Field label="src A" value={`R${d.srcA}`} accent="text-cyan-300" />
                {ulaDesc?.usesSrcB && <Field label="src B" value={`R${d.srcB}`} accent="text-cyan-300" />}
                <Field label="dst" value={`R${d.dst}`} accent="text-emerald-300" />
              </>
            );
          })()}
        </div>

        {/* Description footer */}
        {desc && (
          <div className="shrink-0 px-2 py-1.5 border-t border-gray-800/40">
            <span className="text-[9px] text-gray-500 italic leading-snug block">{desc.description}</span>
          </div>
        )}

        <PortsOverlay componentId={id} />
      </div>
      {configOpen && <ConfigModal component={component} onClose={() => setConfigOpen(false)} />}
    </>
  );
}
