"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useLayoutStore, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import WidgetRenderer from "./WidgetRenderer";
import AddComponentModal from "./AddComponentModal";
import ClearCanvasButton from "./ClearCanvasButton";
import { useEffect, useRef } from "react";

export default function SimulatorCanvas() {
  const components = useLayoutStore((s) => s.components);
  const canvasSize = useLayoutStore((s) => s.canvasSize);
  const zoom = useLayoutStore((s) => s.zoom);
  const updatePosition = useLayoutStore((s) => s.updatePosition);
  const setZoom = useLayoutStore((s) => s.setZoom);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Clock state
  const clock = useSimulatorStore((s) => s.clock);
  const lastExecutedStep = useSimulatorStore((s) => s.lastExecutedStep);
  const tickClock = useSimulatorStore((s) => s.tickClock);
  const completeCycle = useSimulatorStore((s) => s.completeCycle);
  const resetClock = useSimulatorStore((s) => s.resetClock);
  const revision = useSimulatorStore((s) => s.revision);
  void revision; // subscribe to force re-render on tick

  // Scroll to canvas center on mount / canvas resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (canvasSize.width * zoom - el.clientWidth) / 2;
    el.scrollTop = (canvasSize.height * zoom - el.clientHeight) / 2;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize.width, canvasSize.height]);

  // Ctrl+Wheel to zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, setZoom]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (delta.x !== 0 || delta.y !== 0) {
      // delta is screen-space; divide by zoom to get world-space
      updatePosition(String(active.id), delta.x / zoom, delta.y / zoom);
    }
  };

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-gray-950 relative">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {/* Outer sizer so scrollbars reflect the scaled canvas dimensions */}
        <div
          style={{
            width: canvasSize.width * zoom,
            height: canvasSize.height * zoom,
          }}
        >
          {/* World div — scaled from top-left origin */}
          <div
            className="relative bg-gray-900 origin-top-left"
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
              transform: `scale(${zoom})`,
              backgroundImage:
                "radial-gradient(circle, #374151 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          >
            {components.map((c) => (
              <WidgetRenderer key={c.id} component={c} zoom={zoom} />
            ))}
          </div>
        </div>
      </DndContext>

      {/* Zoom toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-gray-900/90 border border-gray-700 rounded-full px-3 py-1.5 shadow-xl backdrop-blur-sm">
        <button
          onClick={() => setZoom(zoom - ZOOM_STEP)}
          disabled={zoom <= ZOOM_MIN}
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-colors text-lg leading-none"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => setZoom(1)}
          className="min-w-[3.5rem] text-center text-sm font-mono text-gray-300 hover:text-white transition-colors"
          aria-label="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(zoom + ZOOM_STEP)}
          disabled={zoom >= ZOOM_MAX}
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-colors text-lg leading-none"
          aria-label="Zoom in"
        >
          ＋
        </button>
      </div>

      {/* Clock toolbar */}
      <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-gray-900/90 border border-gray-700 rounded-full px-3 py-1.5 shadow-xl backdrop-blur-sm">
        {/* Step badge */}
        <span className="text-xs font-mono text-gray-400 min-w-[4rem] text-center">
          {lastExecutedStep ?? clock.currentStep}
        </span>

        {/* Tick button */}
        <button
          onClick={tickClock}
          className="px-2.5 py-1 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          aria-label="Clock step"
          title={`Step → ${clock.currentStep}`}
        >
          Step
        </button>

        {/* Complete cycle */}
        <button
          onClick={completeCycle}
          className="px-2.5 py-1 rounded-full text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          aria-label="Complete cycle"
          title="Run all remaining steps in this cycle"
        >
          Cycle
        </button>

        {/* Reset */}
        <button
          onClick={resetClock}
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors text-sm leading-none"
          aria-label="Reset clock"
          title="Reset clock and all data objects"
        >
          ↺
        </button>

        {/* Counters */}
        <span className="text-[11px] font-mono text-gray-500 ml-1">
          T{clock.totalTicks} C{clock.totalCycles}
        </span>
      </div>

      <ClearCanvasButton />
      <AddComponentModal />
    </div>
  );
}