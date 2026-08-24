"use client";

import SimulatorCanvas from "@/components/SimulatorCanvas";
import TickDisplay from "@/components/ProgramMode/TickDisplay";

export default function DatapathViewer() {
  return (
    /* Must be a flex column: the canvas inside is 4000x3000 virtual pixels, so
       with a block parent the section grows to the canvas height and anything
       anchored to an edge lands thousands of pixels outside the viewport.
       The settings and legend that used to float here now live in the
       simulation bar; what is left is the canvas and the tick readout. */
    <section className="relative flex h-full min-h-0 min-w-0 flex-col">
      <SimulatorCanvas isReadOnly />
      <TickDisplay />
    </section>
  );
}
