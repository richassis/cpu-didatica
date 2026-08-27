"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import AssemblyPanel from "@/components/ProgramMode/AssemblyPanel";
import AssembledPanel from "@/components/ProgramMode/AssembledPanel";
import BuildBar from "@/components/ProgramMode/BuildBar";
import DatapathViewer from "@/components/ProgramMode/DatapathViewer";
import SimulationBar from "@/components/ProgramMode/SimulationBar";
import { useExecutionStore } from "@/lib/executionStore";
import useSimulationShortcuts from "@/lib/useSimulationShortcuts";

/** Share of the screen the code region takes before a program is running. */
const WIDTH_BEFORE_RUN = "60%";
/** Share once the timeline is active — the datapath is the point now. */
const WIDTH_DURING_RUN = "26%";

/** Width of a panel collapsed to its rail, and of the Montagem panel expanded. */
const RAIL_W = 36;
const MONTAGEM_W = 220;

/**
 * ProgramModeLayout — Full-screen layout for Program Mode.
 *
 * ┌──────────────┬──────────────────────────────────────────┐
 * │  BuildBar (Montar / Executar)                            │
 * ├──────────────┤                                          │
 * │  Assembly    │   Datapath Canvas (read-only)            │
 * │  + bytecode  │                                          │
 * │  (60% / 26%) │                                          │
 * │              │                                          │
 * ├──────────────┴──────────────────────────────────────────┤
 * │  SimulationBar (always mounted; transport when running) │
 * └─────────────────────────────────────────────────────────┘
 *
 * The code region is wide before Executar — writing the program is the point
 * — and narrows once the timeline takes over, so the datapath gets the room.
 * A manual drag overrides both defaults until the timeline exits, at which
 * point the override is cleared: what the student decided about a running
 * program shouldn't linger after it stops meaning anything.
 *
 * Either panel — Assembly, Montagem, or both — can collapse to a narrow rail
 * by clicking its header, and the region actually shrinks when they do,
 * handing the freed width to the datapath rather than leaving it blank.
 * BuildBar sits above both panels rather than inside either header, so
 * Montar/Executar stay reachable regardless of what is collapsed.
 */
export default function ProgramModeLayout() {
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
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
  const codeRegionWidth = asmCollapsed
    ? `${RAIL_W + (mountCollapsed ? RAIL_W : MONTAGEM_W)}px`
    : mountCollapsed
      ? `calc(${baseWidth} - ${MONTAGEM_W - RAIL_W}px)`
      : baseWidth;

  return (
    /* The bar is always mounted, so the padding that clears it is unconditional
       too — settings and the legend have to be reachable before the first Run. */
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
          <BuildBar />

          <div className="flex min-h-0 flex-1">
            {asmCollapsed ? (
              <CollapsedRail label="Assembly" onExpand={() => setAsmCollapsed(false)} />
            ) : (
              <div className="min-h-0 min-w-0 flex-1">
                <AssemblyPanel onToggleCollapse={() => setAsmCollapsed(true)} />
              </div>
            )}

            {mountCollapsed ? (
              <CollapsedRail label="Montagem" onExpand={() => setMountCollapsed(false)} />
            ) : (
              <AssembledPanel onToggleCollapse={() => setMountCollapsed(true)} />
            )}
          </div>

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
