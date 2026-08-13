"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AssemblyPanel from "@/components/ProgramMode/AssemblyPanel";
import DatapathViewer from "@/components/ProgramMode/DatapathViewer";
import SimulationBar from "@/components/ProgramMode/SimulationBar";
import useSimulationShortcuts from "@/lib/useSimulationShortcuts";

/**
 * ProgramModeLayout — Full-screen layout for Program Mode.
 *
 * ┌──────────────┬──────────────────────────────────────────┐
 * │              │                                          │
 * │  Assembly    │   Datapath Canvas (read-only)            │
 * │  Panel       │                                          │
 * │  (300px)     │                                          │
 * │              │                                          │
 * ├──────────────┴──────────────────────────────────────────┤
 * │  SimulationBar (always mounted; transport when running) │
 * └─────────────────────────────────────────────────────────┘
 */
export default function ProgramModeLayout() {
  const [panelWidth, setPanelWidth] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = { startX: event.clientX, startWidth: panelWidth };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [panelWidth]);

  const handleDragMove = useCallback((event: PointerEvent) => {
    if (!dragStateRef.current) return;
    const delta = event.clientX - dragStateRef.current.startX;
    const nextWidth = dragStateRef.current.startWidth + delta;
    const clamped = Math.max(220, Math.min(520, nextWidth));
    setPanelWidth(clamped);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => handleDragMove(event);
    const handlePointerUp = () => handleDragEnd();

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handleDragEnd, handleDragMove, isDragging]);

  useSimulationShortcuts();

  return (
    /* The bar is always mounted, so the padding that clears it is unconditional
       too — settings and the legend have to be reachable before the first Run. */
    <div className="relative flex-1 min-h-0 pb-24">
      <div className="flex h-full min-h-0">
        {/* Left: Assembly Editor (resizable) */}
        <div
          className="relative shrink-0 min-h-0 overflow-hidden"
          style={{ width: panelWidth }}
        >
          <AssemblyPanel />
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize assembly panel"
            onPointerDown={handleDragStart}
            className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-line-strong"
          >
            <div className="absolute right-0 top-1/2 h-12 w-[2px] -translate-y-1/2 rounded bg-line-strong" />
          </div>
        </div>

        {/* Right: Datapath Canvas (read-only) */}
        <div className="flex-1 min-h-0 min-w-0">
          <DatapathViewer />
        </div>
      </div>

      {/* Bottom: the single simulation control bar. */}
      <SimulationBar />
    </div>
  );
}
