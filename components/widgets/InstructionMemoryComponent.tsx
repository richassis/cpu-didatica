"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import React from "react";
import ConfigModal from "@/components/ConfigModal";
import PortsOverlay from "@/components/PortsOverlay";
import InstructionBuilder from "@/components/InstructionBuilder";
import { useShouldDefer } from "@/lib/useDeferredValue";
import { useSnapshotStore } from "@/lib/snapshotStore";

function addrHex(addr: number, addrBits: number): string {
  const digits = Math.ceil(addrBits / 4);
  return "0x" + addr.toString(16).toUpperCase().padStart(digits, "0");
}

function dataHex(data: number, bitWidth: number): string {
  const digits = Math.ceil(bitWidth / 4);
  return "0x" + data.toString(16).toUpperCase().padStart(digits, "0");
}

export default function InstructionMemoryComponent({ component, zoom }: Props) {
  const { id, x, y, w, h, label } = component;
  const [configOpen, setConfigOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(0);

  const revision = useSimulatorStore((s) => s.revision);
  const imem = useSimulatorStore((s) => s.getInstructionMemory(id));
  void revision;

  const wordCount = imem?.wordCount ?? 256;
  const bitWidth = imem?.bitWidth ?? 16;
  const addrBits = Math.max(1, Math.ceil(Math.log2(wordCount)));
  
  // During animation, show the snapshotted address so the current-row
  // highlight doesn't jump ahead before the wire animation arrives.
  const liveAddr = imem ? imem.in_addr.value : 0;
  const isDeferred = useShouldDefer(id);
  const snapshotAddr = isDeferred
    ? useSnapshotStore.getState().getSnapshotPortValue(id, "out")
    : undefined;
  // We don't snapshot the address input directly, but we can infer from
  // the output snapshot whether to defer. The address highlight is visual.
  const currentAddr = liveAddr;

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

  const handleAddressClick = (addr: number) => {
    setSelectedAddress(addr);
    setBuilderOpen(true);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        data-draggable
        className="select-none cursor-grab active:cursor-grabbing relative rounded-lg border-2 border-cyan-600/60 bg-gray-900 shadow-lg flex flex-col"
        onContextMenu={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setConfigOpen(true);
        }}
      >
        {/* Header */}
        <div className="shrink-0 px-3 py-1.5 bg-cyan-950/80 border-b border-cyan-800/30 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-cyan-200 tracking-wide uppercase">
              {label || "IMEM"}
            </span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setConfigOpen(true);
            }}
            className="text-cyan-500/60 hover:text-cyan-200 text-xs leading-none"
            aria-label="Configure"
          >
            ⚙
          </button>
        </div>

        {/* Memory Table Header */}
        <div className="shrink-0 grid grid-cols-2 gap-2 px-2 py-1 bg-gray-800/50 border-b border-gray-700 text-[10px] font-semibold text-gray-400">
          <div>ADDR</div>
          <div>DATA</div>
        </div>

        {/* Scrollable Memory List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {imem &&
            Array.from({ length: wordCount }, (_, addr) => {
              const value = imem.peek(addr);
              const isCurrent = addr === currentAddr;
              
              return (
                <div
                  key={addr}
                  className={`grid grid-cols-2 gap-2 px-2 py-1 text-[10px] font-mono border-b border-gray-800/50 transition-colors cursor-pointer ${
                    isCurrent
                      ? "bg-cyan-900/40 text-cyan-200"
                      : "text-gray-300 hover:bg-cyan-900/20 hover:text-cyan-200"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddressClick(addr);
                  }}
                  title={`Click to edit instruction at ${addrHex(addr, addrBits)}`}
                >
                  <div className={isCurrent ? "font-bold" : ""}>
                    {addrHex(addr, addrBits)}
                  </div>
                  <div className={isCurrent ? "font-bold" : ""}>
                    {dataHex(value, bitWidth)}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-2 py-1 border-t border-gray-800 bg-gray-900/80 rounded-b-lg text-[9px] text-gray-600 text-center italic">
          click address to edit
        </div>

        {/* Port indicators */}
        <PortsOverlay componentId={id} />
      </div>

      {configOpen && (
        <ConfigModal component={component} onClose={() => setConfigOpen(false)} />
      )}

      {builderOpen && imem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setBuilderOpen(false)} 
          />
          {/* Instruction Builder */}
          <div className="relative z-10">
            <InstructionBuilderWithAddress 
              imem={imem} 
              initialAddress={selectedAddress}
              onClose={() => setBuilderOpen(false)} 
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Wrapper component that sets the initial address
function InstructionBuilderWithAddress({ 
  imem, 
  initialAddress, 
  onClose 
}: { 
  imem: any; 
  initialAddress: number; 
  onClose: () => void; 
}) {
  return <InstructionBuilder imem={imem} onClose={onClose} initialAddress={initialAddress} />;
}
