"use client";

import { useLayoutStore, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useState, useEffect, useCallback, useMemo } from "react";
import { calculateOrthogonalPath, pointsToSVGPath, getPointOnOrthogonalPath } from "@/lib/wireRouting";
import { getWidgetDefinition } from "@/lib/widgetDefinitions";
import { findPortPosition } from "@/lib/portPositioning";

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
  
  // Wire creation state
  const isCreating = useWireCreationStore((s) => s.isCreating);
  const sourceComponentId = useWireCreationStore((s) => s.sourceComponentId);
  const sourcePortName = useWireCreationStore((s) => s.sourcePortName);
  const mousePosition = useWireCreationStore((s) => s.mousePosition);
  const cancelWireCreation = useWireCreationStore((s) => s.cancelWireCreation);
  
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

      // Get simulator objects
      const sourceObj = objects.get(wire.sourceComponentId);
      const targetObj = objects.get(wire.targetComponentId);
      if (!sourceObj || !targetObj) {
        return null;
      }
      if (!("getPorts" in sourceObj) || !("getPorts" in targetObj)) {
        return null;
      }

      // Get the value from the source port
      let value = "?";
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

      // Get port lists
      const sourcePorts = Object.entries((sourceObj as { getPorts: () => Record<string, { direction: string }> }).getPorts()).map(([name, port]) => ({
        name,
        direction: port.direction as "input" | "output"
      }));
      const targetPorts = Object.entries((targetObj as { getPorts: () => Record<string, { direction: string }> }).getPorts()).map(([name, port]) => ({
        name,
        direction: port.direction as "input" | "output"
      }));

      // Get port configs
      const sourceWidgetDef = getWidgetDefinition(sourceComp.type);
      const targetWidgetDef = getWidgetDefinition(targetComp.type);

      // Calculate positions using findPortPosition
      const sourcePos = findPortPosition(
        sourceComp,
        wire.sourcePortName,
        "output",
        sourcePorts,
        sourceWidgetDef?.portConfig
      );
      const targetPos = findPortPosition(
        targetComp,
        wire.targetPortName,
        "input",
        targetPorts,
        targetWidgetDef?.portConfig
      );

      if (!sourcePos || !targetPos) {
        return null;
      }

      const { x: sourceX, y: sourceY } = sourcePos;
      const { x: targetX, y: targetY } = targetPos;

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

  // Calculate temporary wire preview
  let tempWirePreview: { x: number; y: number }[] | null = null;
  if (isCreating && sourceComponentId && sourcePortName && mousePosition) {
    const sourceComp = components.find((c) => c.id === sourceComponentId);
    if (sourceComp) {
      const sourceObj = objects.get(sourceComponentId);
      if (sourceObj && "getPorts" in sourceObj) {
        const sourcePorts = Object.entries((sourceObj as { getPorts: () => Record<string, { direction: string }> }).getPorts()).map(([name, port]) => ({
          name,
          direction: port.direction as "input" | "output"
        }));
        const sourceWidgetDef = getWidgetDefinition(sourceComp.type);
        const sourcePos = findPortPosition(
          sourceComp,
          sourcePortName,
          "output",
          sourcePorts,
          sourceWidgetDef?.portConfig
        );
        if (sourcePos) {
          tempWirePreview = calculateOrthogonalPath(
            sourcePos,
            mousePosition
          );
        }
      }
    }
  }

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
        const points = calculateOrthogonalPath(
          { x: wp.sourceX, y: wp.sourceY },
          { x: wp.targetX, y: wp.targetY }
        );
        const path = pointsToSVGPath(points);

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
                const point = getPointOnOrthogonalPath(points, animation.progress);
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
                const midPoint = getPointOnOrthogonalPath(points, 0.5);
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

      {/* Temporary wire preview during creation */}
      {tempWirePreview && (
        <path
          d={pointsToSVGPath(tempWirePreview)}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5,5"
          opacity="0.6"
        />
      )}

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
