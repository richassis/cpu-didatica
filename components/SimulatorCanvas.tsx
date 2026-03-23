"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useLayoutStore, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX, CANVAS_WIDTH, CANVAS_HEIGHT, ProjectSnapshot } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore } from "@/lib/displayStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useEnhancedWireStore } from "@/lib/enhancedWireStore";
import { snapToGrid } from "@/lib/wireRouting";
import WidgetRenderer from "./WidgetRenderer";
import AddComponentModal from "./AddComponentModal";
import EnhancedBusOverlay from "./EnhancedBusOverlay";
import ConnectionModal from "./ConnectionModal";
import { useEffect, useRef, useState, useCallback } from "react";

export const GRID_SIZE = 16;

export default function SimulatorCanvas() {
  const components = useLayoutStore((s) => s.components);
  const zoom = useLayoutStore((s) => s.zoom);
  const updatePosition = useLayoutStore((s) => s.updatePosition);
  const clearComponents = useLayoutStore((s) => s.clearComponents);
  const setZoom = useLayoutStore((s) => s.setZoom);
  const setViewport = useLayoutStore((s) => s.setViewport);
  const saveProject = useLayoutStore((s) => s.saveProject);
  const loadProject = useLayoutStore((s) => s.loadProject);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [showBusOverlay, setShowBusOverlay] = useState(true);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Clock state
  const tickClock = useSimulatorStore((s) => s.tickClock);
  const resetClock = useSimulatorStore((s) => s.resetClock);
  const getPrimaryCpu = useSimulatorStore((s) => s.getPrimaryCpu);
  const createSimulatorWire = useSimulatorStore((s) => s.createWire);
  const revision = useSimulatorStore((s) => s.revision);
  
  // Get total ticks from the primary CPU
  const cpu = getPrimaryCpu();
  const totalTicks = cpu?.totalTicks ?? 0;

  // Numeric base setting
  const numericBase = useDisplayStore((s) => s.numericBase);
  const setNumericBase = useDisplayStore((s) => s.setNumericBase);

  // Wire creation state
  const isCreatingWire = useWireCreationStore((s) => s.isCreating);
  const sourceComponentId = useWireCreationStore((s) => s.sourceComponentId);
  const sourcePortName = useWireCreationStore((s) => s.sourcePortName);
  const sourceDirection = useWireCreationStore((s) => s.sourceDirection);
  const pathPoints = useWireCreationStore((s) => s.pathPoints);
  const updateMousePosition = useWireCreationStore((s) => s.updateMousePosition);
  const finishWireCreation = useWireCreationStore((s) => s.finishWireCreation);
  const cancelWireCreation = useWireCreationStore((s) => s.cancelWireCreation);

  const createEnhancedWire = useEnhancedWireStore((s) => s.createWire);

  // Sync viewport state into the store whenever scroll or size changes
  const syncViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewport(
      { left: el.scrollLeft, top: el.scrollTop },
      { width: el.clientWidth, height: el.clientHeight },
    );
  }, [setViewport]);

  // Scroll to canvas centre on first mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (CANVAS_WIDTH  * zoom - el.clientWidth)  / 2;
    el.scrollTop  = (CANVAS_HEIGHT * zoom - el.clientHeight) / 2;
    syncViewport();
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep viewport in sync on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", syncViewport, { passive: true });
    const ro = new ResizeObserver(syncViewport);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncViewport);
      ro.disconnect();
    };
  }, [syncViewport]);

  // Scroll wheel to zoom (Google Maps style)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom + delta));
      
      // Zoom towards cursor position
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate scroll position to keep zoom centered on cursor
      const scrollX = (el.scrollLeft + mouseX) / zoom * newZoom - mouseX;
      const scrollY = (el.scrollTop + mouseY) / zoom * newZoom - mouseY;
      
      setZoom(newZoom);
      
      // Apply new scroll position after zoom
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = scrollX;
          scrollRef.current.scrollTop = scrollY;
        }
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, setZoom]);

  // Close FAB when clicking outside
  useEffect(() => {
    if (!fabOpen) return;
    const handler = () => setFabOpen(false);
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [fabOpen]);

  // Click and drag to pan (Google Maps style)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      // Only pan on primary button and not on interactive elements
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Don't pan if clicking on widgets, ports, or interactive elements
      if (target.closest('[data-draggable], [data-port-indicator], button, input, select, textarea, svg')) return;
      
      setIsPanning(true);
      setPanStart({ x: e.clientX + el.scrollLeft, y: e.clientY + el.scrollTop });
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      el.scrollLeft = panStart.x - e.clientX;
      el.scrollTop = panStart.y - e.clientY;
    };

    const onMouseUp = () => {
      setIsPanning(false);
    };

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isPanning, panStart]);

  // Track mouse position for wire creation preview
  useEffect(() => {
    if (!isCreatingWire) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      
      const rect = el.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left + el.scrollLeft) / zoom;
      const canvasY = (e.clientY - rect.top + el.scrollTop) / zoom;
      
      updateMousePosition(canvasX, canvasY);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelWireCreation();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!sourceComponentId || !sourcePortName || !sourceDirection || pathPoints.length < 2) {
        finishWireCreation();
        return;
      }

      const targetElement = (e.target as HTMLElement).closest("[data-port-indicator]") as HTMLElement | null;

      let endEndpoint: { componentId: string; portName: string; direction: "input" | "output" } | null = null;
      if (targetElement) {
        const targetComponentId = targetElement.dataset.portComponentId;
        const targetPortName = targetElement.dataset.portName;
        const targetDirection = targetElement.dataset.portDirection as "input" | "output" | undefined;

        if (
          targetComponentId &&
          targetPortName &&
          targetDirection &&
          targetDirection !== sourceDirection &&
          !(targetComponentId === sourceComponentId && targetPortName === sourcePortName)
        ) {
          endEndpoint = {
            componentId: targetComponentId,
            portName: targetPortName,
            direction: targetDirection,
          };
        }
      }

      const nodes = pathPoints.slice(1, -1);
      const floatingEnd = pathPoints[pathPoints.length - 1];

      createEnhancedWire({
        start: {
          componentId: sourceComponentId,
          portName: sourcePortName,
          direction: sourceDirection,
        },
        end: endEndpoint,
        floatingEnd: endEndpoint ? null : floatingEnd,
        nodes,
      });

      if (endEndpoint) {
        try {
          if (sourceDirection === "output" && endEndpoint.direction === "input") {
            createSimulatorWire(sourceComponentId, sourcePortName, endEndpoint.componentId, endEndpoint.portName);
          } else if (sourceDirection === "input" && endEndpoint.direction === "output") {
            createSimulatorWire(endEndpoint.componentId, endEndpoint.portName, sourceComponentId, sourcePortName);
          }
        } catch (error) {
          console.error("Failed to connect simulator wire:", error);
        }
      }

      finishWireCreation();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isCreatingWire,
    zoom,
    sourceComponentId,
    sourcePortName,
    sourceDirection,
    pathPoints,
    updateMousePosition,
    finishWireCreation,
    cancelWireCreation,
    createEnhancedWire,
    createSimulatorWire,
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (delta.x !== 0 || delta.y !== 0) {
      const dx = delta.x / zoom;
      const dy = delta.y / zoom;
      
      // Snap to grid
      const component = components.find(c => c.id === String(active.id));
      if (component) {
        const newX = snapToGrid(component.x + dx, GRID_SIZE);
        const newY = snapToGrid(component.y + dy, GRID_SIZE);
        updatePosition(String(active.id), newX - component.x, newY - component.y);
      }
    }
  };

  const handleLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const snapshot = JSON.parse(ev.target?.result as string) as ProjectSnapshot;
        if (snapshot.version !== 1) throw new Error("Unsupported project version");
        loadProject(snapshot);
        setFabOpen(false);
      } catch (err) {
        alert(`Failed to load project: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-loaded
    e.target.value = "";
  };

  const handleClear = () => {
    if (confirmClear) {
      clearComponents();
      setConfirmClear(false);
      setFabOpen(false);
    } else {
      setConfirmClear(true);
    }
  };

  return (
    <div 
      ref={scrollRef} 
      className="flex-1 min-h-0 overflow-auto bg-gray-950 relative scrollbar-hide"
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      data-canvas
    >
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}>
          <div
            className="relative bg-gray-900 origin-top-left"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `scale(${zoom})`,
              backgroundImage: "radial-gradient(circle, #374151 1px, transparent 1px)",
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            }}
          >
            <EnhancedBusOverlay visible={showBusOverlay} />
            {components.map((c) => (
              <WidgetRenderer key={c.id} component={c} zoom={zoom} />
            ))}
          </div>
        </div>
      </DndContext>

      {/* ── FAB actions menu (bottom-right) ───────────────── */}
      <div
        className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2"
        onMouseDown={(e) => e.stopPropagation()} // prevent outside-click handler
      >
        {/* Action items — slide up when open */}
        {fabOpen && (
          <div className="flex flex-col items-end gap-2 mb-1">
            {/* Add component */}
            <FabItem
              label="Add component"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
              color="bg-cyan-600 hover:bg-cyan-500"
              onClick={() => { setShowAddModal(true); setFabOpen(false); }}
            />

            {/* Connect ports */}
            <FabItem
              label="Connect ports"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8M8 12a4 4 0 100-8 4 4 0 000 8zm8 0a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              }
              color="bg-purple-600 hover:bg-purple-500"
              onClick={() => { setShowConnectionModal(true); setFabOpen(false); }}
            />

            {/* Toggle wires */}
            <FabItem
              label={showBusOverlay ? "Hide wires" : "Show wires"}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              color={showBusOverlay ? "bg-indigo-600 hover:bg-indigo-500" : "bg-gray-600 hover:bg-gray-500"}
              onClick={() => { setShowBusOverlay((v) => !v); setFabOpen(false); }}
            />

            {/* Save project to file */}
            <FabItem
              label="Save project"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              }
              color="bg-emerald-600 hover:bg-emerald-500"
              onClick={() => { saveProject(); setFabOpen(false); }}
            />

            {/* Load project from file */}
            <FabItem
              label="Load project"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
                </svg>
              }
              color="bg-sky-600 hover:bg-sky-500"
              onClick={() => fileInputRef.current?.click()}
            />

            {/* Clear canvas */}
            {components.length > 0 && (
              <FabItem
                label={confirmClear ? `Confirm clear (${components.length})` : "Clear canvas"}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                }
                color={confirmClear ? "bg-red-600 hover:bg-red-500" : "bg-gray-700 hover:bg-red-700"}
                onClick={handleClear}
              />
            )}
          </div>
        )}

        {/* Main FAB button */}
        <button
          onClick={() => { setFabOpen((v) => !v); setConfirmClear(false); }}
          className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-white text-xl font-bold transition-all ${
            fabOpen ? "bg-gray-600 rotate-45" : "bg-gray-800 hover:bg-gray-700 border border-gray-600"
          }`}
          aria-label="Actions"
        >
          {fabOpen ? "✕" : "⋯"}
        </button>
      </div>

      {/* ── Zoom toolbar (bottom-centre) ──────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
        {/* Numeric base selector */}
        <div className="flex items-center gap-0.5 bg-gray-900/90 border border-gray-700 rounded-full px-2 py-1.5 shadow-xl backdrop-blur-sm">
          {(["hex", "dec", "bin", "oct"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setNumericBase(b)}
              className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold transition-colors ${
                numericBase === b
                  ? "bg-cyan-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {b.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-gray-900/90 border border-gray-700 rounded-full px-3 py-1.5 shadow-xl backdrop-blur-sm">
          <button
            onClick={() => setZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-colors text-lg leading-none"
            aria-label="Zoom out"
          >−</button>
          <button
            onClick={() => setZoom(1)}
            className="min-w-[3.5rem] text-center text-sm font-mono text-gray-300 hover:text-white transition-colors"
            aria-label="Reset zoom"
          >{Math.round(zoom * 100)}%</button>
          <button
            onClick={() => setZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= ZOOM_MAX}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-colors text-lg leading-none"
            aria-label="Zoom in"
          >＋</button>
        </div>
      </div>

      {/* ── Clock toolbar (bottom-left) ───────────────────── */}
      <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-gray-900/90 border border-gray-700 rounded-full px-3 py-1.5 shadow-xl backdrop-blur-sm">
        <span className="text-xs font-mono text-gray-400 min-w-[4rem] text-center">T{totalTicks}</span>
        <button
          onClick={tickClock}
          className="px-2.5 py-1 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          title="Advance clock by one tick"
        >Tick</button>
        <button
          onClick={resetClock}
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          title="Reset clock"
        >↺</button>
      </div>

      {/* Hidden file input for project loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleLoadFile}
      />

      <AddComponentModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <ConnectionModal isOpen={showConnectionModal} onClose={() => setShowConnectionModal(false)} />
    </div>
  );
}

// ── FAB menu item ─────────────────────────────────────────────
function FabItem({
  label, icon, color, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 pl-3 pr-4 py-2 rounded-full text-sm font-medium text-white shadow-lg transition-all ${color}`}
    >
      {icon}
      {label}
    </button>
  );
}


