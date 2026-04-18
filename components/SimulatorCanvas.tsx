"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useLayoutStore, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore } from "@/lib/displayStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useEnhancedWireStore } from "@/lib/enhancedWireStore";
import { useModeStore } from "@/lib/modeStore";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // UI state
  const showWiresAndPorts = useDisplayStore((s) => s.showWiresAndPorts);
  const setShowWiresAndPorts = useDisplayStore((s) => s.setShowWiresAndPorts);
  const showCpuSignalWires = useDisplayStore((s) => s.showCpuSignalWires);
  const setShowCpuSignalWires = useDisplayStore((s) => s.setShowCpuSignalWires);
  const showDataSignalWires = useDisplayStore((s) => s.showDataSignalWires);
  const setShowDataSignalWires = useDisplayStore((s) => s.setShowDataSignalWires);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Mode state - determines what actions are allowed
  const isEditMode = useModeStore((s) => s.mode === "edit");

  // Clock state
  const tickClock = useSimulatorStore((s) => s.tickClock);
  const resetClock = useSimulatorStore((s) => s.resetClock);
  const getPrimaryCpu = useSimulatorStore((s) => s.getPrimaryCpu);
  const createSimulatorWire = useSimulatorStore((s) => s.createWire);
  const revision = useSimulatorStore((s) => s.revision);
  void revision;
  
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

  // Scroll to components or canvas centre on first mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    // If there are components, center on them; otherwise center on canvas
    if (components.length > 0) {
      // Calculate bounding box of all components
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      
      for (const c of components) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.w);
        maxY = Math.max(maxY, c.y + c.h);
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      el.scrollLeft = centerX * zoom - el.clientWidth / 2;
      el.scrollTop = centerY * zoom - el.clientHeight / 2;
    } else {
      // Center on canvas origin area for new projects
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
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

      const isConnectedWire = Boolean(endEndpoint);
      const shouldNormalizeDirection =
        isConnectedWire && sourceDirection === "input" && endEndpoint?.direction === "output";

      const enhancedStart = shouldNormalizeDirection
        ? {
            componentId: endEndpoint!.componentId,
            portName: endEndpoint!.portName,
            direction: "output" as const,
          }
        : {
            componentId: sourceComponentId,
            portName: sourcePortName,
            direction: sourceDirection,
          };

      const enhancedEnd = shouldNormalizeDirection
        ? {
            componentId: sourceComponentId,
            portName: sourcePortName,
            direction: "input" as const,
          }
        : endEndpoint;

      createEnhancedWire({
        start: enhancedStart,
        end: enhancedEnd,
        floatingEnd: endEndpoint ? null : floatingEnd,
        nodes: shouldNormalizeDirection ? [...nodes].reverse() : nodes,
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
    // Block component movement in simulation mode
    if (!isEditMode) return;
    
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

  const handleClear = () => {
    // Block clear in simulation mode
    if (!isEditMode) return;
    
    if (confirmClear) {
      clearComponents();
      setConfirmClear(false);
      setFabOpen(false);
    } else {
      setConfirmClear(true);
    }
  };

  // Find and center viewport on all components
  const handleFindComponents = useCallback(() => {
    const el = scrollRef.current;
    if (!el || components.length === 0) return;

    // Calculate bounding box of all components
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const c of components) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.w);
      maxY = Math.max(maxY, c.y + c.h);
    }

    // Add some padding
    const padding = 100;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Calculate the center of the bounding box
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate zoom to fit all components with some margin
    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;
    const viewportWidth = el.clientWidth;
    const viewportHeight = el.clientHeight;
    
    const fitZoomX = viewportWidth / boundingWidth;
    const fitZoomY = viewportHeight / boundingHeight;
    const fitZoom = Math.min(fitZoomX, fitZoomY, 1); // Don't zoom in more than 100%
    const clampedZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitZoom));
    
    setZoom(clampedZoom);
    
    // Center viewport on components after zoom is applied
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const newEl = scrollRef.current;
        newEl.scrollLeft = centerX * clampedZoom - newEl.clientWidth / 2;
        newEl.scrollTop = centerY * clampedZoom - newEl.clientHeight / 2;
        syncViewport();
      }
    });
  }, [components, setZoom, syncViewport]);

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
            <EnhancedBusOverlay visible={showWiresAndPorts} />
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
            {/* Add component - Edit mode only */}
            {isEditMode && (
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
            )}

            {/* Connect ports - Edit mode only */}
            {isEditMode && (
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
            )}

            {/* Toggle wires */}
            <FabItem
              label={showWiresAndPorts ? "Hide wires" : "Show wires"}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              color={showWiresAndPorts ? "bg-indigo-600 hover:bg-indigo-500" : "bg-gray-600 hover:bg-gray-500"}
              onClick={() => { setShowWiresAndPorts(!showWiresAndPorts); setFabOpen(false); }}
            />

            {/* Toggle CPU signal wires */}
            {showWiresAndPorts && (
              <FabItem
                label={showCpuSignalWires ? "Hide CPU signals" : "Show CPU signals"}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                }
                color={showCpuSignalWires ? "bg-blue-600 hover:bg-blue-500" : "bg-gray-600 hover:bg-gray-500"}
                onClick={() => { setShowCpuSignalWires(!showCpuSignalWires); setFabOpen(false); }}
              />
            )}

            {/* Toggle data signal wires */}
            {showWiresAndPorts && (
              <FabItem
                label={showDataSignalWires ? "Hide data signals" : "Show data signals"}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                }
                color={showDataSignalWires ? "bg-amber-600 hover:bg-amber-500" : "bg-gray-600 hover:bg-gray-500"}
                onClick={() => { setShowDataSignalWires(!showDataSignalWires); setFabOpen(false); }}
              />
            )}

            {/* Find components */}
            {components.length > 0 && (
              <FabItem
                label="Find components"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
                color="bg-emerald-600 hover:bg-emerald-500"
                onClick={() => { handleFindComponents(); setFabOpen(false); }}
              />
            )}

            {/* Clear canvas - Edit mode only */}
            {isEditMode && components.length > 0 && (
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


