"use client";

import Image from "next/image";
import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useLayoutStore, Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import React from "react";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";

export default function AdderComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);

  // Read values from the data layer
  const revision = useSimulatorStore((s) => s.revision);
  const adder = useSimulatorStore((s) => s.getAdder(id));
  void revision; // subscribe so we re-render on touch()
  const base = useDisplayStore((s) => s.numericBase);
  const resultHex = adder ? formatNum(adder.result, base, adder.bitWidth) : "0x0000";

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
        className="select-none cursor-grab active:cursor-grabbing relative"
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* ── SVG fills full widget bounds — amber/orange tint, horizontally mirrored ── */}
        <Image
          src="/images/ula_white.svg"
          alt="Adder"
          width={!w || isNaN(w) ? 128 : w}
          height={!h || isNaN(h) ? 176 : h}
          priority
          draggable={false}
          style={{
            filter: isDragging
              ? "invert(65%) sepia(90%) saturate(600%) hue-rotate(5deg) brightness(120%)"
              : "invert(55%) sepia(80%) saturate(700%) hue-rotate(350deg) brightness(100%) contrast(95%)",
            transition: "filter 0.15s ease",
            display: "block",
            width: "100%",
            height: "auto",
            transform: "scaleX(-1)", // Horizontally mirror the SVG
          }}
        />

        {/* ── Label: centered at 30% from top ── */}
        <div
          className="absolute inset-x-0 flex items-center justify-between px-2 pointer-events-none"
          style={{ top: "30%", transform: "translateY(-50%)" }}
        >
          <span className="flex-1 text-sm font-bold text-white drop-shadow text-center truncate leading-none">
            {label}
          </span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
            className="pointer-events-auto text-amber-300/70 hover:text-white text-sm leading-none ml-1 shrink-0"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>

        {/* ── Operation badge + result — always visible ── */}
        <div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none gap-1"
          style={{ top: "58%" }}
        >
          {/* Fixed ADD badge */}
          <span className="text-sm font-mono font-bold text-white/90 bg-amber-800/70 rounded px-2 py-0.5 leading-none">
            ADD
          </span>

          {/* Result — always visible */}
          <span className="text-xs font-mono text-amber-200 bg-amber-950/70 rounded px-1.5 py-0.5 leading-none">
            = {resultHex}
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
