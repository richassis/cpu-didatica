"use client";

import { useState } from "react";

interface Props {
  portName: string;
  direction: "input" | "output";
  componentId: string;
  onPortClick?: (componentId: string, portName: string, direction: "input" | "output") => void;
  position: "left" | "right" | "top" | "bottom";
  offset?: number;
}

export default function PortIndicator({ 
  portName, 
  direction, 
  componentId, 
  onPortClick,
  position,
  offset = 50,
}: Props) {
  const [hover, setHover] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPortClick?.(componentId, portName, direction);
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
      onClick={handleClick}
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
        title={`${direction}: ${portName}`}
      >
        {hover && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-gray-900 border border-gray-700 rounded text-[9px] font-mono text-white whitespace-nowrap pointer-events-none">
            {portName}
          </div>
        )}
      </div>
    </div>
  );
}
