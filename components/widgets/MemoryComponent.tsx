"use client";

import { Props } from "@/lib/store";
import DraggableWidget from "@/components/DraggableWidget";


// Mock memory range — will be linked to a data source in future
const MOCK_START = 0x0000;
const MOCK_END = 0xffff;

function toHex(value: number, digits = 4) {
  return "0x" + value.toString(16).padStart(digits, "0").toUpperCase();
}

export default function MemoryComponent({ component, zoom }: Props) {
  return (
    <DraggableWidget
      component={component}
      zoom={zoom}
      accentClass="bg-amber-700"
    >
      <div className="flex flex-col items-center justify-between h-full bg-amber-900/60 rounded-b-xl px-3 py-3">
        {/* Label */}
        <span className="text-sm font-bold text-amber-200 tracking-widest uppercase">
          {component.label}
        </span>

        {/* Address range visualization */}
        <div className="flex flex-col items-center gap-0.5 w-full">
          {/* Top address */}
          <span className="text-sm font-mono text-amber-100 bg-amber-800 rounded px-2 py-0.5 w-full text-center">
            {toHex(MOCK_START)}
          </span>

          {/* Block graphic */}
          <div className="w-10 flex flex-col gap-0.5 my-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-2 rounded-sm bg-amber-600/70 border border-amber-500/40"
              />
            ))}
          </div>

          <span className="text-sm font-mono text-amber-400 self-center">
            ···
          </span>

          {/* Bottom address */}
          <span className="text-sm font-mono text-amber-100 bg-amber-800 rounded px-2 py-0.5 w-full text-center">
            {toHex(MOCK_END)}
          </span>
        </div>

        {/* Capacity hint */}
        <span className="text-xs text-amber-500 font-mono">
          {((MOCK_END - MOCK_START + 1) / 1024).toFixed(0)} KB
        </span>
      </div>
    </DraggableWidget>
  );
}
