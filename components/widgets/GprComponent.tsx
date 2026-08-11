"use client";
import { useState, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Props } from "@/lib/store";
import { useRevealState, revealStyle } from "@/lib/useRevealState";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum, type NumericBase } from "@/lib/displayStore";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";

export default function GprComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const revealStatus = useRevealState(id);
  const [configOpen, setConfigOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const gpr = useSimulatorStore((s) => s.getGpr(id));
  const pokeGprRegister = useSimulatorStore((s) => s.pokeGprRegister);
  const base = useDisplayStore((s) => s.numericBase);
  void revision;

  const regs = gpr ? gpr.snapshot() : [];
  const bitWidth = gpr?.bitWidth ?? 16;
  const readAddrA = gpr?.in_readAddrA?.value ?? 0;
  const readAddrB = gpr?.in_readAddrB?.value ?? 0;
  const writeAddr = gpr?.in_writeAddr?.value ?? 0;
  const wrEnable = (gpr?.in_writeEnable?.value ?? 0) !== 0;
  const writeData = gpr?.in_writeData?.value ?? 0;
  const isRevealed = revealStatus === "revealed";

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
        className={`select-none cursor-grab active:cursor-grabbing relative rounded-xl overflow-hidden flex flex-col
          border transition-all duration-200 bg-[var(--widget-surface)]
          ${isDragging ? "border-teal-400" : isRevealed ? "border-teal-600/60" : "border-teal-900/40"}`}
        onDoubleClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between px-2 py-1.5 border-b
          ${isRevealed ? "bg-teal-900/40 border-teal-700/30" : "bg-teal-950/60 border-teal-900/20"}`}
        >
          <span className="text-[10px] font-bold text-teal-400/80 tracking-widest uppercase font-mono">{label}</span>
          <div className="flex items-center gap-1">
            {wrEnable && (
              <span className="text-[9px] font-mono text-emerald-300 bg-emerald-900/50 border border-emerald-700/40 rounded px-1 py-px leading-none">
                WR→R{writeAddr}
              </span>
            )}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setEditMode((v) => !v); }}
              className={`text-[10px] leading-none px-1 rounded transition-colors ${editMode ? "bg-teal-500 text-white" : "text-teal-400/40 hover:text-teal-200"}`}
              title={editMode ? "Exit edit" : "Edit registers"}
            >✏</button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setConfigOpen(true); }}
              className="text-teal-600/40 hover:text-teal-300 text-[9px] leading-none"
            >⚙</button>
          </div>
        </div>

        {/* Register rows */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col py-1 px-1.5 gap-px">
            {regs.map(({ value }, i) => {
              const isWriteTarget = wrEnable && i === writeAddr;
              const isReadA = i === readAddrA;
              const isReadB = i === readAddrB;
              const isActive = isWriteTarget || isReadA || isReadB;

              let rowBg = "";
              let nameCls = "text-teal-600";
              let valueCls = "text-gray-400";
              let tagEl: React.ReactNode = null;

              if (isWriteTarget) {
                rowBg = "bg-emerald-900/30 rounded";
                nameCls = "text-emerald-300 font-bold";
                valueCls = "text-emerald-100 font-semibold";
                tagEl = <span className="text-[8px] text-emerald-400/80 font-mono ml-1">WR</span>;
              } else if (isReadA && isReadB) {
                rowBg = "bg-sky-900/30 rounded";
                nameCls = "text-sky-300 font-bold";
                valueCls = "text-sky-100 font-semibold";
                tagEl = <span className="text-[8px] text-sky-400/80 font-mono ml-1">A+B</span>;
              } else if (isReadA) {
                rowBg = "bg-cyan-900/25 rounded";
                nameCls = "text-cyan-300 font-bold";
                valueCls = "text-cyan-100 font-semibold";
                tagEl = <span className="text-[8px] text-cyan-400/70 font-mono ml-1">A</span>;
              } else if (isReadB) {
                rowBg = "bg-sky-900/25 rounded";
                nameCls = "text-sky-300 font-bold";
                valueCls = "text-sky-100 font-semibold";
                tagEl = <span className="text-[8px] text-sky-400/70 font-mono ml-1">B</span>;
              }

              return (
                <GprRow
                  key={i}
                  index={i}
                  value={value}
                  pendingValue={isWriteTarget ? writeData : undefined}
                  bitWidth={bitWidth}
                  base={base}
                  editMode={editMode}
                  rowBg={rowBg}
                  nameCls={nameCls}
                  valueCls={valueCls}
                  isActive={isActive && isRevealed}
                  tag={tagEl}
                  onPoke={(idx, val) => pokeGprRegister(id, idx, val)}
                />
              );
            })}
          </div>
        </div>

        <PortsOverlay componentId={id} />
      </div>
      {configOpen && <ConfigModal component={component} onClose={() => setConfigOpen(false)} />}
    </>
  );
}

interface GprRowProps {
  index: number;
  value: number;
  pendingValue?: number;
  bitWidth: number;
  base: NumericBase;
  editMode: boolean;
  rowBg: string;
  nameCls: string;
  valueCls: string;
  isActive: boolean;
  tag: React.ReactNode;
  onPoke: (index: number, value: number) => void;
}

function GprRow({ index, value, bitWidth, base, editMode, rowBg, nameCls, valueCls, isActive, tag, onPoke }: GprRowProps) {
  const displayed = formatNum(value, base, bitWidth);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    const t = raw.trim();
    let parsed = /^0x/i.test(t) ? parseInt(t, 16)
      : /^0b/i.test(t) ? parseInt(t.slice(2), 2)
      : /^0o/i.test(t) ? parseInt(t.slice(2), 8)
      : parseInt(t, 10);
    if (!isNaN(parsed)) onPoke(index, parsed);
    setDraft(null);
  }

  return (
    <div className={`flex items-center gap-1.5 px-1.5 py-[3px] transition-colors duration-100 ${rowBg}`}>
      <span className={`text-[11px] font-mono w-5 shrink-0 ${nameCls}`}>R{index}</span>
      {editMode ? (
        <input
          ref={inputRef}
          type="text"
          className={`flex-1 min-w-0 bg-teal-900/40 border border-teal-700/50 rounded text-[11px] font-mono
            text-teal-100 px-1 py-px focus:outline-none focus:border-teal-400`}
          value={draft ?? displayed}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => setDraft(draft ?? displayed)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") { commit((e.target as HTMLInputElement).value); inputRef.current?.blur(); }
            if (e.key === "Escape") { setDraft(null); inputRef.current?.blur(); }
          }}
        />
      ) : (
        <>
          <span className={`flex-1 text-right text-[11px] font-mono font-medium ${valueCls}`}>{displayed}</span>
          {tag}
        </>
      )}
    </div>
  );
}
