"use client";

import { useState, useRef } from "react";
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

export default function MemoryComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const revision  = useSimulatorStore((s) => s.revision);
  const mem       = useSimulatorStore((s) => s.getMemory(id));
  const pokeMemory = useSimulatorStore((s) => s.pokeMemory);
  const base      = useDisplayStore((s) => s.numericBase);
  void revision;

  const wordCount  = mem?.wordCount ?? 256;
  const bitWidth   = mem?.bitWidth  ?? 16;
  const addrBits   = Math.max(1, Math.ceil(Math.log2(wordCount)));
  const addr       = mem ? mem.in_addr.value  : 0;
  const rdMem      = mem ? mem.in_rdMem.value : 0;
  const wrMem      = mem ? mem.in_wrMem.value : 0;
  const dataIn     = mem ? mem.in_data.value  : 0;
  const dataOut    = mem ? mem.output         : 0;

  const addrFmt   = addrHex(addr, addrBits);
  const dataInFmt = formatNum(dataIn,  base, bitWidth);
  const dataOutFmt= formatNum(dataOut, base, bitWidth);
  const lastAddr  = wordCount - 1;

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

  // Active-access highlight colour
  const accessing = rdMem !== 0 || wrMem !== 0;
  const borderCls = isDragging
    ? "border-amber-400"
    : wrMem !== 0
    ? "border-orange-500"
    : rdMem !== 0
    ? "border-amber-400"
    : "border-amber-700/60";

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        data-draggable
        className={`select-none cursor-grab active:cursor-grabbing relative rounded-xl border-2 ${
          accessing ? "shadow-lg shadow-amber-900/40" : ""
        } ${borderCls} bg-gray-950/90`}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-2 py-1 bg-amber-900/70 border-b border-amber-700/40">
          <span className="text-[11px] font-bold text-amber-200 truncate leading-none">
            {label}
          </span>
          <div className="flex items-center gap-1">
            {/* control-signal badges */}
            <span className={`text-[8px] font-mono px-1 rounded leading-tight ${
              rdMem ? "bg-amber-500 text-black" : "bg-gray-700 text-gray-400"
            }`}>RD</span>
            <span className={`text-[8px] font-mono px-1 rounded leading-tight ${
              wrMem ? "bg-orange-500 text-black" : "bg-gray-700 text-gray-400"
            }`}>WR</span>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setEditMode((v) => !v); }}
              className={`text-[10px] leading-none px-1 rounded transition-colors ${
                editMode
                  ? "bg-amber-500 text-black"
                  : "text-amber-300/50 hover:text-amber-100"
              }`}
              aria-label={editMode ? "Exit edit mode" : "Edit memory cells"}
              title={editMode ? "Exit edit mode" : "Edit memory cells"}
            >✏</button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
              className="text-amber-300/50 hover:text-white text-[10px] leading-none ml-1"
              aria-label="Remove"
            >✕</button>
          </div>
        </div>

        {/* ── Body ── */}
        {editMode ? (
          /* Edit mode: scrollable table of all cells */
          <div
            className="overflow-y-auto px-2 py-1.5 text-[10px] font-mono"
            style={{ height: h - 28 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-px">
              {Array.from({ length: wordCount }).map((_, a) => (
                <MemoryCellRow
                  key={a}
                  addr={a}
                  value={mem?.peek(a) ?? 0}
                  bitWidth={bitWidth}
                  addrBits={addrBits}
                  base={base}
                  isActive={a === addr}
                  onPoke={(a2, v) => pokeMemory(id, a2, v)}
                />
              ))}
            </div>
          </div>
        ) : (
        <div className="flex flex-col gap-1.5 px-2 py-2 text-[10px] font-mono">

          {/* Address */}
          <div className="flex items-center justify-between">
            <span className="text-amber-400/70 uppercase tracking-wide text-[9px]">addr</span>
            <span className="text-amber-100 bg-amber-900/50 rounded px-1 py-px">
              {addrFmt}
            </span>
          </div>

          {/* Data-in */}
          <div className="flex items-center justify-between">
            <span className="text-orange-400/70 uppercase tracking-wide text-[9px]">data in</span>
            <span className={`rounded px-1 py-px ${
              wrMem ? "text-orange-100 bg-orange-900/60" : "text-gray-500 bg-gray-800/60"
            }`}>
              {dataInFmt}
            </span>
          </div>

          {/* Divider / cell strip */}
          <div className="w-full flex flex-col gap-px my-0.5">
            {Array.from({ length: 4 }).map((_, i) => {
              const a = addr - 1 + i;
              const inRange = a >= 0 && a < wordCount;
              const isActive = inRange && a === addr;
              return (
                <div
                  key={i}
                  className={`h-2 rounded-sm border text-[7px] leading-tight flex items-center justify-between px-1 ${
                    isActive
                      ? "bg-amber-700/70 border-amber-500"
                      : "bg-gray-800/60 border-gray-700/40"
                  }`}
                >
                  {inRange && (
                    <>
                      <span className="text-gray-500">{addrHex(a, addrBits)}</span>
                      <span className={isActive ? "text-amber-200" : "text-gray-600"}>
                        {formatNum(mem?.peek(a) ?? 0, base, bitWidth)}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
            <span className="text-[8px] text-gray-600 text-center">···</span>
          </div>

          {/* Data-out */}
          <div className="flex items-center justify-between">
            <span className="text-amber-300/70 uppercase tracking-wide text-[9px]">out</span>
            <span className={`rounded px-1 py-px ${
              rdMem ? "text-amber-100 bg-amber-800/70 font-bold" : "text-gray-500 bg-gray-800/60"
            }`}>
              {dataOutFmt}
            </span>
          </div>

          {/* Capacity footer */}
          <div className="flex justify-between text-[8px] text-gray-600 border-t border-gray-800 pt-1 mt-0.5">
            <span>{wordCount} words</span>
            <span>{bitWidth}b</span>
            <span>{addrHex(0, addrBits)}–{addrHex(lastAddr, addrBits)}</span>
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

/* ─── Memory cell row for edit mode ──────────────────────────────────── */

interface CellRowProps {
  addr: number;
  value: number;
  bitWidth: number;
  addrBits: number;
  base: number;
  isActive: boolean;
  onPoke: (addr: number, value: number) => void;
}

function MemoryCellRow({ addr, value, bitWidth, addrBits, base, isActive, onPoke }: CellRowProps) {
  const displayed = formatNum(value, base, bitWidth);
  const inputRef  = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    const trimmed = raw.trim();
    let parsed: number;
    if (/^0x/i.test(trimmed))      parsed = parseInt(trimmed, 16);
    else if (/^0b/i.test(trimmed)) parsed = parseInt(trimmed.slice(2), 2);
    else if (/^0o/i.test(trimmed)) parsed = parseInt(trimmed.slice(2), 8);
    else                           parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed)) onPoke(addr, parsed);
    setDraft(null);
  }

  return (
    <div className={`flex items-center gap-1 py-px px-0.5 rounded ${
      isActive ? "bg-amber-700/40" : ""
    }`}>
      <span className={`shrink-0 text-[9px] ${isActive ? "text-amber-300" : "text-gray-600"}`}>
        {addrHex(addr, addrBits)}
      </span>
      <input
        ref={inputRef}
        type="text"
        className={`flex-1 min-w-0 rounded text-[9px] font-mono px-1 py-px focus:outline-none
                    border ${isActive
                      ? "bg-amber-900/60 border-amber-600/60 text-amber-100 focus:border-amber-400"
                      : "bg-gray-800/60 border-gray-700/40 text-gray-300 focus:border-gray-500"
                    }`}
        value={draft ?? displayed}
        onFocus={() => setDraft(draft ?? displayed)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter")  { commit((e.target as HTMLInputElement).value); inputRef.current?.blur(); }
          if (e.key === "Escape") { setDraft(null); inputRef.current?.blur(); }
        }}
      />
    </div>
  );
}