"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import React from "react";
import ConfigModal from "@/components/ConfigModal";
import { Opcode, INSTRUCTION_SET } from "@/lib/simulator/ISA";
import type { Decoder } from "@/lib/simulator/Decoder";

// ── helpers ──────────────────────────────────────────────────────────────────

function hex8(n: number)  { return `0x${n.toString(16).toUpperCase().padStart(2, "0")}`; }
function hex16(n: number) { return `0x${n.toString(16).toUpperCase().padStart(4, "0")}`; }
function bin5(n: number)  { return `${n.toString(2).padStart(5, "0")}`; }

/** Map opcode enum value → mnemonic string */
function mnemonic(dec: Decoder): string {
  const op = dec.opcode as Opcode;
  const entry = Object.values(INSTRUCTION_SET).find((d) => d.opcode === op);
  return entry ? entry.mnemonic : "???";
}

// ── field row ─────────────────────────────────────────────────────────────────
function Row({
  label,
  value,
  accent = "text-cyan-300",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-1 px-2 py-[3px] odd:bg-gray-800/50">
      <span className="text-[10px] text-gray-400 font-mono shrink-0 w-16 truncate">{label}</span>
      <span className={`text-[10px] font-mono font-semibold ${accent} text-right`}>{value}</span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function DecoderComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const [configOpen, setConfigOpen] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const dec      = useSimulatorStore((s) => s.getDecoder(id));
  void revision;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });

  const correctedTransform = transform
    ? { ...transform, x: transform.x / zoom, y: transform.y / zoom }
    : null;

  const style: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    transform: CSS.Translate.toString(correctedTransform),
    zIndex: isDragging ? 50 : 10,
    touchAction: "none",
  };

  // ── derived display values ─────────────────────────────────────────────────
  const instr    = dec ? dec.instruction   : 0;
  const op       = dec ? (dec.opcode as Opcode) : Opcode.HLT;
  const opMnem   = dec ? mnemonic(dec)     : "HLT";
  const decoded  = dec ? dec.decoded       : null;

  // Figure out instruction format from the INSTRUCTION_SET
  const desc     = decoded
    ? INSTRUCTION_SET[decoded.mnemonic as keyof typeof INSTRUCTION_SET]
    : null;
  const isUla    = desc?.format === "ula";

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`
          select-none cursor-grab active:cursor-grabbing
          rounded-lg border-2 flex flex-col overflow-hidden
          bg-gray-900 transition-colors
          ${isDragging
            ? "border-yellow-400 shadow-2xl opacity-90"
            : "border-yellow-700/70 shadow-md"}
        `}
        onContextMenu={(e) => e.stopPropagation()}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* ── Top accent bar ── */}
        <div className="bg-yellow-700/40 px-2 py-1 flex items-center justify-between shrink-0 border-b border-yellow-700/30">
          <div className="flex items-center gap-1.5">
            {/* Vertical "bar" motif */}
            <div className="flex gap-[2px] items-end h-4">
              {[4, 7, 5, 8, 6, 7, 4].map((h, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-sm bg-yellow-400/80"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
            <span className="text-[11px] font-bold text-yellow-300 tracking-wide uppercase">
              {label}
            </span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
            className="text-yellow-500/60 hover:text-yellow-200 text-xs leading-none"
            aria-label="Configure"
          >
            ⚙
          </button>
        </div>

        {/* ── Field rows ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Raw instruction */}
          <Row label="IR" value={hex16(instr)} accent="text-yellow-200" />

          {/* Binary breakdown header */}
          <div className="px-2 py-0.5 text-[9px] text-gray-600 font-mono tracking-widest border-t border-gray-800">
            15────────11·10──8·7──────0
          </div>

          {/* Opcode */}
          <Row
            label="OPCODE"
            value={`${bin5(op)} (${opMnem})`}
            accent="text-orange-300"
          />

          {/* Format-specific fields */}
          {!decoded && (
            <Row label="—" value="no decode yet" accent="text-gray-600" />
          )}

          {decoded && !isUla && decoded.format === "standard" && (() => {
            const d = decoded;
            const stdDesc = desc as (typeof INSTRUCTION_SET)[keyof typeof INSTRUCTION_SET] & { usesGPR?: boolean; usesOperand?: boolean };
            return (
              <>
                {stdDesc.usesGPR && (
                  <Row label="GPR addr" value={`R${d.gprAddr}`} accent="text-cyan-300" />
                )}
                {stdDesc.usesOperand && (
                  <Row label="operand" value={hex8(d.operand)} accent="text-cyan-200" />
                )}
              </>
            );
          })()}

          {decoded && isUla && decoded.format === "ula" && (() => {
            const d = decoded;
            const ulaDesc = desc as (typeof INSTRUCTION_SET)[keyof typeof INSTRUCTION_SET] & { usesSrcB?: boolean };
            return (
              <>
                <Row label="srcA"  value={`R${d.srcA}`} accent="text-lime-300" />
                {ulaDesc.usesSrcB && (
                  <Row label="srcB" value={`R${d.srcB}`} accent="text-lime-300" />
                )}
                <Row label="dst"   value={`R${d.dst}`}  accent="text-lime-200" />
              </>
            );
          })()}
        </div>

        {/* ── Bottom: instruction description ── */}
        {desc && (
          <div className="shrink-0 px-2 py-1 border-t border-gray-800 bg-gray-900/80">
            <span className="text-[9px] text-gray-500 italic leading-tight block truncate">
              {desc.description}
            </span>
          </div>
        )}
      </div>

      {configOpen && (
        <ConfigModal component={component} onClose={() => setConfigOpen(false)} />
      )}
    </>
  );
}
