"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useLayoutStore, Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import React from "react";
import ConfigModal from "@/components/ConfigModal";

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
  const numInputs   = mux ? mux.numInputs : 2;
  const bitWidth    = mux ? mux.bitWidth : 16;
  const resultFmt   = formatNum(result, base, bitWidth);

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
  // Points: top-left, top-right (inset), bottom-right (inset), bottom-left
  const inset = Math.round(h * 0.18); // 18% inset top/bottom on right side
  const trapClip = `polygon(0 0, 100% ${inset}px, 100% calc(100% - ${inset}px), 0 100%)`;

  const inputLabels = numInputs === 3 ? ["0", "1", "2"] : ["0", "1"];

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
          className={`absolute inset-0 flex flex-col items-center justify-center transition-colors ${
            isDragging ? "bg-violet-500" : "bg-violet-800/90"
          }`}
          style={{ clipPath: trapClip }}
        />

        {/* ── Border outline via SVG trapezoid ── */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
        >
          <polygon
            points={`0,0 ${w},${inset} ${w},${h - inset} 0,${h}`}
            fill="none"
            stroke={isDragging ? "#a78bfa" : "#7c3aed"}
            strokeWidth="1.5"
          />
        </svg>

        {/* ── Remove button (top-right corner) ── */}
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
          style={{ top: "10%" }}
        >
          <span className="text-[10px] font-bold text-violet-200 drop-shadow leading-none truncate px-1">
            {label}
          </span>
        </div>

        {/* ── Input port dots on left edge ── */}
        <div
          className="absolute left-0 flex flex-col justify-around pointer-events-none"
          style={{ top: "15%", height: "70%", paddingLeft: "3px" }}
        >
          {inputLabels.map((lbl, i) => (
            <div key={i} className="flex items-center gap-0.5">
              <div
                className={`w-1.5 h-1.5 rounded-full border ${
                  sel === i
                    ? "bg-violet-300 border-violet-200"
                    : "bg-gray-700 border-gray-500"
                }`}
              />
              <span className="text-[8px] font-mono text-violet-300/70">{lbl}</span>
            </div>
          ))}
        </div>

        {/* ── SEL indicator (bottom-center) ── */}
        <div
          className="absolute inset-x-0 flex justify-center pointer-events-none"
          style={{ bottom: "8%" }}
        >
          <span className="text-[8px] font-mono text-violet-400/80">
            sel={sel}
          </span>
        </div>

        {/* ── Output value (right edge, vertically centered) ── */}
        <div
          className="absolute right-0 flex items-center pointer-events-none"
          style={{
            top: "50%",
            transform: "translateY(-50%)",
            paddingRight: "2px",
          }}
        >
          <span className="text-[8px] font-mono text-violet-200 bg-violet-950/70 rounded px-1 leading-tight">
            {resultFmt}
          </span>
        </div>
      </div>

      {configOpen && (
        <ConfigModal component={component} onClose={() => setConfigOpen(false)} />
      )}
    </>
  );
}
