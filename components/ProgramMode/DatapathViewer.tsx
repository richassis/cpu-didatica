"use client";

import SimulatorCanvas from "@/components/SimulatorCanvas";

export default function DatapathViewer() {
  return (
    <section className="flex-1 min-w-0 min-h-0">
      <SimulatorCanvas isReadOnly />
    </section>
  );
}
