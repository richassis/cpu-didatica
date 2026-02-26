"use client";

import { Props } from "@/lib/store";
import DraggableWidget from "@/components/DraggableWidget";

export default function ValueDisplayWidget({ component, zoom }: Props) {
  const { id } = component;

  return (
    <DraggableWidget
      component={component}
      zoom={zoom}
      accentClass="bg-violet-700"
    >
      <div className="flex flex-col items-center justify-center h-full px-3 py-2 gap-1">
        <span className="text-2xl font-bold font-mono text-violet-200">0.00</span>
        <span className="text-sm text-gray-500 font-mono truncate max-w-full">
          id: {id.slice(0, 8)}
        </span>
        <div className="mt-1 w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div className="bg-violet-500 h-full w-1/3 rounded-full" />
        </div>
      </div>
    </DraggableWidget>
  );
}
