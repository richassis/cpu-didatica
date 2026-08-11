"use client";
import { useState, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Props } from "@/lib/store";
import { useRevealState, revealStyle } from "@/lib/useRevealState";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum, type NumericBase } from "@/lib/displayStore";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";

const WINDOW = 3; // rows above and below active address

function fmtAddr(addr: number, addrBits: number) {
  return "0x" + addr.toString(16).toUpperCase().padStart(Math.ceil(addrBits / 4), "0");
}

export default function MemoryComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const revealStatus = useRevealState(id);
  const [configOpen, setConfigOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const mem = useSimulatorStore((s) => s.getMemory(id));
  const pokeMemory = useSimulatorStore((s) => s.pokeMemory);
  const base = useDisplayStore((s) => s.numericBase);
  void revision;

  const wordCount = mem?.wordCount ?? 256;
  const bitWidth = mem?.bitWidth ?? 16;
  const addrBits = Math.max(1, Math.ceil(Math.log2(wordCount)));
  const addr = mem?.in_addr.value ?? 0;
  const rdMem = (mem?.in_rdMem.value ?? 0) !== 0;
  const wrMem = (mem?.in_wrMem.value ?? 0) !== 0;
  const dataIn = mem?.in_data.value ?? 0;
  const dataOut = mem?.output ?? 0;
  const accessing = rdMem || wrMem;
  const isRevealed = revealStatus === "revealed";

  // Sliding window indices
  const startIdx = Math.max(0, addr - WINDOW);
  const endIdx = Math.min(wordCount - 1, addr + WINDOW);
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

  const borderCls = isDragging ? "border-amber-400"
    : isRevealed && accessing ? "border-amber-500/80"
    : isRevealed ? "border-amber-700/60"
    : "border-amber-900/40";

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, ...revealStyle(revealStatus) }}
        {...listeners} {...attributes}
        data-draggable
        className={`select-none cursor-grab active:cursor-grabbing relative rounded-xl overflow-hidden flex flex-col
          border transition-all duration-200 bg-[var(--widget-surface)] ${borderCls}`}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between px-2 py-1.5 border-b
          ${isRevealed && accessing ? "bg-amber-900/50 border-amber-700/40" : "bg-amber-950/50 border-amber-900/20"}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-400/80 tracking-widest uppercase font-mono">{label}</span>
            {rdMem && <span className="text-[9px] font-bold text-amber-300 bg-amber-800/60 border border-amber-600/40 rounded px-1.5 leading-4">RD</span>}
            {wrMem && <span className="text-[9px] font-bold text-orange-200 bg-orange-800/60 border border-orange-600/40 rounded px-1.5 leading-4">WR</span>}
          </div>
          <div className="flex items-center gap-1">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setEditMode((v) => !v); }}
              className={`text-[10px] leading-none px-1 rounded transition-colors ${editMode ? "bg-amber-500 text-black" : "text-amber-400/40 hover:text-amber-200"}`}
              title={editMode ? "Exit edit" : "Edit all cells"}
            >✏</button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
              className="text-amber-600/40 hover:text-amber-300 text-[9px] leading-none"
            >⚙</button>
          </div>
        </div>

        {editMode ? (
          /* Full edit table */
          <div
            className="flex-1 overflow-y-auto px-1.5 py-1"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {Array.from({ length: wordCount }).map((_, a) => (
              <EditRow
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
        ) : (
          <>
            {/* Sliding window table */}
            <div className="flex-1 flex flex-col justify-center px-1.5 py-1 gap-px">
              {startIdx > 0 && (
                <div className="text-center text-[8px] text-gray-700 font-mono py-0.5">↑ {startIdx} above</div>
              )}
              {windowRows.map((a) => {
                const isActive = a === addr;
                const val = mem?.peek(a) ?? 0;
                return (
                  <div
                    key={a}
                    className={`flex items-center gap-2 px-1.5 rounded transition-colors duration-100
                      ${isActive
                        ? wrMem
                          ? "bg-orange-900/40 py-[5px]"
                          : rdMem
                          ? "bg-amber-900/40 py-[5px]"
                          : "bg-amber-900/20 py-[5px]"
                        : "py-[2px]"
                      }`}
                  >
                    {isActive && (
                      <span className={`text-[9px] font-bold leading-none shrink-0 ${wrMem ? "text-orange-400" : "text-amber-400"}`}>▶</span>
                    )}
                    <span className={`font-mono shrink-0 ${isActive ? "text-[11px] text-amber-300 font-semibold" : "text-[10px] text-gray-600"}`}>
                      {fmtAddr(a, addrBits)}
                    </span>
                    <span className={`flex-1 text-right font-mono ${isActive ? "text-[13px] font-bold text-amber-100" : "text-[10px] text-gray-500"}`}>
                      {formatNum(val, base, bitWidth)}
                    </span>
                  </div>
                );
              })}
              {endIdx < wordCount - 1 && (
                <div className="text-center text-[8px] text-gray-700 font-mono py-0.5">↓ {wordCount - 1 - endIdx} below</div>
              )}
            </div>

            {/* Data flow footer */}
            <div className={`shrink-0 border-t px-2 py-1.5 flex items-center gap-1.5
              ${isRevealed && accessing ? "border-amber-800/50 bg-amber-950/40" : "border-gray-800/50"}`}
            >
              <span className="text-[9px] font-mono text-gray-600 uppercase tracking-wide shrink-0">
                {wrMem ? "IN" : "OUT"}
              </span>
              <span className={`text-[12px] font-mono font-bold flex-1 text-right
                ${wrMem ? "text-orange-200" : rdMem ? "text-amber-200" : "text-gray-500"}`}>
                {wrMem ? formatNum(dataIn, base, bitWidth) : formatNum(dataOut, base, bitWidth)}
              </span>
            </div>
          </>
        )}

        <PortsOverlay componentId={id} />
      </div>
      {configOpen && <ConfigModal component={component} onClose={() => setConfigOpen(false)} />}
    </>
  );
}

// Edit row (full table)
function EditRow({ addr, value, bitWidth, addrBits, base, isActive, onPoke }: {
  addr: number; value: number; bitWidth: number; addrBits: number;
  base: NumericBase; isActive: boolean; onPoke: (a: number, v: number) => void;
}) {
  const displayed = formatNum(value, base, bitWidth);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    const t = raw.trim();
    let p = /^0x/i.test(t) ? parseInt(t, 16) : /^0b/i.test(t) ? parseInt(t.slice(2), 2) : /^0o/i.test(t) ? parseInt(t.slice(2), 8) : parseInt(t, 10);
    if (!isNaN(p)) onPoke(addr, p);
    setDraft(null);
  }

  return (
    <div className={`flex items-center gap-1 py-px px-0.5 rounded ${isActive ? "bg-amber-900/30" : ""}`}>
      <span className={`shrink-0 text-[9px] font-mono w-10 ${isActive ? "text-amber-300" : "text-gray-600"}`}>
        {fmtAddr(addr, addrBits)}
      </span>
      <input
        ref={inputRef}
        type="text"
        className={`flex-1 min-w-0 rounded text-[10px] font-mono px-1 py-px focus:outline-none border
          ${isActive ? "bg-amber-900/50 border-amber-600/50 text-amber-100 focus:border-amber-400"
            : "bg-gray-800/50 border-gray-700/30 text-gray-300 focus:border-gray-500"}`}
        value={draft ?? displayed}
        onFocus={() => setDraft(draft ?? displayed)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") { commit((e.target as HTMLInputElement).value); inputRef.current?.blur(); }
          if (e.key === "Escape") { setDraft(null); inputRef.current?.blur(); }
        }}
      />
    </div>
  );
}
