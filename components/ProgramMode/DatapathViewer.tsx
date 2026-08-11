"use client";

import SimulatorCanvas from "@/components/SimulatorCanvas";
import ProgramModeSettings from "@/components/ProgramMode/ProgramModeSettings";
import Legend from "@/components/ProgramMode/Legend";

export default function DatapathViewer() {
  return (
    /* Must be a flex column: the canvas inside is 4000×3000 virtual pixels, so
       with a block parent the section grows to the canvas height and anything
       anchored to `bottom` — the legend, the settings FAB — lands thousands of
       pixels below the viewport. */
    <section className="relative flex h-full min-h-0 min-w-0 flex-col">
      <SimulatorCanvas isReadOnly />
      <Legend />
      <ProgramModeSettings />
    </section>
  );
}
