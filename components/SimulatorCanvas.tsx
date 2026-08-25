"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Plus,
  Minus,
  Settings2,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useLayoutStore, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore } from "@/lib/displayStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useWireSelectionStore } from "@/lib/wireSelectionStore";
import { useProjectStore } from "@/lib/projectStore";
import { useAuthoring } from "@/lib/modeStore";
import { CanvasEditingProvider } from "@/components/CanvasEditingContext";
import { EDITOR_ENABLED } from "@/lib/editorFlag";
import { useExecutionStore } from "@/lib/executionStore";
import { GRID_SIZE, snapToGrid } from "@/lib/wireRouting";
import { calculatePortPosition, type PortSide } from "@/lib/portPositioning";
import WidgetRenderer from "./WidgetRenderer";
import AddComponentModal from "./AddComponentModal";
import SimulationSettings from "./SimulationSettings";
import EnhancedBusOverlay from "./EnhancedBusOverlay";
import { useEffect, useRef, useState, useCallback } from "react";



interface SimulatorCanvasProps {
  isReadOnly?: boolean;
}

export default function SimulatorCanvas({ isReadOnly = false }: SimulatorCanvasProps) {
  const components = useLayoutStore((s) => s.components);
  const zoom = useLayoutStore((s) => s.zoom);
  const updatePosition = useLayoutStore((s) => s.updatePosition);
  const clearComponents = useLayoutStore((s) => s.clearComponents);
  const setZoom = useLayoutStore((s) => s.setZoom);
  const setViewport = useLayoutStore((s) => s.setViewport);
  const scrollRef = useRef<HTMLDivElement>(null);

  // UI state
  const showWiresAndPorts = useDisplayStore((s) => s.showWiresAndPorts);
  const [showAddModal, setShowAddModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);

  // Mode state — determines what actions are allowed. `useAuthoring()` already
  // folds in the build flag, so a published build can never land here true.
  const authoring = useAuthoring();
  const isEditMode = authoring && !isReadOnly;

  const executionTick = useExecutionStore((s) => s.currentIndex);

  // Clock state
  const tickClock = useSimulatorStore((s) => s.tickClock);
  const resetClock = useSimulatorStore((s) => s.resetClock);
  const getPrimaryCpu = useSimulatorStore((s) => s.getPrimaryCpu);
  const revision = useSimulatorStore((s) => s.revision);
  void revision;
  
  // Get total ticks from the primary CPU
  const cpu = getPrimaryCpu();
  const totalTicks = cpu?.totalTicks ?? 0;
  const isHalted = cpu?.halted ?? false;
  const displayedTick = isReadOnly ? executionTick : totalTicks;

  // Display settings

  // Wire creation state (new drag-based API)
  const isCreatingWire = useWireCreationStore((s) => s.phase === "dragging");
  const updateDrag = useWireCreationStore((s) => s.updateDrag);
  const completeDrag = useWireCreationStore((s) => s.completeDrag);
  const sourceDirection = useWireCreationStore((s) => s.sourceDirection);
  const sourceComponentId = useWireCreationStore((s) => s.sourceComponentId);
  const sourcePortName = useWireCreationStore((s) => s.sourcePortName);
  const cancelWireCreation = useWireCreationStore((s) => s.cancelDrag);
  const createSimulatorWire = useSimulatorStore((s) => s.createWire);
  const addWireToProject = useProjectStore((s) => s.addWireToProject);
  const deselectWire = useWireSelectionStore((s) => s.deselectWire);
  const [wirePreviewRejected, setWirePreviewRejected] = useState(false);

  const flashRejectedPreview = useCallback(() => {
    setWirePreviewRejected(true);
    window.setTimeout(() => setWirePreviewRejected(false), 180);
  }, []);

  // Sync viewport state into the store whenever scroll or size changes
  const syncViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewport(
      { left: el.scrollLeft, top: el.scrollTop },
      { width: el.clientWidth, height: el.clientHeight },
    );
  }, [setViewport]);

  // Keep viewport in sync on scroll/resize
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

  // Close FAB / display settings when clicking outside
  useEffect(() => {
    if (!fabOpen && !showDisplaySettings) return;
    const handler = () => { setFabOpen(false); setShowDisplaySettings(false); };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [fabOpen, showDisplaySettings]);


  // Drag-based wire creation: track mouse and complete on mouseup.
  useEffect(() => {
    if (!isCreatingWire || isReadOnly) return;

    const resolveHoveredTargetFromEvent = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null);
      const candidate = target?.closest("[data-port-indicator]") as HTMLElement | null;
      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const fallback = elementAtPoint?.closest("[data-port-indicator]") as HTMLElement | null;
      const portEl = candidate ?? fallback;
      if (!portEl) return null;

      const componentId = portEl.dataset.portComponentId;
      const portName = portEl.dataset.portName;
      const direction = portEl.dataset.portDirection as "input" | "output" | undefined;
      const side = portEl.dataset.portSide as PortSide | undefined;
      const offset = Number(portEl.dataset.portOffset ?? "50");

      if (!componentId || !portName || !direction || !side) return null;
      if (direction === sourceDirection) return null;
      if (componentId === sourceComponentId && portName === sourcePortName) return null;

      const component = components.find((c) => c.id === componentId);
      if (!component) return null;

      const position = calculatePortPosition(component, side, Number.isFinite(offset) ? offset : 50);

      return {
        componentId,
        portName,
        direction,
        position,
        portSide: side,
      };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const el = scrollRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left + el.scrollLeft) / zoom;
      const canvasY = (e.clientY - rect.top + el.scrollTop) / zoom;

      // Check if hovering over a port indicator
      const portEl = (e.target as HTMLElement).closest("[data-port-indicator]") as HTMLElement | null;
      // Note: port hover is handled by PortsOverlay; we just update position here.
      if (!portEl) {
        updateDrag({ x: canvasX, y: canvasY });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const el = scrollRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left + el.scrollLeft) / zoom;
      const canvasY = (e.clientY - rect.top + el.scrollTop) / zoom;
      const hoveredTarget = resolveHoveredTargetFromEvent(e);

      if (hoveredTarget) {
        // Ensure store has an explicit target before completing.
        updateDrag({ x: canvasX, y: canvasY }, hoveredTarget);
      }

      const result = completeDrag();

      if (!result) {
        // No valid target — creation cancelled automatically by completeDrag
        return;
      }

      try {
        const wireId = createSimulatorWire(
          result.sourceComponentId,
          result.sourcePortName,
          result.targetComponentId,
          result.targetPortName,
          { nodes: result.nodes, visible: true },
        );

        if (!wireId) {
          flashRejectedPreview();
          return;
        }

        addWireToProject({
          id: wireId,
          sourceComponentId: result.sourceComponentId,
          sourcePortName: result.sourcePortName,
          targetComponentId: result.targetComponentId,
          targetPortName: result.targetPortName,
          label: "",
          visible: true,
          nodes: result.nodes,
        });

        setWirePreviewRejected(false);
      } catch (error) {
        console.error("Failed to connect wire:", error);
        flashRejectedPreview();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWirePreviewRejected(false);
        cancelWireCreation();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    isCreatingWire,
    isReadOnly,
    zoom,
    sourceDirection,
    sourceComponentId,
    sourcePortName,
    components,
    updateDrag,
    completeDrag,
    cancelWireCreation,
    createSimulatorWire,
    addWireToProject,
    flashRejectedPreview,
  ]);

  useEffect(() => {
    if (!isReadOnly) return;
    if (!isCreatingWire) return;
    cancelWireCreation();
  }, [isReadOnly, isCreatingWire, cancelWireCreation]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    // Block component movement in simulation mode and read-only mode.
    if (!isEditMode || isReadOnly) return;
    
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

  /**
   * Reset the simulation clock.
   */
  const handleReset = () => {
    resetClock();
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

  /**
   * Zoom and centre so the whole datapath fits the viewport.
   *
   * The canvas cannot be panned or wheel-zoomed any more, so this is the only
   * thing that positions the view: it runs on mount, whenever the set of
   * components changes (project switch) and on resize.
   */
  const fitToScreen = useCallback(() => {
    const el = scrollRef.current;
    if (!el || components.length === 0) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const c of components) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.w);
      maxY = Math.max(maxY, c.y + c.h);
    }

    const padding = 48;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const fitZoom = Math.min(
      el.clientWidth / (maxX - minX),
      el.clientHeight / (maxY - minY),
      1, // never magnify past 100%
    );
    const clampedZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitZoom));

    setZoom(clampedZoom);

    requestAnimationFrame(() => {
      const newEl = scrollRef.current;
      if (!newEl) return;
      newEl.scrollLeft = centerX * clampedZoom - newEl.clientWidth / 2;
      newEl.scrollTop = centerY * clampedZoom - newEl.clientHeight / 2;
      syncViewport();
    });
  }, [components, setZoom, syncViewport]);

  /** Re-centre at the current zoom, used by the +/- buttons. */
  const recentre = useCallback((nextZoom: number) => {
    const el = scrollRef.current;
    if (!el || components.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of components) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.w);
      maxY = Math.max(maxY, c.y + c.h);
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(nextZoom);
    requestAnimationFrame(() => {
      const newEl = scrollRef.current;
      if (!newEl) return;
      newEl.scrollLeft = centerX * nextZoom - newEl.clientWidth / 2;
      newEl.scrollTop = centerY * nextZoom - newEl.clientHeight / 2;
      syncViewport();
    });
  }, [components, setZoom, syncViewport]);

  // Fit on mount and whenever the datapath changes (e.g. switching projects).
  const componentSignature = components.map((c) => c.id).join("|");
  useEffect(() => {
    if (components.length === 0) return;
    // Wait a frame so the scroll container has its final size.
    const raf = requestAnimationFrame(fitToScreen);
    return () => cancelAnimationFrame(raf);
  // Deliberately keyed on the component set, not on fitToScreen's identity,
  // so dragging a widget in edit mode does not snap the view back.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentSignature]);

  // Keep the datapath fitted when the window changes size.
  useEffect(() => {
    const onResize = () => fitToScreen();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitToScreen]);

  return (
    <div
      ref={scrollRef}
      // Program mode locks the view: it is positioned only by fitToScreen and the
      // zoom buttons, so the datapath can no longer be lost by an accidental
      // scroll, wheel-zoom or background drag. Edit mode keeps normal scrolling,
      // otherwise there would be no way to reach canvas outside the fitted area
      // while authoring.
      className={`flex-1 min-h-0 relative ${
        isEditMode ? "overflow-auto" : "overflow-hidden scrollbar-hide"
      }`}
      style={{
        cursor: isCreatingWire ? "crosshair" : "default",
        background: "var(--canvas)",
      }}
      data-canvas
      onClick={(e) => {
        // Click on empty canvas deselects wires
        if ((e.target as HTMLElement).closest('[data-draggable], [data-port-indicator], button, svg path')) return;
        deselectWire();
      }}
    >
      <CanvasEditingProvider value={isEditMode}>
      <DndContext sensors={isEditMode ? sensors : []} onDragEnd={handleDragEnd}>
        <div style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}>
          <div
            className="relative origin-top-left"
            // Level of detail is set once, here, and resolved in CSS. Zoomed
            // out, a node keeps its silhouette and loses its anatomy; without
            // this the whole datapath is unreadable noise the moment the
            // student pulls back to see it end to end.
            // "full" starts just under the zoom fitToScreen typically lands on,
            // so the default view shows the anatomy; the thresholds exist to
            // declutter when the student pulls back, not to blank the first
            // screen they see.
            data-lod={zoom < 0.5 ? "low" : zoom < 0.85 ? "mid" : "full"}
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `scale(${zoom})`,
              background: "var(--canvas)",
              // The grid is an authoring aid: it only helps when placing widgets,
              // so it stays out of the way in program mode.
              backgroundImage: isEditMode
                ? "radial-gradient(circle, var(--grid-dot) 1px, transparent 1px)"
                : undefined,
              backgroundSize: "20px 20px",
            }}
          >
            <EnhancedBusOverlay visible={showWiresAndPorts} previewRejected={wirePreviewRejected} />
            {components.map((c) => (
              <WidgetRenderer key={c.id} component={c} zoom={zoom} />
            ))}
          </div>
        </div>
      </DndContext>
      </CanvasEditingProvider>

      {/* ── FAB actions menu (bottom-right) ───────────────── */}
      {/* ── Bottom-right controls ─────────────────────────
          The zoom cluster is a *viewing* control, not an authoring one, so it
          renders in both modes. It used to sit inside the authoring guard,
          which left program mode — the mode built for reading the datapath —
          with no way to zoom or refit at all. Everything above it is authoring
          and stays behind the guard. */}
      <div
        className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2"
        onMouseDown={(e) => e.stopPropagation()} // prevent outside-click handler
      >
        {/* Action items — slide up when open. Every item is neutral: these are
            commands, not states, so none of them is entitled to an accent. The
            only exception is the second press of Clear canvas, which is
            destructive and says so.

            The wire-visibility toggles that used to live here are gone: they
            duplicated switches in SimulationSettings, and the one that was
            *only* here — the master "show wires" — was unreachable for
            students. All four now live in the settings panel. */}
        {!isReadOnly && fabOpen && (
          <div className="mb-1 flex flex-col items-end gap-2">
            {isEditMode && (
              <FabItem
                label="Add component"
                icon={<Plus size={16} strokeWidth={1.5} />}
                onClick={() => { setShowAddModal(true); setFabOpen(false); }}
              />
            )}

            <FabItem
              label="Display settings"
              icon={<Settings2 size={16} strokeWidth={1.5} />}
              onClick={() => { setShowDisplaySettings(true); setFabOpen(false); }}
            />

            {isEditMode && components.length > 0 && (
              <FabItem
                label={confirmClear ? `Confirm clear (${components.length})` : "Clear canvas"}
                icon={<Trash2 size={16} strokeWidth={1.5} />}
                destructive={confirmClear}
                onClick={handleClear}
              />
            )}
          </div>
        )}

        {/* Display Settings Panel — the same component program mode mounts, so
            there is one definition of what a simulation setting is. */}
        {!isReadOnly && showDisplaySettings && (
          <div
            className="mb-2 rounded-2xl border border-line bg-surface p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <SimulationSettings />
          </div>
        )}

        {/* Zoom controls — the only way to zoom. Wheel zoom and drag-to-pan are
            gone on purpose: they used to fire by accident all the time. The
            percentage doubles as "fit to screen". */}
        <div
          className="flex items-center gap-1 overflow-hidden rounded-full border border-line bg-surface px-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => recentre(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
            disabled={zoom <= ZOOM_MIN}
            className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg disabled:opacity-30"
            title="Diminuir zoom"
            aria-label="Diminuir zoom"
          ><Minus size={14} strokeWidth={1.5} /></button>
          <button
            onClick={fitToScreen}
            className="num min-w-[3.5rem] text-center font-mono text-xs text-fg-muted transition-colors hover:text-fg"
            title="Ajustar à tela"
            aria-label="Ajustar à tela"
          >{Math.round(zoom * 100)}%</button>
          <button
            onClick={() => recentre(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
            disabled={zoom >= ZOOM_MAX}
            className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg disabled:opacity-30"
            title="Aumentar zoom"
            aria-label="Aumentar zoom"
          ><Plus size={14} strokeWidth={1.5} /></button>
        </div>

        {/* Main FAB button */}
        {!isReadOnly && (
          <button
            onClick={() => { setFabOpen((v) => !v); setConfirmClear(false); setShowDisplaySettings(false); }}
            className={`flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-surface text-fg transition-transform ${
              fabOpen ? "rotate-45" : ""
            }`}
            aria-label="Actions"
          >
            <Plus size={20} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* ── Clock toolbar (bottom-left) ─────────────────────
          Edit mode only. In program mode the tick is read from the
          seven-segment display, and this used to sit under the simulation bar
          showing the same number a second time. */}
      {!isReadOnly && (
      <div
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="num min-w-[4rem] text-center font-mono text-xs text-fg-muted">T{displayedTick}</span>

        {(
          <>
            <button
              onClick={tickClock}
              disabled={isHalted}
              className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-fg transition-colors hover:border-st-active disabled:cursor-not-allowed disabled:opacity-50"
              title="Advance clock by one tick"
            >Tick</button>
            <button
              onClick={handleReset}
              className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg"
              title="Reset clock"
            ><RotateCcw size={14} strokeWidth={1.5} /></button>
            {isHalted && (
              <span className="flex items-center gap-1.5 rounded-full border border-st-error px-2 py-0.5 text-xs text-st-error">
                Halted
              </span>
            )}
          </>
        )}
      </div>
      )}

      {EDITOR_ENABLED && isEditMode && (
        <AddComponentModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

// ── FAB menu item ─────────────────────────────────────────────
function FabItem({
  label, icon, onClick, on = false, destructive = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** Toggle that is currently on — marked by the accent on the icon only. */
  on?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border py-2 pl-3 pr-4 text-sm transition-colors ${
        destructive
          ? "border-st-error bg-surface text-st-error"
          : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg"
      }`}
    >
      <span className={on ? "text-st-active" : undefined}>{icon}</span>
      {label}
    </button>
  );
}
