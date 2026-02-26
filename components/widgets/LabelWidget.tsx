"use client";

import { Props } from "@/lib/store";
import DraggableWidget from "@/components/DraggableWidget";


export default function LabelWidget({ component, zoom }: Props) {
  return (
    <DraggableWidget
      component={component}
      zoom={zoom}
      accentClass="bg-teal-700"
    >
      <div className="flex items-center justify-center h-full px-3">
        <span className="text-base font-semibold text-teal-200 text-center break-words">
          {component.label}
        </span>
      </div>
    </DraggableWidget>
  );
}
