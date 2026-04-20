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
          className={`absolute inset-0 transition-all duration-150 overflow-hidden ${
            isDragging
              ? "bg-indigo-700/90 shadow-xl shadow-indigo-900/60"
              : "bg-gray-900/95 shadow-lg shadow-black/50"
          }`}
          style={{ clipPath: trapClip }}
        >
          {/* Compact internal content */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Input indicators */}
            <div
              className="absolute left-1.5 right-[42%] flex flex-col justify-around"
              style={{ top: "12%", bottom: "12%" }}
            >
              {Array.from({ length: numInputs }).map((_, i) => {
                const active = sel === i;
                return (
                  <div key={i} className="flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full border shrink-0 ${
                        active
                          ? "bg-cyan-300 border-cyan-100 shadow-[0_0_6px_rgba(34,211,238,0.7)]"
                          : "bg-gray-700 border-gray-500"
                      }`}
                    />
                    <span className={`text-[8px] font-mono ${active ? "text-cyan-200" : "text-gray-500"}`}>
                      i{i}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Current output value */}
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <span className="text-[8px] font-mono text-indigo-50 bg-indigo-700/70 border border-indigo-400/50 rounded px-1.5 py-px leading-none">
                {resultFmt}
              </span>
            </div>
          </div>
        </div>

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
            stroke={isDragging ? "#93c5fd" : "#6366f1"}
            strokeWidth="2"
          />
        </svg>

        {/* ── Remove button ── */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
          className="absolute top-0.5 right-1 pointer-events-auto text-indigo-300/60 hover:text-white text-[10px] leading-none z-10"
          aria-label="Remove"
        >
          ✕
        </button>
        
        {/* Port indicators */}
        <PortsOverlay componentId={id} />
      </div>

      {configOpen && (
        <ConfigModal component={component} onClose={() => setConfigOpen(false)} />
      )}
    </>
  );
}
