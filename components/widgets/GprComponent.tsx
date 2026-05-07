"use client";

import { useState, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useLayoutStore, Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import { useDisplaySnapshotStore } from "@/lib/displaySnapshotStore";
import React from "react";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";

type ViewMode = "data" | "ports";

export default function GprComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("data");

  const revision        = useSimulatorStore((s) => s.revision);
  const gpr             = useSimulatorStore((s) => s.getGpr(id));
  const pokeGprRegister = useSimulatorStore((s) => s.pokeGprRegister);
  const base            = useDisplayStore((s) => s.numericBase);
  const latch           = useDisplaySnapshotStore((s) => s.displayedValues.get(id));
  const pending         = useDisplaySnapshotStore((s) => s.commitTimes.has(id));
  void revision;

  const regs      = gpr ? gpr.snapshot() : [];
  const bitWidth  = gpr?.bitWidth ?? 16;

  // Show latch values per-register when available
  const displayRegs = regs.map(({ value }, i) => ({
    value: latch !== undefined
      ? (latch[`reg_${i}`] as number ?? value)
      : value,
  }));
  
  // I/O port values
  const addrIn   = gpr?.in_writeAddr?.value ?? 0;
  const dataIn   = gpr?.in_writeData?.value ?? 0;
  const wrSignal = gpr?.in_writeEnable?.value ?? 0;
  const dataOut  = gpr?.out_readDataA?.value ?? 0;

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

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        data-draggable
        className={`select-none cursor-grab active:cursor-grabbing relative rounded-xl border-2 ${
          isDragging ? "border-teal-400" : "border-teal-700/60"
        } bg-gray-950/90`}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-2 py-1 bg-teal-800/70 border-b border-teal-700/40">
          <span className="text-[11px] font-bold text-teal-200 truncate leading-none">
            {label}
          </span>
          <div className="flex items-center gap-1">
            {/* Toggle view mode */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setViewMode(viewMode === "data" ? "ports" : "data"); }}
              className={`text-[9px] leading-none px-1.5 py-0.5 rounded transition-colors ${
                viewMode === "ports"
                  ? "bg-teal-500 text-black"
                  : "text-teal-300/60 hover:text-teal-100"
              }`}
              title={viewMode === "data" ? "Show I/O ports" : "Show register data"}
            >
              {viewMode === "data" ? "I/O" : "REG"}
            </button>
            {/* Edit mode button - only show in data view */}
            {viewMode === "data" && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setEditMode((v) => !v); }}
                className={`text-[10px] leading-none px-1 rounded transition-colors ${
                  editMode
                    ? "bg-teal-500 text-white"
                    : "text-teal-300/60 hover:text-teal-100"
                }`}
                aria-label={editMode ? "Exit edit mode" : "Edit registers"}
                title={editMode ? "Exit edit mode" : "Edit registers"}
              >✏</button>
            )}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
              className="text-teal-300/50 hover:text-white text-[10px] leading-none ml-0.5"
              aria-label="Remove"
            >✕</button>
          </div>
        </div>

        {/* ── Body ── */}
        {viewMode === "ports" ? (
          /* Port I/O view */
          <div className="flex flex-col gap-1.5 px-2 py-2 text-[10px] font-mono" style={{ height: Math.max(0, (h || 256) - 28) }}>
            {/* WR badge */}
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                wrSignal ? "bg-teal-500 text-black font-bold" : "bg-gray-700 text-gray-400"
              }`}>WR</span>
            </div>

            {/* Address */}
            <div className="flex items-center justify-between">
              <span className="text-teal-400/70 uppercase tracking-wide text-[9px]">addr</span>
              <span className="text-teal-100 bg-teal-900/50 rounded px-1 py-px">
                R{addrIn}
              </span>
            </div>

            {/* Data-in */}
            <div className="flex items-center justify-between">
              <span className="text-teal-400/70 uppercase tracking-wide text-[9px]">data in</span>
              <span className={`rounded px-1 py-px ${
                wrSignal ? "text-teal-100 bg-teal-900/60" : "text-gray-500 bg-gray-800/60"
              }`}>
                {formatNum(dataIn, base, bitWidth)}
              </span>
            </div>

            {/* Data-out */}
            <div className="flex items-center justify-between">
              <span className="text-teal-300/70 uppercase tracking-wide text-[9px]">data out</span>
              <span className="text-teal-100 bg-teal-800/70 rounded px-1 py-px">
                {formatNum(dataOut, base, bitWidth)}
              </span>
            </div>

            {/* Current register preview */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-[9px] text-gray-500 text-center mb-1">R{addrIn}</div>
              <div className={`text-center text-sm font-mono rounded py-1 ${
                wrSignal ? "bg-teal-900/50 text-teal-100" : "bg-gray-800/50 text-gray-400"
              }`}>
                {formatNum(regs[addrIn]?.value ?? 0, base, bitWidth)}
              </div>
            </div>

            {/* Capacity footer */}
            <div className="flex justify-between text-[8px] text-gray-600 border-t border-gray-800 pt-1">
              <span>{regs.length} regs</span>
              <span>{bitWidth}b</span>
            </div>
          </div>
        ) : (
          /* Default data view */
          <div className="flex flex-col overflow-y-auto rounded-b-xl" style={{ height: Math.max(0, (h || 256) - 28) }}>
            {regs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[10px] text-gray-600">
                no GPR
              </div>
            ) : (
              <div className="flex flex-col gap-px px-2 py-1.5">
                {displayRegs.map(({ value }, i) => (
                  <RegisterRow
                    key={i}
                    index={i}
                    value={value}
                    bitWidth={bitWidth}
                    base={base}
                    editMode={editMode}
                    pending={pending}
                    onPoke={(idx, val) => pokeGprRegister(id, idx, val)}
                  />
                ))}
              </div>
            )}
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

/* ─── per-register row ─────────────────────────────────────────────────── */

interface RowProps {
  index: number;
  value: number;
  bitWidth: number;
  base: import("@/lib/displayStore").NumericBase;
  editMode: boolean;
  pending?: boolean;
  onPoke: (index: number, value: number) => void;
}

function RegisterRow({ index, value, bitWidth, base, editMode, pending, onPoke }: RowProps) {
  const name      = `R${index}`;
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
    if (!isNaN(parsed)) onPoke(index, parsed);
    setDraft(null);
  }

  if (editMode) {
    return (
      <div className="flex items-center justify-between py-0.5 gap-1">
        <span className="text-[10px] text-teal-400 font-semibold w-5 shrink-0">{name}</span>
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-0 bg-teal-900/60 border border-teal-600/60 rounded text-[10px] font-mono
                     text-teal-100 px-1 py-px focus:outline-none focus:border-teal-400"
          value={draft ?? displayed}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
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

  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-teal-400 font-semibold w-5">{name}</span>
      <span className={`text-[10px] font-mono transition-colors ${
        pending ? "text-teal-400/50 italic" : "text-teal-100"
      }`}>{displayed}</span>
    </div>
  );
}
