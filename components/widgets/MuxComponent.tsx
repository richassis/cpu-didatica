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

export default function MuxComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);

  const revision   = useSimulatorStore((s) => s.revision);
  const mux        = useSimulatorStore((s) => s.getMux(id));
  const base       = useDisplayStore((s) => s.numericBase);
  void revision;

  const sel         = mux ? mux.sel : 0;
  const result      = mux ? mux.result : 0;
  const numInputs   = mux ? mux.numInputs : (component.meta?.numInputs as number) ?? 2;
  const bitWidth    = mux ? mux.bitWidth : 16;
  const resultFmt   = formatNum(result, base, bitWidth);

  // Get input values for display
  const in0 = mux?.in_0.value ?? 0;
  const in1 = mux?.in_1.value ?? 0;
  const in2 = mux?.in_2?.value ?? 0;
  const inputValues = numInputs === 3 ? [in0, in1, in2] : [in0, in1];

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

  // Trapezoid clip: wide on left (inputs), narrow on right (output)
  const inset = Math.round(h * 0.2); // 20% inset top/bottom on right side
  const trapClip = `polygon(0 0, 100% ${inset}px, 100% calc(100% - ${inset}px), 0 100%)`;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        data-draggable
        className="select-none cursor-grab active:cursor-grabbing relative"
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* ── Trapezoid body ── */}
        <div
          className={`absolute inset-0 transition-colors ${
            isDragging ? "bg-violet-500" : "bg-violet-800/90"
          }`}
          style={{ clipPath: trapClip }}
        />

        {/* ── Border outline via SVG trapezoid ── */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={!w || isNaN(w) ? 64 : w}
          height={!h || isNaN(h) ? 96 : h}
          viewBox={`0 0 ${!w || isNaN(w) ? 64 : w} ${!h || isNaN(h) ? 96 : h}`}
        >
          <polygon
            points={`0,0 ${!w || isNaN(w) ? 64 : w},${inset} ${!w || isNaN(w) ? 64 : w},${(!h || isNaN(h) ? 96 : h) - inset} 0,${!h || isNaN(h) ? 96 : h}`}
            fill="none"
            stroke={isDragging ? "#a78bfa" : "#7c3aed"}
            strokeWidth="1.5"
          />
        </svg>

        {/* ── Remove button ── */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
          className="absolute top-0.5 right-1 pointer-events-auto text-violet-300/60 hover:text-white text-[10px] leading-none z-10"
          aria-label="Remove"
        >
          ✕
        </button>

        {/* ── Label (top-center) ── */}
        <div
          className="absolute inset-x-0 flex justify-center pointer-events-none"
          style={{ top: "8%" }}
        >
          <span className="text-[9px] font-bold text-violet-200 drop-shadow leading-none truncate px-1">
            {label}
          </span>
        </div>

        {/* ── Input indicators on left edge ── */}
        <div
          className="absolute left-0 flex flex-col justify-around pointer-events-none"
          style={{ top: "18%", height: "64%", paddingLeft: "4px" }}
        >
          {inputValues.map((val, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full border transition-colors ${
                  sel === i
                    ? "bg-violet-300 border-violet-100 shadow-sm shadow-violet-400/50"
                    : "bg-gray-700 border-gray-500"
                }`}
              />
              <span className={`text-[7px] font-mono ${sel === i ? "text-violet-200" : "text-violet-400/70"}`}>
                {i}
              </span>
            </div>
          ))}
        </div>

        {/* ── SEL indicator (bottom) ── */}
        <div
          className="absolute inset-x-0 flex justify-center pointer-events-none"
          style={{ bottom: "6%" }}
        >
          <span className="text-[8px] font-mono text-violet-300 bg-violet-950/60 rounded px-1">
            S={sel}
          </span>
        </div>

        {/* ── Output value (right edge) ── */}
        <div
          className="absolute right-0 flex items-center pointer-events-none"
          style={{
            top: "50%",
            transform: "translateY(-50%)",
            paddingRight: "3px",
          }}
        >
          <span className="text-[8px] font-mono text-violet-100 bg-violet-900/80 rounded px-1 leading-tight">
            {resultFmt}
          </span>
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
