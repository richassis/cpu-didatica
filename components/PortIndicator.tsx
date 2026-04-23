"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  const [portValue, setPortValue] = useState<string>("");
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

  useEffect(() => {
    const obj = objects.get(componentId);
    if (!obj || !("getPorts" in obj)) return;

    const portMap = (obj as { getPorts: () => Record<string, { value: unknown }> }).getPorts();
    const port = portMap[portName];
    if (!port) return;

    const val = port.value;
    const newValue =
      typeof val === "number"
        ? `0x${val.toString(16).toUpperCase().padStart(4, "0")}`
        : typeof val === "boolean"
          ? (val ? "1" : "0")
          : String(val);

    setPortValue((prev) => (prev === newValue ? prev : newValue));
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
    if (isCreating) {
      onPortHoverStart?.(componentId, portName, direction, portSide);
    }
  }, [isCreating, componentId, portName, direction, portSide, onPortHoverStart]);

  const handlePointerLeave = useCallback(() => {
    setHover(false);
    if (isCreating) {
      onPortHoverEnd?.();
    }
  }, [isCreating, onPortHoverEnd]);

  // Position the port based on side
  const positionStyles: React.CSSProperties = {
    position: "absolute",
    ...(position === "left" && { left: -6, top: `${offset}%`, transform: "translateY(-50%)" }),
    ...(position === "right" && { right: -6, top: `${offset}%`, transform: "translateY(-50%)" }),
    ...(position === "top" && { top: -6, left: `${offset}%`, transform: "translateX(-50%)" }),
    ...(position === "bottom" && { bottom: -6, left: `${offset}%`, transform: "translateX(-50%)" }),
  };

  const isInput = direction === "input";
  
  // Color scheme based on port type
  let color: string, hoverColor: string, borderColor: string, tooltipColor: string;
  if (isControlSignal) {
    color = "bg-blue-500";
    hoverColor = "bg-blue-400";
    borderColor = "border-blue-600";
    tooltipColor = "text-blue-300";
  } else if (isInput) {
    color = "bg-green-500";
    hoverColor = "bg-green-400";
    borderColor = "border-green-600";
    tooltipColor = "text-green-300";
  } else {
    color = "bg-orange-500";
    hoverColor = "bg-orange-400";
    borderColor = "border-orange-600";
    tooltipColor = "text-orange-300";
  }

  // Drop target styling during wire creation
  const dropTargetClass = isHoveredTarget
    ? "ring-2 ring-cyan-400 ring-offset-1 ring-offset-gray-900 scale-150"
    : isDropTarget
      ? "animate-pulse ring-1 ring-cyan-400/50 scale-125"
      : "";

  return (
    <div
      style={positionStyles}
      className={`pointer-events-auto ${hover ? "z-[100]" : "z-20"}`}
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
        className={`
          w-3 h-3 rounded-full border-2 cursor-pointer transition-all
          ${hover ? `${hoverColor} scale-125` : color}
          ${borderColor}
          ${dropTargetClass}
          hover:shadow-lg
        `}
      >
        {hover && !isCreating && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-[9px] font-mono text-white whitespace-nowrap pointer-events-none shadow-lg"
            style={{ 
              top: "100%",
              zIndex: 1000,
            }}
          >
            <div className="font-semibold text-gray-300">{portName}</div>
            <div className={tooltipColor}>{portValue}</div>
          </div>
        )}
      </div>
    </div>
  );
}
