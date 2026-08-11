"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useLayoutStore } from "@/lib/store";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import type { PortSide } from "@/lib/portPositioning";

const DRAG_THRESHOLD = 4; // px of movement before we consider it a drag

interface Props {
  portName: string;
  direction: "input" | "output";
  componentId: string;
  position: PortSide;
  offset?: number;
  /** Port side for routing (same as position) */
  portSide: PortSide;
  /** Whether this port is a valid drop target during wire creation */
  isDropTarget?: boolean;
  /** Whether this port is currently being hovered during wire creation */
  isHoveredTarget?: boolean;
  onDragStart?: (
    componentId: string,
    portName: string,
    direction: "input" | "output",
    portSide: PortSide,
    event: React.PointerEvent,
  ) => void;
  onPortHoverStart?: (
    componentId: string,
    portName: string,
    direction: "input" | "output",
    portSide: PortSide,
  ) => void;
  onPortHoverEnd?: () => void;
}

/**
 * Determine if a port is a control signal based on component type and port name
 */
function isControlSignalPort(componentType: string, portName: string, direction: "input" | "output"): boolean {
  // CPU outputs are all control signals
  if (componentType === "CpuComponent" && direction === "output") {
    return true;
  }
  
  // Mux/Multiplexer select signals are control
  if (portName === "select" || portName === "sel" || portName.includes("select")) {
    return true;
  }
  
  // Write enables and read enables are control signals
  if (portName.includes("writeEnable") || portName.includes("wrEnable") || 
      portName.includes("rdMem") || portName.includes("wrMem") ||
      portName.includes("wrReg") || portName.includes("wrPC") || portName.includes("wrIR")) {
    return true;
  }
  
  // Operation selectors are control signals
  if (portName.includes("operation") || portName.includes("opULA")) {
    return true;
  }
  
  // Mux selectors are control signals
  if (portName.includes("mux")) {
    return true;
  }
  
  return false;
}

export default function PortIndicator({ 
  portName, 
  direction, 
  componentId, 
  position,
  offset = 50,
  portSide,
  isDropTarget = false,
  isHoveredTarget = false,
  onDragStart,
  onPortHoverStart,
  onPortHoverEnd,
}: Props) {
  const [hover, setHover] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const objects = useSimulatorStore((s) => s.objects);
  const revision = useSimulatorStore((s) => s.revision);
  const components = useLayoutStore((s) => s.components);
  const phase = useWireCreationStore((s) => s.phase);
  const isCreating = phase === "dragging";

  // Drag detection refs
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  // Get component type for control signal detection
  const component = components.find(c => c.id === componentId);
  const componentType = component?.type ?? "";
  const isControlSignal = isControlSignalPort(componentType, portName, direction);

  const portValue = useMemo(() => {
    void revision;
    const obj = objects.get(componentId);
    if (!obj || !("getPorts" in obj)) return "";

    const portMap = (obj as { getPorts: () => Record<string, { value: unknown }> }).getPorts();
    const port = portMap[portName];
    if (!port) return "";

    const val = port.value;
    if (typeof val === "number") {
      return `0x${val.toString(16).toUpperCase().padStart(4, "0")}`;
    }
    if (typeof val === "boolean") {
      return val ? "1" : "0";
    }
    return String(val);
  }, [componentId, portName, objects, revision]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDownPos.current || isDragging.current) return;

    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= DRAG_THRESHOLD) {
      isDragging.current = true;
      pointerDownPos.current = null;

      // Release pointer capture so the canvas can handle mouse events
      const target = e.currentTarget as HTMLElement;
      target.releasePointerCapture(e.pointerId);

      onDragStart?.(componentId, portName, direction, portSide, e);
    }
  }, [componentId, portName, direction, portSide, onDragStart]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointerDownPos.current = null;
    isDragging.current = false;

    const target = e.currentTarget as HTMLElement;
    try {
      target.releasePointerCapture(e.pointerId);
    } catch {
      // Already released
    }
  }, []);

  const handlePointerEnter = useCallback(() => {
    setHover(true);
    if (dotRef.current) {
      const r = dotRef.current.getBoundingClientRect();
      setTooltipAnchor({ x: r.left + r.width / 2, y: r.top });
    }
    if (isCreating) {
      onPortHoverStart?.(componentId, portName, direction, portSide);
    }
  }, [isCreating, componentId, portName, direction, portSide, onPortHoverStart]);

  const handlePointerLeave = useCallback(() => {
    setHover(false);
    setTooltipAnchor(null);
    if (isCreating) {
      onPortHoverEnd?.();
    }
  }, [isCreating, onPortHoverEnd]);

  // Position the port based on side. Half the 6px dot, so it straddles the
  // node's border rather than floating beside it.
  const positionStyles: React.CSSProperties = {
    position: "absolute",
    ...(position === "left" && { left: -3, top: `${offset}%`, transform: "translateY(-50%)" }),
    ...(position === "right" && { right: -3, top: `${offset}%`, transform: "translateY(-50%)" }),
    ...(position === "top" && { top: -3, left: `${offset}%`, transform: "translateX(-50%)" }),
    ...(position === "bottom" && { bottom: -3, left: `${offset}%`, transform: "translateX(-50%)" }),
  };

  const isInput = direction === "input";

  // Direction is carried by SHAPE, not by colour — output is a filled disc,
  // input a hollow ring, a control signal a square. Colour is reserved for
  // state, so the distinction has to survive greyscale, and it does.
  const shapeClass = isControlSignal ? "port--ctrl" : isInput ? "port--in" : "port--out";

  // A port carrying a non-zero value is live and takes the data colour.
  const isLive = portValue !== "" && portValue !== "0" && !/^0x0+$/.test(portValue);

  return (
    <div
      style={positionStyles}
      className="pointer-events-auto z-20"
      data-port-indicator
      data-port-component-id={componentId}
      data-port-name={portName}
      data-port-direction={direction}
      data-port-side={portSide}
      data-port-offset={offset}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div
        ref={dotRef}
        data-live={isLive || undefined}
        data-drop={isDropTarget || isHoveredTarget || undefined}
        className={`port cursor-pointer ${shapeClass} ${hover ? "scale-150" : ""}`}
      />

      {/* Tooltip portalled into #portal-root — a fixed div at (0,0) with z-index 999999
          rendered as the last child of <body>, guaranteed above every stacking context. */}
      {hover && !isCreating && tooltipAnchor && typeof document !== "undefined" &&
        (() => {
          const root = document.getElementById("portal-root");
          if (!root) return null;
          return createPortal(
            <div
              className="whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 font-mono text-[11px]"
              style={{
                position: "absolute",
                left: tooltipAnchor.x,
                top: tooltipAnchor.y - 6,
                transform: "translate(-50%, -100%)",
                pointerEvents: "none",
              }}
            >
              <div className="text-fg-muted">{portName}</div>
              <div className="num text-fg">{portValue}</div>
            </div>,
            root,
          );
        })()
      }
    </div>
  );
}
