"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import React from "react";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";
import { CpuState, CONTROL_SIGNAL_DEFS } from "@/lib/simulator/Cpu";
import type { CPU } from "@/lib/simulator/Cpu";

// ── helpers ───────────────────────────────────────────────────────────────────

const STATE_LABELS: Record<CpuState, string> = {
  [CpuState.RESET]:     "RESET",
  [CpuState.FETCH]:     "FETCH",
  [CpuState.DECODE]:    "DECODE",
  [CpuState.EXECUTE]:   "EXEC",
  [CpuState.READMEM]:   "RDMEM",
  [CpuState.WRITEMEM]:  "WRMEM",
  [CpuState.READREG1]:  "RDREG1",
  [CpuState.READREG2]:  "RDREG2",
  [CpuState.WRITEREG1]: "WRREG1",
  [CpuState.WRITEREG2]: "WRREG2",
  [CpuState.WRITEREG3]: "WRREG3",
  [CpuState.WRITEPC]:   "WRPC",
};

const STATE_COLORS: Record<CpuState, string> = {
  [CpuState.RESET]:     "text-gray-300    bg-gray-800/60    border-gray-600",
  [CpuState.FETCH]:     "text-indigo-300  bg-indigo-900/60  border-indigo-600",
  [CpuState.DECODE]:    "text-purple-300  bg-purple-900/60  border-purple-600",
  [CpuState.EXECUTE]:   "text-orange-300  bg-orange-900/60  border-orange-600",
  [CpuState.READMEM]:   "text-cyan-300    bg-cyan-900/60    border-cyan-600",
  [CpuState.WRITEMEM]:  "text-teal-300    bg-teal-900/60    border-teal-600",
  [CpuState.READREG1]:  "text-sky-300     bg-sky-900/60     border-sky-600",
  [CpuState.READREG2]:  "text-sky-300     bg-sky-900/60     border-sky-600",
  [CpuState.WRITEREG1]: "text-emerald-300 bg-emerald-900/60 border-emerald-600",
  [CpuState.WRITEREG2]: "text-emerald-300 bg-emerald-900/60 border-emerald-600",
  [CpuState.WRITEREG3]: "text-emerald-300 bg-emerald-900/60 border-emerald-600",
  [CpuState.WRITEPC]:   "text-rose-300    bg-rose-900/60    border-rose-600",
};

/** Read every control-signal output port value from the CPU instance. */
function readSignals(cpu: CPU): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  for (const def of CONTROL_SIGNAL_DEFS) {
    const portName = `out_${def.name}`;
    const portMap  = cpu.getPorts();
    const port     = portMap[portName];
    out[def.name]  = port ? (port.value as number | boolean) : 0;
  }
  return out;
}

