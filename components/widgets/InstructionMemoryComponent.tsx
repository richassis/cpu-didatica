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

function addrHex(addr: number, addrBits: number): string {
  const digits = Math.ceil(addrBits / 4);
  return "0x" + addr.toString(16).toUpperCase().padStart(digits, "0");
}

export default function InstructionMemoryComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const imem = useSimulatorStore((s) => s.getInstructionMemory(id));
  const base = useDisplayStore((s) => s.numericBase);
  void revision;

  const wordCount = imem?.wordCount ?? 256;
  const bitWidth = imem?.bitWidth ?? 16;
  const addrBits = Math.max(1, Math.ceil(Math.log2(wordCount)));
  const addr = imem ? imem.in_addr.value : 0;
  const instruction = imem ? imem.output : 0;

  const addrFmt = addrHex(addr, addrBits);
  const instFmt = formatNum(instruction, base, bitWidth);

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

  const handleEditValue = (addr: number, rawText: string) => {
    if (!imem) return;
    try {
      const value = parseInt(rawText, 16);
      if (!isNaN(value)) {
        imem.poke(addr, value);
      }
    } catch {
      // Invalid input, ignore
    }
  };

  const renderMemoryGrid = () => {
    if (!imem) return null;
    
    const cellsPerRow = Math.min(8, Math.ceil(16 / Math.ceil(bitWidth / 4)));
    const visibleRows = Math.min(12, Math.ceil(wordCount / cellsPerRow));
    const rows = [];

    for (let row = 0; row < visibleRows; row++) {
      const cells = [];
      for (let col = 0; col < cellsPerRow; col++) {
        const cellAddr = row * cellsPerRow + col;
        if (cellAddr >= wordCount) break;
        
        const value = imem.peek(cellAddr);
        const isCurrentAddr = cellAddr === addr;
        
        cells.push(
          <div
            key={cellAddr}
            className={`text-[9px] font-mono px-1 py-0.5 border ${
              isCurrentAddr 
                ? "bg-orange-600/50 border-orange-400 text-orange-100" 
                : "border-gray-600 text-orange-300 hover:bg-orange-800/30"
            } ${editMode ? "cursor-pointer" : ""}`}
            onClick={editMode ? () => {
              const newValue = prompt(`Edit address ${addrHex(cellAddr, addrBits)}:`, value.toString(16));
              if (newValue !== null) handleEditValue(cellAddr, newValue);
            } : undefined}
            title={`${addrHex(cellAddr, addrBits)}: ${formatNum(value, base, bitWidth)}`}
          >
            {value.toString(16).toUpperCase().padStart(Math.ceil(bitWidth / 4), "0")}
          </div>
        );
      }
      
      rows.push(
        <div key={row} className="flex gap-1">
          {cells}
        </div>
      );
    }
    
    return <div className="flex flex-col gap-1">{rows}</div>;
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
        {/* ── Main body ── */}
        <div
          className={`absolute inset-0 rounded border transition-colors ${
            isDragging 
              ? "bg-orange-500 border-orange-400"
              : "bg-orange-800/90 border-orange-600"
          }`}
        />

        {/* ── Remove button ── */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); removeComponent(id); }}
          className="absolute top-0.5 right-1 pointer-events-auto text-orange-300/60 hover:text-white text-[10px] leading-none z-10"
          aria-label="Remove"
        >
          ✕
        </button>

        {/* ── Header ── */}
        <div className="absolute top-1 left-1 right-1 flex items-center justify-between z-10">
          <span className="text-[11px] font-bold text-orange-200 truncate">
            {label}
          </span>
          <div className="flex items-center gap-1">
            {/* Edit mode toggle */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setEditMode(!editMode); }}
              className={`text-[10px] px-1 rounded transition-colors ${
                editMode 
                  ? "bg-orange-600 text-orange-100" 
                  : "text-orange-300/70 hover:text-orange-200"
              }`}
              title="Toggle edit mode"
            >
              {editMode ? "EDIT" : "VIEW"}
            </button>
            <span className="text-[9px] text-orange-300/70">
              I-MEM
            </span>
          </div>
        </div>

        {/* ── Current access info ── */}
        <div className="absolute top-7 left-1 right-1 z-10">
          <div className="text-[10px] font-mono text-orange-200 bg-orange-950/70 rounded px-1 py-0.5">
            <div>ADDR: {addrFmt}</div>
            <div>INST: {instFmt}</div>
          </div>
        </div>

        {/* ── Memory grid ── */}
        <div 
          className="absolute left-1 right-1 bottom-1 overflow-hidden"
          style={{ top: "56px" }}
        >
          {renderMemoryGrid()}
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