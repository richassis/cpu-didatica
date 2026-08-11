"use client";
import Image from "next/image";
import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { useLayoutStore, Props } from "@/lib/store";
import { useRevealState, revealStyle } from "@/lib/useRevealState";
import { getSafeDimensions } from "@/lib/componentUtils";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";

/**
 * PC+1 style adder.
 *
 * Renders as a small mirrored trapezoid with no numbers inside: the adder is
 * secondary hardware, and showing its operands next to the ULA made it look as
 * important as the ALU. Port values are still readable from the wire labels and
 * port tooltips.
 */
export default function AdderComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const revealStatus = useRevealState(id);
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);

  const isRevealed = revealStatus === "revealed";
  const { width, height } = getSafeDimensions("AdderComponent", w, h);

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
          width={width}
          height={height}
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
        <div className="absolute top-0.5 inset-x-0 flex items-center justify-between px-1.5 pointer-events-none">
          <span className="text-[9px] font-bold text-white/70 font-mono tracking-wide uppercase truncate">{label}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
            className="pointer-events-auto shrink-0 text-rose-300/50 hover:text-white text-[9px] leading-none"
          >✕</button>
        </div>

        {/* Symbol only — the adder never displays its operands or result. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={`font-mono font-bold leading-none text-[22px] ${isRevealed ? "text-rose-100" : "text-rose-300/50"}`}>
            +
          </span>
        </div>

        <PortsOverlay componentId={id} />
      </div>
      {configOpen && <ConfigModal component={component} onClose={() => setConfigOpen(false)} />}
    </>
  );
}