// ── signal row ────────────────────────────────────────────────────────────────
function SignalRow({
  name,
  value,
  bits,
  active,
  base,
}: {
  name: string;
  value: number | boolean;
  bits: number;
  active: boolean;
  base: import("@/lib/displayStore").NumericBase;
}) {
  const display = typeof value === "boolean"
    ? (value ? "1" : "0")
    : bits <= 1
      ? String(Number(value))
      : formatNum(Number(value), base, bits);

  return (
    <div
      className={`flex items-center justify-between gap-1 px-2 py-[3px] odd:bg-gray-800/30 transition-colors ${
        active ? "bg-indigo-900/40" : ""
      }`}
    >
      <span className="text-[10px] text-gray-400 font-mono w-20 truncate shrink-0">{name}</span>
      <div className="flex items-center gap-1.5">
        {/* LED indicator */}
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
            active ? "bg-indigo-400 shadow-[0_0_4px_#818cf8]" : "bg-gray-700"
          }`}
        />
        <span
          className={`text-[10px] font-mono font-semibold min-w-[1.5rem] text-right ${
            active ? "text-indigo-200" : "text-gray-500"
          }`}
        >
          {display}
        </span>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function CpuComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const [configOpen, setConfigOpen] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const cpu      = useSimulatorStore((s) => s.getCpu(id));
  const pauseCpu = useSimulatorStore((s) => s.pauseCpu);
  const resetCpu = useSimulatorStore((s) => s.resetCpu);
  const base     = useDisplayStore((s) => s.numericBase);
  void revision;

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

  // ── derived display ────────────────────────────────────────────
  const cpuState   = cpu ? (cpu.state as CpuState) : CpuState.FETCH;
  const halted     = cpu ? cpu.halted : false;
  const paused     = cpu ? cpu.paused : false;
  const signals    = cpu ? readSignals(cpu) : {};
  const stateLabel = STATE_LABELS[cpuState] ?? "???";
  const stateColor = STATE_COLORS[cpuState] ?? "text-gray-300 bg-gray-800 border-gray-600";

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        data-draggable
        className={`
          select-none cursor-grab active:cursor-grabbing relative
          rounded-xl border-2 flex flex-col
          bg-gray-900 transition-colors
          ${isDragging
            ? "border-indigo-400 shadow-2xl opacity-90"
            : halted
              ? "border-red-700/80 shadow-md"
              : paused
                ? "border-yellow-600/80 shadow-md"
                : "border-indigo-600/60 shadow-lg"}
        `}
        onContextMenu={(e) => e.stopPropagation()}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* ── Header band ── */}
        <div
          className={`shrink-0 px-3 py-1.5 flex items-center justify-between gap-2 border-b rounded-t-xl ${
            halted ? "bg-red-950/60 border-red-800/40" : "bg-indigo-950/80 border-indigo-800/30"
          }`}
        >
          {/* CPU "chip" icon + label */}
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 shrink-0">
              {/* Stylised chip rectangle */}
              <div className="absolute inset-[3px] rounded-[2px] border border-indigo-500/60 bg-indigo-900/60" />
              {/* Left pins */}
              {[0, 1, 2].map((i) => (
                <div
                  key={`l${i}`}
                  className="absolute left-0 w-[3px] h-[2px] bg-indigo-400/60 rounded-r"
                  style={{ top: `${7 + i * 4}px` }}
                />
              ))}
              {/* Right pins */}
              {[0, 1, 2].map((i) => (
                <div
                  key={`r${i}`}
                  className="absolute right-0 w-[3px] h-[2px] bg-indigo-400/60 rounded-l"
                  style={{ top: `${7 + i * 4}px` }}
                />
              ))}
            </div>
            <span className="text-[11px] font-bold text-indigo-200 tracking-wide uppercase truncate">
              {label}
            </span>
          </div>

          {/* Reset + Pause / Resume + Gear buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Reset CPU */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); resetCpu(id); }}
              className="text-indigo-400/70 hover:text-indigo-200 text-xs leading-none px-1 py-0.5 rounded transition-colors"
              aria-label="Reset CPU"
              title="Reset CPU to RESET state"
            >
              ↺
            </button>
            {/* Pause / Resume */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); pauseCpu(id, !paused); }}
              className={`text-xs leading-none px-1.5 py-0.5 rounded transition-colors ${
                paused
                  ? "bg-yellow-600/80 hover:bg-yellow-500 text-white"
                  : halted
                    ? "text-gray-600 cursor-not-allowed"
                    : "text-indigo-400/70 hover:text-indigo-200"
              }`}
              disabled={halted}
              aria-label={paused ? "Resume" : "Pause"}
              title={paused ? "Resume CPU" : "Pause CPU"}
            >
              {paused ? "▶" : "⏸"}
            </button>
            {/* Gear to open config */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
              className="text-indigo-500/60 hover:text-indigo-200 text-xs leading-none"
              aria-label="Configure"
            >
              ⚙
            </button>
          </div>
        </div>

        {/* ── FSM state badge ── */}
        <div className="shrink-0 px-3 py-1.5 flex items-center justify-between gap-2 border-b border-gray-800">
          <span className="text-[10px] text-gray-500 font-mono">STATE</span>
          {halted ? (
            <span className="text-[10px] font-bold text-red-400 bg-red-900/40 border border-red-700/60 rounded px-1.5 py-0.5">
              HALTED
            </span>
          ) : paused ? (
            <span className="text-[10px] font-bold text-yellow-400 bg-yellow-900/40 border border-yellow-700/60 rounded px-1.5 py-0.5">
              PAUSED
            </span>
          ) : (
            <span
              className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${stateColor}`}
            >
              {stateLabel}
            </span>
          )}
        </div>

        {/* ── Control signals ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 pt-1 pb-0.5 text-[9px] text-gray-600 font-semibold uppercase tracking-widest">
            Control Signals
          </div>
          {CONTROL_SIGNAL_DEFS.map((def) => {
            const val = signals[def.name];
            const numVal = typeof val === "boolean" ? (val ? 1 : 0) : (val ?? 0);
            const isActive = numVal !== 0;
            return (
              <SignalRow
                key={def.name}
                name={def.name}
                value={val ?? 0}
                bits={def.bitWidth}
                active={isActive}
                base={base}
              />
            );
          })}
        </div>

        {/* ── Bottom: opULA label when active ── */}
        <div className="shrink-0 px-2 py-1 border-t border-gray-800 bg-gray-900/80 rounded-b-xl flex items-center justify-between">
          <span className="text-[9px] text-gray-600 italic">dbl-click to configure</span>
          <span className="text-[9px] text-gray-600 font-mono">CPU</span>
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
