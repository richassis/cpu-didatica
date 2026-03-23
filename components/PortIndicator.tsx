"use client";

import { useState, useEffect } from "react";
import { useSimulatorStore } from "@/lib/simulatorStore";

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
  const color = isInput ? "bg-green-500" : "bg-orange-500";
  const hoverColor = isInput ? "bg-green-400" : "bg-orange-400";
  const borderColor = isInput ? "border-green-600" : "border-orange-600";

  return (
    <div
      style={positionStyles}
      className="pointer-events-auto z-20"
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
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-[9px] font-mono text-white whitespace-nowrap pointer-events-none z-50">
            <div className="font-semibold text-gray-300">{portName}</div>
            <div className={isInput ? "text-green-300" : "text-orange-300"}>{portValue}</div>
          </div>
        )}
      </div>
    </div>
  );
}
