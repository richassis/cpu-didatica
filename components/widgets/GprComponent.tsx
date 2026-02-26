"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import DraggableWidget from "@/components/DraggableWidget";

export default function GprComponent({ component, zoom }: Props) {
  // Read register data from the data layer
  const revision = useSimulatorStore((s) => s.revision);
  const gpr = useSimulatorStore((s) => s.getGpr(component.id));
  void revision; // subscribe so we re-render on touch()
  const registersHex = gpr ? gpr.snapshotHex() : [];

  return (
    <DraggableWidget
      component={component}
      zoom={zoom}
      accentClass="bg-teal-700"
    >
      <div className="flex flex-col h-full bg-teal-800 rounded-b-xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-3 py-1.5 bg-teal-700 border-b border-teal-600">
          <span className="text-sm font-bold text-teal-100 tracking-widest uppercase">
            {component.label}
          </span>
        </div>

        {/* Register list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {registersHex.map((reg) => (
            <div
              key={reg.name}
              className="flex items-center justify-between py-0.5"
            >
              <span className="text-sm text-teal-300 font-semibold w-6 shrink-0">
                {reg.name}
              </span>
              <span className="text-sm font-mono text-teal-100">
                {reg.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DraggableWidget>
  );
}
