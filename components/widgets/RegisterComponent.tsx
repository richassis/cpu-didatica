"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import React from "react";
import ConfigModal from "@/components/ConfigModal";

export default function RegisterComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const [hovered, setHovered] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Read value from the data layer
  const revision = useSimulatorStore((s) => s.revision);
  const reg = useSimulatorStore((s) => s.getRegister(id));
  void revision; // subscribe so we re-render on touch()
  const displayValue = reg ? reg.toHex() : "0000";

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
        className={`
          select-none cursor-grab active:cursor-grabbing
          rounded-lg border-2 flex items-center justify-center
          bg-gray-800 transition-colors
          ${isDragging
            ? "border-cyan-400 shadow-2xl opacity-90"
            : hovered
              ? "border-cyan-500 shadow-lg"
              : "border-cyan-700 shadow-md"}
        `}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* Register pill */}
        <div className="flex items-center gap-2 px-3 w-full">
          <span className="text-sm font-bold text-cyan-300 truncate flex-1 text-center">
            {label}
          </span>
          {/* Value shown on hover */}
          <span
            className={`
              text-sm font-mono text-cyan-100 bg-cyan-900/60 rounded px-1.5 py-0.5
              transition-opacity duration-150
              ${hovered && !isDragging ? "opacity-100" : "opacity-0"}
            `}
          >
            {displayValue}
          </span>
        </div>
      </div>

      {configOpen && (
        <ConfigModal component={component} onClose={() => setConfigOpen(false)} />
      )}
    </>
  );
}
