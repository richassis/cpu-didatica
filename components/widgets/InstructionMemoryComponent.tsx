"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useLayoutStore, Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import React from "react";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";

function addrHex(addr: number, addrBits: number): string {
  const digits = Math.ceil(addrBits / 4);
  return "0x" + addr.toString(16).toUpperCase().padStart(digits, "0");
}

type ViewMode = "data" | "ports";

export default function InstructionMemoryComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("data");

  const revision  = useSimulatorStore((s) => s.revision);
  const mem       = useSimulatorStore((s) => s.getInstructionMemory(id));
  const base      = useDisplayStore((s) => s.numericBase);
  void revision;

  const wordCount  = mem?.wordCount ?? 256;
  const bitWidth   = mem?.bitWidth  ?? 16;
  const addrBits   = Math.max(1, Math.ceil(Math.log2(wordCount)));
  const addr       = mem ? mem.in_addr.value : 0;
  const instruction= mem ? mem.output : 0;

  const addrFmt   = addrHex(addr, addrBits);
  const instrFmt  = formatNum(instruction, base, bitWidth);

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

  const borderCls = isDragging
    ? "border-blue-400"
    : "border-blue-700/60";

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        data-draggable
        className={`select-none cursor-grab active:cursor-grabbing relative rounded-xl border-2 ${borderCls} bg-gray-950/90`}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-2 py-1 bg-blue-900/70 border-b border-blue-700/40">
          <span className="text-[11px] font-bold text-blue-200 truncate leading-none">
            {label}
          </span>
          <div className="flex items-center gap-1">
            {/* Toggle view mode */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setViewMode(viewMode === "data" ? "ports" : "data"); }}
              className={`text-[9px] leading-none px-1.5 py-0.5 rounded transition-colors ${
                viewMode === "ports"
                  ? "bg-blue-500 text-black"
                  : "text-blue-300/60 hover:text-blue-100"
              }`}
              title={viewMode === "data" ? "Show I/O ports" : "Show memory data"}
            >
              {viewMode === "data" ? "I/O" : "MEM"}
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
              className="text-blue-300/50 hover:text-white text-[10px] leading-none ml-1"
              aria-label="Remove"
            >✕</button>
          </div>
        </div>

        {/* ── Body ── */}
        {viewMode === "ports" ? (
          /* Port I/O view */
          <div className="flex flex-col gap-1.5 px-2 py-2 text-[10px] font-mono" style={{ height: h - 28 }}>
            {/* Read-only badge */}
            <div className="flex items-center justify-center mb-1">
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-blue-500 text-black font-bold">
                READ ONLY
              </span>
            </div>

            {/* Address */}
            <div className="flex items-center justify-between">
              <span className="text-blue-400/70 uppercase tracking-wide text-[9px]">addr</span>
              <span className="text-blue-100 bg-blue-900/50 rounded px-1 py-px">
                {addrFmt}
              </span>
            </div>

            {/* Instruction output */}
            <div className="flex items-center justify-between">
              <span className="text-blue-300/70 uppercase tracking-wide text-[9px]">instruction</span>
              <span className="text-blue-100 bg-blue-800/70 rounded px-1 py-px font-bold">
                {instrFmt}
              </span>
            </div>

            {/* Current cell preview */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-[9px] text-gray-500 text-center mb-1">Cell @ {addrFmt}</div>
              <div className="text-center text-sm font-mono rounded py-1 bg-blue-900/50 text-blue-100">
                {formatNum(mem?.peek(addr) ?? 0, base, bitWidth)}
              </div>
            </div>

            {/* Capacity footer */}
            <div className="flex justify-between text-[8px] text-gray-600 border-t border-gray-800 pt-1">
              <span>{wordCount} words</span>
              <span>{bitWidth}b</span>
            </div>
          </div>
        ) : (
          /* Default data view: showing all instructions */
          <div className="flex flex-col overflow-y-auto" style={{ height: h - 28 }}>
            <div className="flex flex-col gap-px px-2 py-1.5">
              {Array.from({ length: wordCount }).map((_, a) => (
                <InstructionDataRow
                  key={a}
                  addr={a}
                  value={mem?.peek(a) ?? 0}
                  bitWidth={bitWidth}
                  addrBits={addrBits}
                  base={base}
                  isActive={a === addr}
                />
              ))}
            </div>
          </div>
        )}

        {/* Port indicators */}
        <PortsOverlay componentId={id} />
      </div>

      {configOpen && (
        <ConfigModal component={component} onClose={() => setConfigOpen(false)} />
      )}
    </>
  );
}

/* ─── Instruction data row (read-only display) ──────────────────────────────────── */

interface DataRowProps {
  addr: number;
  value: number;
  bitWidth: number;
  addrBits: number;
  base: import("@/lib/displayStore").NumericBase;
  isActive: boolean;
}

function InstructionDataRow({ addr, value, bitWidth, addrBits, base, isActive }: DataRowProps) {
  const displayed = formatNum(value, base, bitWidth);

  return (
    <div className={`flex items-center justify-between py-0.5 px-0.5 rounded ${
      isActive ? "bg-blue-700/40" : ""
    }`}>
      <span className={`text-[9px] font-mono ${isActive ? "text-blue-300 font-semibold" : "text-gray-600"}`}>
        {addrHex(addr, addrBits)}
      </span>
      <span className={`text-[10px] font-mono ${isActive ? "text-blue-100" : "text-gray-400"}`}>
        {displayed}
      </span>
    </div>
  );
}
