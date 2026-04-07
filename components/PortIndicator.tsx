"use client";

import { useState, useEffect } from "react";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useLayoutStore } from "@/lib/store";

interface Props {
  portName: string;
  direction: "input" | "output";
  componentId: string;
  onPortPointerDown?: (
    componentId: string,
    portName: string,
    direction: "input" | "output",
    event: React.PointerEvent,
  ) => void;
  position: "left" | "right" | "top" | "bottom";
  offset?: number;
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
  onPortPointerDown,
  position,
  offset = 50,
}: Props) {
  const [hover, setHover] = useState(false);
  const [portValue, setPortValue] = useState<string>("");
  const objects = useSimulatorStore((s) => s.objects);
  const revision = useSimulatorStore((s) => s.revision);
  const components = useLayoutStore((s) => s.components);

  // Get component type for control signal detection
  const component = components.find(c => c.id === componentId);
  const componentType = component?.type ?? "";
  const isControlSignal = isControlSignalPort(componentType, portName, direction);

  useEffect(() => {
    const obj = objects.get(componentId);
    if (obj && "getPorts" in obj) {
      const portMap = (obj as { getPorts: () => Record<string, { value: unknown }> }).getPorts();
      const port = portMap[portName];
      if (port) {
        const val = port.value;
        if (typeof val === "number") {
          setPortValue(`0x${val.toString(16).toUpperCase().padStart(4, "0")}`);
        } else if (typeof val === "boolean") {
          setPortValue(val ? "1" : "0");
        } else {
          setPortValue(String(val));
        }
      }
    }
  }, [componentId, portName, objects, revision]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onPortPointerDown?.(componentId, portName, direction, e);
  };

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
  let color, hoverColor, borderColor, tooltipColor;
  if (isControlSignal) {
    // Blue for control signals
    color = "bg-blue-500";
    hoverColor = "bg-blue-400";
    borderColor = "border-blue-600";
    tooltipColor = "text-blue-300";
  } else if (isInput) {
    // Green for data inputs
    color = "bg-green-500";
    hoverColor = "bg-green-400";
    borderColor = "border-green-600";
    tooltipColor = "text-green-300";
  } else {
    // Orange for data outputs
    color = "bg-orange-500";
    hoverColor = "bg-orange-400";
    borderColor = "border-orange-600";
    tooltipColor = "text-orange-300";
  }

  return (
    <div
      style={positionStyles}
      className={`pointer-events-auto ${hover ? "z-[100]" : "z-20"}`}
      data-port-indicator
      data-port-component-id={componentId}
      data-port-name={portName}
      data-port-direction={direction}
      onPointerDown={handlePointerDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={`
          w-3 h-3 rounded-full border-2 cursor-pointer transition-all
          ${hover ? `${hoverColor} scale-125` : color}
          ${borderColor}
          hover:shadow-lg
        `}
      >
        {hover && (
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
