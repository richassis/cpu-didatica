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

export default function ConstantComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const constant = useSimulatorStore((s) => s.getConstant(id));
  void revision;

  const base = useDisplayStore((s) => s.numericBase);
  const bitWidth = constant?.bitWidth ?? (typeof component.meta?.bitWidth === "number" ? component.meta.bitWidth : 16);
  const displayValue = formatNum(constant?.value ?? 1, base, bitWidth);

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
        className={`
          select-none cursor-grab active:cursor-grabbing
          rounded-lg border-2 flex items-center justify-between px-3
          bg-gray-900 transition-colors
          ${isDragging
            ? "border-emerald-400 shadow-2xl opacity-90"
            : "border-emerald-700/70 shadow-md"}
        `}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        <span className="text-sm font-bold text-emerald-300 truncate">
          {label}
        </span>

        <span className="text-sm font-mono text-emerald-100 bg-emerald-900/60 rounded px-1.5 py-0.5">
          {displayValue}
        </span>

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
          className="absolute top-0.5 right-1 text-emerald-300/60 hover:text-white text-[10px] leading-none"
          aria-label="Remove"
        >
          x
        </button>

        <PortsOverlay componentId={id} />
      </div>

      {configOpen && (
        <ConfigModal component={component} onClose={() => setConfigOpen(false)} />
      )}
    </>
  );
}
