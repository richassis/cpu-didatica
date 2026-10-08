"use client";

import SimulatorCanvas from "@/components/SimulatorCanvas";

export default function DatapathViewer() {
  return (
    /* Must be a flex column: the canvas inside is 4000x3000 virtual pixels, so
       with a block parent the section grows to the canvas height and anything
       anchored to an edge lands thousands of pixels outside the viewport.
       Settings and zoom live in the top bar and the tick readout in the
       simulation bar; what is left is the canvas. */
    <section data-tour="datapath" className="relative flex h-full min-h-0 min-w-0 flex-col">
      <SimulatorCanvas isReadOnly />
    </section>
  );
}
