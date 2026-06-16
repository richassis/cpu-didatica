"use client";

import SimulatorCanvas from "@/components/SimulatorCanvas";
import ProgramModeSettings from "@/components/ProgramMode/ProgramModeSettings";

export default function DatapathViewer() {
  return (
    <section className="relative flex-1 min-w-0 min-h-0">
      <SimulatorCanvas isReadOnly />
      <ProgramModeSettings />
    </section>
  );
}
