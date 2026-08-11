"use client";
import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { useLayoutStore, Props } from "@/lib/store";
import { useRevealState, revealStyle } from "@/lib/useRevealState";
import { useSimulatorStore } from "@/lib/simulatorStore";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";

/**
 * PC+1 incrementer.
 *
 * A small square carrying just the operation it performs. It has one input and
 * one output, so it needs no constant-1 source next to it, and it deliberately
 * reads as the smallest block on the canvas — it is plumbing, not one of the
 * CPU's teaching blocks. The value it carries is shown on the wire, not here.
 */
export default function IncrementerComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const revealStatus = useRevealState(id);
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const incrementer = useSimulatorStore((s) => s.getIncrementer(id));
  void revision;

  const isRevealed = revealStatus === "revealed";
  const step = incrementer?.step ?? 1;

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
        className={`select-none cursor-grab active:cursor-grabbing relative rounded-full flex items-center justify-center
          border-2 transition-all duration-200
          ${isDragging
            ? "border-rose-400 shadow-lg shadow-rose-900/40"
            : isRevealed
              ? "border-rose-400/80 shadow-md shadow-rose-900/30"
              : "border-rose-700/50"}
          bg-[var(--widget-surface)]`}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
        title={label}
      >
        <span
          className={`font-mono font-bold leading-none ${
            isRevealed ? "text-rose-200" : "text-rose-400/70"
          }`}
          style={{ fontSize: Math.max(11, Math.min(w, h) * 0.42) }}
        >
          +{step}
        </span>

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--widget-surface)] border border-rose-700/60 text-rose-300/70 hover:text-white hover:border-rose-400 text-[9px] leading-none flex items-center justify-center"
          aria-label={`Remove ${label}`}
        >✕</button>

        <PortsOverlay componentId={id} />
      </div>
      {configOpen && <ConfigModal component={component} onClose={() => setConfigOpen(false)} />}
    </>
  );
}
