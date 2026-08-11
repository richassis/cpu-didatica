"use client";

import SimulatorCanvas from "@/components/SimulatorCanvas";
import ProgramModeSettings from "@/components/ProgramMode/ProgramModeSettings";
import Legend from "@/components/ProgramMode/Legend";

export default function DatapathViewer() {
  return (
    <section className="relative flex-1 min-w-0 min-h-0">
      <SimulatorCanvas isReadOnly />
      <Legend />
      <ProgramModeSettings />
    </section>
  );
}
