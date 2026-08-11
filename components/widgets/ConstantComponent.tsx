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

export default function ConstantComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const revealStatus = useRevealState(id);
  const [configOpen, setConfigOpen] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const constant = useSimulatorStore((s) => s.getConstant(id));
  void revision;
  const base = useDisplayStore((s) => s.numericBase);
  const bitWidth = constant?.bitWidth ?? 16;
  const displayValue = formatNum(constant?.value ?? 1, base, bitWidth);
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

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, ...revealStyle(revealStatus) }}
        {...listeners} {...attributes}
        data-draggable
        className={`select-none cursor-grab active:cursor-grabbing rounded-lg overflow-hidden
          border flex items-center px-3 gap-2 transition-all duration-200
          bg-[#0a0a14]
          ${isDragging ? "border-emerald-400" : isRevealed ? "border-emerald-600/60" : "border-emerald-900/50"}`}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        <span className="text-[10px] font-bold text-emerald-500/70 tracking-wider uppercase font-mono shrink-0">
          {label}
        </span>
        <div className="flex-1" />
        <span className={`font-mono font-bold text-[13px] rounded px-1.5 py-0.5 transition-all
          ${isRevealed ? "text-emerald-100 bg-emerald-500/20 ring-1 ring-emerald-400/40" : "text-emerald-300/70"}`}>
          {displayValue}
        </span>
        <PortsOverlay componentId={id} />
      </div>
      {configOpen && <ConfigModal component={component} onClose={() => setConfigOpen(false)} />}
    </>
  );
}
