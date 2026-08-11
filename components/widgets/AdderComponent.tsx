"use client";
import Image from "next/image";
import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { useLayoutStore, Props } from "@/lib/store";
import { useRevealState, revealStyle } from "@/lib/useRevealState";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";

export default function AdderComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const revealStatus = useRevealState(id);
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const adder = useSimulatorStore((s) => s.getAdder(id));
  void revision;
  const base = useDisplayStore((s) => s.numericBase);
  const isRevealed = revealStatus === "revealed";

  const inA = adder?.in_a?.value ?? 0;
  const inB = adder?.in_b?.value ?? 0;
  const result = adder?.result ?? 0;
  const bw = adder?.bitWidth ?? 16;

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
        className="select-none cursor-grab active:cursor-grabbing relative"
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        <Image
          src="/images/ula_white.svg"
          alt="Adder"
          width={!w || isNaN(w) ? 128 : w}
          height={!h || isNaN(h) ? 176 : h}
          priority
          draggable={false}
          style={{
            filter: isRevealed
              ? "invert(60%) sepia(90%) saturate(700%) hue-rotate(330deg) brightness(120%) contrast(100%)"
              : "invert(40%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(85%) contrast(90%)",
            transition: "filter 0.2s ease",
            display: "block",
            width: "100%",
            height: "auto",
            transform: "scaleX(-1)",
          }}
        />

        {/* Label + remove */}
        <div className="absolute top-1 inset-x-0 flex items-center justify-between px-3 pointer-events-none">
          <span className="text-[10px] font-bold text-white/70 font-mono tracking-wider uppercase">{label}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
            className="pointer-events-auto text-rose-300/50 hover:text-white text-[10px] leading-none"
          >✕</button>
        </div>

        {/* Equation overlay */}
        <div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none gap-[2px]"
          style={{ top: "28%" }}
        >
          <span className={`font-mono text-[12px] font-semibold ${isRevealed ? "text-rose-100" : "text-rose-300/40"}`}>
            {formatNum(inA, base, bw)}
          </span>
          <span className={`text-[16px] font-bold leading-none font-mono ${isRevealed ? "text-rose-300" : "text-rose-500/30"}`}>+</span>
          <span className={`font-mono text-[12px] font-semibold ${isRevealed ? "text-rose-100" : "text-rose-300/40"}`}>
            {formatNum(inB, base, bw)}
          </span>
          <div className="mt-0.5 border-t border-rose-600/40 w-full px-3 pt-1 flex justify-center">
            <span className={`font-mono font-bold ${isRevealed ? "text-[14px] text-white bg-rose-900/60 rounded px-1.5 py-0.5" : "text-[12px] text-rose-400/40"}`}>
              = {formatNum(result, base, bw)}
            </span>
          </div>
        </div>

        <PortsOverlay componentId={id} />
      </div>
      {configOpen && <ConfigModal component={component} onClose={() => setConfigOpen(false)} />}
    </>
  );
}
