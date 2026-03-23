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

export default function GprComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const revision        = useSimulatorStore((s) => s.revision);
  const gpr             = useSimulatorStore((s) => s.getGpr(id));
  const pokeGprRegister = useSimulatorStore((s) => s.pokeGprRegister);
  const base            = useDisplayStore((s) => s.numericBase);
  void revision;

  const regs     = gpr ? gpr.snapshot() : [];
  const bitWidth  = gpr?.bitWidth ?? 16;

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
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
              className="text-teal-300/50 hover:text-white text-[10px] leading-none ml-0.5"
              aria-label="Remove"
            >✕</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col overflow-y-auto rounded-b-xl" style={{ height: h - 28 }}>
          {regs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[10px] text-gray-600">
              no GPR
            </div>
          ) : (
            <div className="flex flex-col gap-px px-2 py-1.5">
              {regs.map(({ value }, i) => (
                <RegisterRow
                  key={i}
                  index={i}
                  value={value}
                  bitWidth={bitWidth}
                  base={base}
                  editMode={editMode}
                  onPoke={(idx, val) => pokeGprRegister(id, idx, val)}
                />
              ))}
            </div>
          )}
        </div>
        
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
  onPoke: (index: number, value: number) => void;
}

function RegisterRow({ index, value, bitWidth, base, editMode, onPoke }: RowProps) {
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
      <span className="text-[10px] font-mono text-teal-100">{displayed}</span>
    </div>
  );
}
