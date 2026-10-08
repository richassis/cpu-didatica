"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import AssemblyPanel from "@/components/ProgramMode/AssemblyPanel";
import AssembledPanel from "@/components/ProgramMode/AssembledPanel";
import WelcomeDialog from "@/components/Onboarding/WelcomeDialog";
import TourOverlay from "@/components/Onboarding/TourOverlay";
import DatapathViewer from "@/components/ProgramMode/DatapathViewer";
import MemoryPanel from "@/components/ProgramMode/MemoryPanel";
import SimulationBar from "@/components/ProgramMode/SimulationBar";
import { useExecutionStore } from "@/lib/executionStore";
import { useMemoryPanelStore } from "@/lib/memoryPanelStore";
import useSimulationShortcuts from "@/lib/useSimulationShortcuts";

/** Share of the screen the code region takes before a program is running. */
const WIDTH_BEFORE_RUN = "60%";
/** Share once the timeline is active — the datapath is the point now. */
const WIDTH_DURING_RUN = "max(26%, 28rem)";

/** Width of a panel collapsed to its rail. */
const RAIL_W = 36;
/** Width of the Ling. Máquina panel expanded — in rem, so it grows with the text size. */
const MONTAGEM_W_REM = 13.5;

/** Width the code region takes while the memories are open — two columns. */
const MEMORY_PANEL_W = 480;

/**
 * ProgramModeLayout — Full-screen layout for Program Mode.
 *
 * ┌──────────────┬──────────────────────────────────────────┐
 * │  Ling.       │   Datapath Canvas (read-only)            │
 * │  Montagem +  │                                          │
 * │  Ling. Máq.  │                                          │
 * │  (60% / 26%) │                                          │
 * ├──────────────┴──────────────────────────────────────────┤
 * │  SimulationBar (Montar, Simular, player, contador)      │
 * └─────────────────────────────────────────────────────────┘
 *
 * The code region is wide before Simular — writing the program is the point
 * — and narrows once the timeline takes over, so the datapath gets the room.
 * A manual drag overrides both defaults until the timeline exits, at which
 * point the override is cleared: what the student decided about a running
 * program shouldn't linger after it stops meaning anything.
 *
 * Either panel — Ling. Montagem, Ling. Máquina, or both — can collapse to a narrow rail
 * by clicking its header, and the region actually shrinks when they do,
 * handing the freed width to the datapath rather than leaving it blank.
 * Montar/Simular live in the bottom bar, so they stay reachable whatever
 * the region is showing — either code panel collapsed, or the memories open.
 */
export default function ProgramModeLayout() {
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
  const inspectedMemoryId = useMemoryPanelStore((s) => s.inspectedMemoryId);
  const memoryOpen = inspectedMemoryId !== null;
  const [manualWidth, setManualWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [asmCollapsed, setAsmCollapsed] = useState(false);
  const [mountCollapsed, setMountCollapsed] = useState(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset the drag override the moment the timeline exits — adjusted during
  // render (React's sanctioned way to react to a derived value changing),
  // not in an effect, so it lands in the same commit rather than one render late.
  const [prevTimelineActive, setPrevTimelineActive] = useState(isTimelineActive);
  if (prevTimelineActive !== isTimelineActive) {
    setPrevTimelineActive(isTimelineActive);
    if (prevTimelineActive && !isTimelineActive) {
      setManualWidth(null);
    }
  }

  const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const startWidth =
      manualWidth ?? containerRef.current?.querySelector("[data-code-region]")?.getBoundingClientRect().width ?? 300;
    dragStateRef.current = { startX: event.clientX, startWidth };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [manualWidth]);

  const handleDragMove = useCallback((event: PointerEvent) => {
    if (!dragStateRef.current) return;
    const delta = event.clientX - dragStateRef.current.startX;
    const nextWidth = dragStateRef.current.startWidth + delta;
    const clamped = Math.max(220, Math.min(900, nextWidth));
    setManualWidth(clamped);
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

  // Base width before collapse is factored in — a CSS percentage while auto,
  // a pixel value once the student has dragged the separator.
  const baseWidth = manualWidth != null ? `${manualWidth}px` : isTimelineActive ? WIDTH_DURING_RUN : WIDTH_BEFORE_RUN;
  const codeRegionWidth = memoryOpen
    ? `${manualWidth ?? MEMORY_PANEL_W}px`
    : asmCollapsed
      ? `calc(${RAIL_W}px + ${mountCollapsed ? `${RAIL_W}px` : `${MONTAGEM_W_REM}rem`})`
      : mountCollapsed
        ? `calc(${baseWidth} - ${MONTAGEM_W_REM}rem + ${RAIL_W}px)`
        : baseWidth;

  return (
    /* The bar is always mounted, so the padding that clears it is unconditional
       too — Montar and Simular have to be reachable before the first Run. */
    <div className="relative flex-1 min-h-0 pb-24" ref={containerRef}>
      <div className="flex h-full min-h-0">
        {/* Left: code region — editor + bytecode (resizable, and it shrinks once
            the timeline takes over, or either panel collapses). */}
        <div
          data-code-region
          className={`relative flex shrink-0 min-h-0 flex-col overflow-hidden ${
            isDragging ? "" : "transition-[width] duration-300 ease-out"
          }`}
          style={{ width: codeRegionWidth, minWidth: 240 }}
        >
          {memoryOpen ? (
            <div className="min-h-0 flex-1">
              <MemoryPanel />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              {asmCollapsed ? (
                <CollapsedRail label="Ling. Montagem" onExpand={() => setAsmCollapsed(false)} />
              ) : (
                <div className="min-h-0 min-w-0 flex-1">
                  <AssemblyPanel onToggleCollapse={() => setAsmCollapsed(true)} />
                </div>
              )}

              {mountCollapsed ? (
                <CollapsedRail label="Ling. Máquina" onExpand={() => setMountCollapsed(false)} />
              ) : (
                <AssembledPanel onToggleCollapse={() => setMountCollapsed(true)} />
              )}
            </div>
          )}

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar painel de códigos"
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

      <WelcomeDialog />
      <TourOverlay />
    </div>
  );
}

/**
 * A collapsed panel's stand-in: a narrow clickable rail with its title read
 * top-to-bottom. Rendered by the layout in place of the panel itself, so
 * neither panel component has to know how to draw its own collapsed state.
 */
function CollapsedRail({ label, onExpand }: { label: string; onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      aria-expanded="false"
      title={`Expandir ${label}`}
      className="flex w-9 shrink-0 flex-col items-center gap-2 border-r border-line bg-surface py-3 transition-colors hover:bg-raised"
    >
      <ChevronRight size={14} strokeWidth={1.5} className="shrink-0 text-fg-faint" />
      <span
        className="t-panel text-fg"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {label}
      </span>
    </button>
  );
}
