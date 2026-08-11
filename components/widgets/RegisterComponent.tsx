"use client";
import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Props } from "@/lib/store";
import { useRevealState, revealStyle } from "@/lib/useRevealState";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";

export default function RegisterComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const revealStatus = useRevealState(id);
  const [configOpen, setConfigOpen] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const reg = useSimulatorStore((s) => s.getRegister(id));
  void revision;
  const base = useDisplayStore((s) => s.numericBase);
  const displayValue = reg ? formatNum(reg.value, base, reg.bitWidth) : "0x0000";

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const correctedTransform = transform
    ? { ...transform, x: transform.x / zoom, y: transform.y / zoom }
    : null;

  const isRevealed = revealStatus === "revealed";

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
        className={`select-none cursor-grab active:cursor-grabbing rounded-lg flex flex-col overflow-hidden
          border transition-all duration-200
          ${isDragging ? "border-cyan-400 shadow-lg shadow-cyan-900/40" : isRevealed ? "border-cyan-500/70 shadow-md shadow-cyan-900/20" : "border-cyan-800/40"}
          bg-[#0a0a14]`}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between px-2 py-1 border-b
          ${isRevealed ? "bg-cyan-900/40 border-cyan-700/40" : "bg-cyan-950/60 border-cyan-900/30"}`}
        >
          <span className="text-[10px] font-bold text-cyan-400/80 tracking-widest uppercase leading-none font-mono">
            {label}
          </span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
            className="text-cyan-600/40 hover:text-cyan-300 text-[9px] leading-none"
          >⚙</button>
        </div>

        {/* Value */}
        <div className="flex-1 flex items-center justify-center px-2">
          <span className={`font-mono font-bold tracking-wide transition-all duration-150 rounded px-2 py-0.5
            ${isRevealed
              ? "text-[15px] text-cyan-100 bg-cyan-500/20 ring-1 ring-cyan-400/40"
              : "text-[14px] text-cyan-300/70 bg-transparent"
            }`}
          >
            {displayValue}
          </span>
        </div>

        <PortsOverlay componentId={id} />
      </div>
      {configOpen && <ConfigModal component={component} onClose={() => setConfigOpen(false)} />}
    </>
  );
}
