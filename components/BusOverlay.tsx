"use client";

import { useLayoutStore, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import { useState, useEffect, useCallback, useMemo } from "react";

interface WireAnimation {
  wireId: string;
  progress: number;
  value: string;
}

interface WirePosition {
  wireId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourceLabel: string;
  targetLabel: string;
  value: string;
}

export default function BusOverlay({ visible }: { visible: boolean }) {
  const components = useLayoutStore((s) => s.components);
  const zoom = useLayoutStore((s) => s.zoom);
  const getWires = useSimulatorStore((s) => s.getWires);
  const objects = useSimulatorStore((s) => s.objects);
  const revision = useSimulatorStore((s) => s.revision);
  const base = useDisplayStore((s) => s.numericBase);
  
  // Get wires - re-runs when revision changes
  const wires = useMemo(() => getWires(), [getWires, revision]);

  const [animations, setAnimations] = useState<WireAnimation[]>([]);
  const [prevRevision, setPrevRevision] = useState(revision);

  // Calculate wire positions based on component positions
  const wirePositions = useMemo((): WirePosition[] => {
    return wires.map((wire) => {
      const sourceComp = components.find((c) => c.id === wire.sourceComponentId);
      const targetComp = components.find((c) => c.id === wire.targetComponentId);

      if (!sourceComp || !targetComp) {
        return null;
      }

      // Get the value from the source port
      const sourceObj = objects.get(wire.sourceComponentId);
      let value = "?";
      if (sourceObj && "getPorts" in sourceObj) {
        const ports = (sourceObj as { getPorts: () => Record<string, { value: unknown; bitWidth: number | null }> }).getPorts();
        const port = ports[wire.sourcePortName];
        if (port) {
          const raw = port.value;
          if (typeof raw === "number") {
            value = formatNum(raw, base, port.bitWidth ?? 16);
          } else {
            value = String(raw);
          }
        }
      }

      // Calculate positions (center of components, offset for ports)
      const sourceX = sourceComp.x + sourceComp.w;
      const sourceY = sourceComp.y + sourceComp.h / 2;
      const targetX = targetComp.x;
      const targetY = targetComp.y + targetComp.h / 2;

      return {
        wireId: wire.id,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourceLabel: `${sourceComp.label}.${wire.sourcePortName}`,
        targetLabel: `${targetComp.label}.${wire.targetPortName}`,
        value,
      };
    }).filter((w): w is WirePosition => w !== null);
  }, [wires, components, objects, revision, base]);

  // Trigger animation on revision change (clock tick)
  useEffect(() => {
    if (revision !== prevRevision && visible) {
      setPrevRevision(revision);
      
      // Start animations for all wires
      const newAnimations = wirePositions.map((wp) => ({
        wireId: wp.wireId,
        progress: 0,
        value: wp.value,
      }));
      setAnimations(newAnimations);
    }
  }, [revision, prevRevision, visible, wirePositions]);

  // Animate progress
  useEffect(() => {
    if (animations.length === 0) return;

    const interval = setInterval(() => {
      setAnimations((prev) => {
        const updated = prev.map((a) => ({
          ...a,
          progress: Math.min(1, a.progress + 0.008),
        }));
        
        // Remove completed animations
        if (updated.every((a) => a.progress >= 1)) {
          return [];
        }
        return updated;
      });
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [animations.length]);

  if (!visible) return null;

  // Calculate bezier curve path
  const getPath = (source: { x: number; y: number }, target: { x: number; y: number }) => {
    const midX = (source.x + target.x) / 2;
    const dx = Math.abs(target.x - source.x);
    const controlOffset = Math.min(dx * 0.5, 100);
    
    return `M ${source.x} ${source.y} 
            C ${source.x + controlOffset} ${source.y}, 
              ${target.x - controlOffset} ${target.y}, 
              ${target.x} ${target.y}`;
  };

  // Get point along bezier curve at t (0-1)
  const getPointOnCurve = (
    source: { x: number; y: number },
    target: { x: number; y: number },
    t: number
  ) => {
    const dx = Math.abs(target.x - source.x);
    const controlOffset = Math.min(dx * 0.5, 100);
    
    const p0 = source;
    const p1 = { x: source.x + controlOffset, y: source.y };
    const p2 = { x: target.x - controlOffset, y: target.y };
    const p3 = target;

    // Cubic bezier formula
    const cx = 3 * (p1.x - p0.x);
    const bx = 3 * (p2.x - p1.x) - cx;
    const ax = p3.x - p0.x - cx - bx;
    
    const cy = 3 * (p1.y - p0.y);
    const by = 3 * (p2.y - p1.y) - cy;
    const ay = p3.y - p0.y - cy - by;

    const x = ax * t * t * t + bx * t * t + cx * t + p0.x;
    const y = ay * t * t * t + by * t * t + cy * t + p0.y;

    return { x, y };
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      }}
    >
      <defs>
        {/* Gradient for wires */}
        <linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
        </linearGradient>
        
        {/* Glow filter */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Arrow marker */}
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#22d3ee" />
        </marker>
      </defs>

      {/* Render wires */}
      {wirePositions.map((wp) => {
        const animation = animations.find((a) => a.wireId === wp.wireId);
        const path = getPath(
          { x: wp.sourceX, y: wp.sourceY },
          { x: wp.targetX, y: wp.targetY }
        );

        return (
          <g key={wp.wireId}>
            {/* Wire path */}
            <path
              d={path}
              fill="none"
              stroke="url(#wireGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              markerEnd="url(#arrowhead)"
              filter="url(#glow)"
              opacity="0.7"
            />

            {/* Animated data packet */}
            {animation && animation.progress < 1 && (
              (() => {
                const point = getPointOnCurve(
                  { x: wp.sourceX, y: wp.sourceY },
                  { x: wp.targetX, y: wp.targetY },
                  animation.progress
                );
                return (
                  <g transform={`translate(${point.x}, ${point.y})`}>
                    {/* Glowing circle */}
                    <circle
                      r="8"
                      fill="#22d3ee"
                      filter="url(#glow)"
                      opacity={1 - animation.progress * 0.5}
                    />
                    {/* Value text */}
                    <text
                      y="-12"
                      textAnchor="middle"
                      className="text-xs font-mono fill-cyan-300"
                      style={{ fontSize: "10px" }}
                    >
                      {animation.value}
                    </text>
                  </g>
                );
              })()
            )}

            {/* Source label */}
            <text
              x={wp.sourceX + 5}
              y={wp.sourceY - 8}
              className="text-xs fill-gray-400"
              style={{ fontSize: "9px" }}
            >
              {wp.sourceLabel}
            </text>

            {/* Target label */}
            <text
              x={wp.targetX - 5}
              y={wp.targetY - 8}
              textAnchor="end"
              className="text-xs fill-gray-400"
              style={{ fontSize: "9px" }}
            >
              {wp.targetLabel}
            </text>

            {/* Value badge at midpoint */}
            {!animation && (
              (() => {
                const midPoint = getPointOnCurve(
                  { x: wp.sourceX, y: wp.sourceY },
                  { x: wp.targetX, y: wp.targetY },
                  0.5
                );
                return (
                  <g transform={`translate(${midPoint.x}, ${midPoint.y})`}>
                    <rect
                      x="-16"
                      y="-10"
                      width="32"
                      height="16"
                      rx="4"
                      fill="#1f2937"
                      stroke="#374151"
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs font-mono fill-cyan-300"
                      style={{ fontSize: "10px" }}
                    >
                      {wp.value}
                    </text>
                  </g>
                );
              })()
            )}
          </g>
        );
      })}

      {/* Show "No connections" if empty */}
      {wirePositions.length === 0 && (
        <text
          x="50%"
          y="50"
          textAnchor="middle"
          className="fill-gray-500"
          style={{ fontSize: "14px" }}
        >
          No wire connections
        </text>
      )}
    </svg>
  );
}
