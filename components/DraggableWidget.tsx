"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useLayoutStore, ComponentInstance } from "@/lib/store";
import React, { useState } from "react";
import ConfigModal from "@/components/ConfigModal";

interface Props {
  component: ComponentInstance;
  zoom: number;
  accentClass?: string;
  title?: string;
  children: React.ReactNode;
}

export default function DraggableWidget({
  component,
  zoom,
  accentClass = "bg-indigo-700",
  title,
  children,
}: Props) {
  const { id, x, y, w, h, label } = component;
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);

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
          select-none rounded-xl border-2 flex flex-col overflow-hidden
          ${isDragging ? "border-indigo-400 shadow-2xl opacity-90" : "border-indigo-600 shadow-lg"}
          bg-gray-800 cursor-grab active:cursor-grabbing
        `}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setConfigOpen(true);
        }}
        onContextMenu={(e) => {
          // Let contextmenu bubble to PortTooltipWrapper; dnd-kit doesn't handle it
          e.stopPropagation();
        }}
      >
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
      {configOpen && (
        <ConfigModal component={component} onClose={() => setConfigOpen(false)} />
      )}
    </>
  );
}
