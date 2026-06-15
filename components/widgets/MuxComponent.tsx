"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Props, useLayoutStore } from "@/lib/store";
import { useRevealState, revealStyle } from "@/lib/useRevealState";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";

export default function MuxComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const revealStatus = useRevealState(id);
  const [configOpen, setConfigOpen] = useState(false);

  const revision        = useSimulatorStore((s) => s.revision);
  const mux             = useSimulatorStore((s) => s.getMux(id));
  const base            = useDisplayStore((s) => s.numericBase);
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  void revision;

  const sel       = mux ? mux.sel : 0;
  const result    = mux ? mux.result : 0;
  const numInputs = mux ? mux.numInputs : (component.meta?.numInputs as number) ?? 2;
  const bitWidth  = mux ? mux.bitWidth : 16;
  const resultFmt = formatNum(result, base, bitWidth);

  const in0 = mux?.in_0.value ?? 0;
  const in1 = mux?.in_1.value ?? 0;
  const in2 = mux?.in_2?.value ?? 0;
  const inputValues = numInputs === 3 ? [in0, in1, in2] : [in0, in1];

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });

  const correctedTransform = transform
    ? { ...transform, x: transform.x / zoom, y: transform.y / zoom }
    : null;

  const style: CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    transform: CSS.Translate.toString(correctedTransform),
    zIndex: isDragging ? 50 : 10,
    touchAction: "none",
  };

  // ── Geometry ───────────────────────────────────────────────────
  const W = (!w || isNaN(w)) ? 84 : w;
  const H = (!h || isNaN(h)) ? 104 : h;
  const inset = Math.round(H * 0.18);

  const trapPoints = `0,0 ${W},${inset} ${W},${H - inset} 0,${H}`;
  const trapClip   = `polygon(0 0, 100% ${inset}px, 100% calc(100% - ${inset}px), 0 100%)`;

  // Internal routing coordinates
  const railX   = W * 0.50;
  const outputY = H * 0.5;

  // Match getPortOffset exactly: (i + 1) / (count + 1) * H
  // `sel` is on the top side, so only in_0…in_N sit on the left —
  // this ensures routing lines originate from the exact port dot positions.
  const inputYs: number[] = Array.from({ length: numInputs }, (_, i) =>
    H * (i + 1) / (numInputs + 1)
  );

  const clampedSel = Math.max(0, Math.min(sel, numInputs - 1));
  const selY = inputYs[clampedSel] ?? outputY;

  // ── Colors ──────────────────────────────────────────────────────
  const ACTIVE  = "#22d3ee"; // cyan-400
  const DIM     = "#1f2937"; // gray-800 — very dim inactive lines
  const RAIL_C  = "#374151"; // gray-700

  const glowId  = `mux-glow-${id}`;
  const bgId    = `mux-bg-${id}`;
  const clipId  = `mux-clip-${id}`;

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, ...revealStyle(revealStatus) }}
        {...listeners}
        {...attributes}
        data-draggable
        className="select-none cursor-grab active:cursor-grabbing relative"
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* ── Trapezoid background fill ── */}
        <div
          className="absolute inset-0"
          style={{ clipPath: trapClip, background: "linear-gradient(100deg, #0f172a 0%, #1e1b4b 100%)" }}
        />

        {/* ── SVG: border + routing diagram ── */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={W} height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Glow for active elements */}
            <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Strong glow for the selector dot */}
            <filter id={`${glowId}-dot`} x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id={clipId}>
              <polygon points={trapPoints} />
            </clipPath>
            <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </linearGradient>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            {/* Subtle grid / panel lines for depth */}
            {inputYs.map((iy, i) => (
              <line key={`panel-${i}`}
                x1={0} y1={iy} x2={railX - 2} y2={iy}
                stroke={DIM} strokeWidth={4}
              />
            ))}

            {/* ── Vertical rail ── */}
            <line
              x1={railX} y1={inputYs[0] - 2}
              x2={railX} y2={inputYs[numInputs - 1] + 2}
              stroke={RAIL_C} strokeWidth={2} strokeLinecap="round"
            />
            {/* Rail end caps */}
            <circle cx={railX} cy={inputYs[0]}             r={3} fill={RAIL_C} />
            <circle cx={railX} cy={inputYs[numInputs - 1]} r={3} fill={RAIL_C} />

            {/* ── Input horizontal lines ── */}
            {inputYs.map((iy, i) => {
              const active = clampedSel === i;
              return (
                <line key={`in-${i}`}
                  x1={2} y1={iy} x2={railX} y2={iy}
                  stroke={active ? ACTIVE : RAIL_C}
                  strokeWidth={active ? 2 : 1}
                  strokeLinecap="round"
                  filter={active ? `url(#${glowId})` : undefined}
                />
              );
            })}

            {/* ── Active output path: rail junction → output ── */}
            <line
              x1={railX} y1={selY}
              x2={W - 2} y2={outputY}
              stroke={ACTIVE} strokeWidth={2} strokeLinecap="round"
              filter={`url(#${glowId})`}
            />

            {/* ── Selector dot on rail (CSS-animated y-position) ── */}
            <circle
              cx={railX} cy={0} r={6}
              fill={ACTIVE}
              stroke="#ecfeff" strokeWidth={1.5}
              filter={`url(#${glowId}-dot)`}
              style={{
                transform: `translateY(${selY}px)`,
                transition: "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
            {/* Inner highlight on selector dot */}
            <circle
              cx={railX} cy={0} r={2.5}
              fill="white" opacity={0.7}
              style={{
                transform: `translateY(${selY}px)`,
                transition: "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
          </g>

          {/* ── Trapezoid border ── */}
          <polygon
            points={trapPoints}
            fill="none"
            stroke={isDragging ? "#818cf8" : "#4338ca"}
            strokeWidth={isDragging ? 2 : 1.5}
          />
          {/* Subtle inner bevel */}
          <polygon
            points={`2,2 ${W - 1},${inset + 2} ${W - 1},${H - inset - 2} 2,${H - 2}`}
            fill="none"
            stroke="#312e81"
            strokeWidth={1}
            opacity={0.4}
          />
        </svg>

        {/* ── Input value labels (HTML, left side) ── */}
        {inputYs.map((iy, i) => {
          const active = clampedSel === i;
          const val = formatNum(inputValues[i] ?? 0, base, bitWidth);
          return (
            <div
              key={`lbl-${i}`}
              className="absolute pointer-events-none select-none"
              style={{ top: iy, left: 5, transform: "translateY(-50%)" }}
            >
              <span className={`text-[7px] font-mono leading-none block ${
                active ? "text-cyan-300 font-semibold" : "text-gray-600"
              }`}>
                {val}
              </span>
            </div>
          );
        })}

        {/* ── Output value badge (right side) ── */}
        <div
          className="absolute pointer-events-none"
          style={{ top: "50%", right: 5, transform: "translateY(-50%)" }}
        >
          <span className="text-[7px] font-mono font-semibold text-cyan-100 bg-indigo-900/80 border border-indigo-500/40 rounded px-1 py-px leading-none whitespace-nowrap">
            {resultFmt}
          </span>
        </div>

        {/* ── Header: label + SEL + remove ── */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-1 pt-0.5 pointer-events-none z-10">
          <span className="text-[7px] font-bold text-indigo-300/70 uppercase tracking-wider leading-none">
            {label || "MUX"}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[7px] font-mono text-indigo-400/60 leading-none">
              s={clampedSel}
            </span>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
              className="pointer-events-auto text-indigo-400/40 hover:text-white text-[8px] leading-none"
              aria-label="Remove"
            >✕</button>
          </div>
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
