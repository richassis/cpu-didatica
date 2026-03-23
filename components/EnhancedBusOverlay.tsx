"use client";

import { useLayoutStore, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useEnhancedWireStore, type EnhancedWire, type WireNode } from "@/lib/enhancedWireStore";
import { findPortPosition } from "@/lib/portPositioning";
import { useState, useEffect, useMemo } from "react";
import { calculateOrthogonalPath, pointsToSVGPath, getPointOnOrthogonalPath } from "@/lib/wireRouting";

interface WireRenderData {
  wire: EnhancedWire;
  sourcePos: Array<{ x: number; y: number }>;
  targetPositions: Array<{ x: number; y: number; label: string }>;
  value: string;
}

export default function EnhancedBusOverlay({ visible }: { visible: boolean }) {
  const components = useLayoutStore((s) => s.components);
  const zoom = useLayoutStore((s) => s.zoom);
  const objects = useSimulatorStore((s) => s.objects);
  const revision = useSimulatorStore((s) => s.revision);
  const base = useDisplayStore((s) => s.numericBase);
  
  // Enhanced wire state
  const wires = useEnhancedWireStore((s) => s.wires);
  const selectedWireId = useEnhancedWireStore((s) => s.selectedWireId);
  const selectedNodeId = useEnhancedWireStore((s) => s.selectedNodeId);
  const selectWire = useEnhancedWireStore((s) => s.selectWire);
  const selectNode = useEnhancedWireStore((s) => s.selectNode);
  const updateWireNode = useEnhancedWireStore((s) => s.updateWireNode);
  const addWireNode = useEnhancedWireStore((s) => s.addWireNode);
  const addWireTargetFromNode = useEnhancedWireStore((s) => s.addWireTargetFromNode);
  const getNodePosition = useEnhancedWireStore((s) => s.getNodePosition);
  
  // Wire creation state
  const isCreating = useWireCreationStore((s) => s.isCreating);
  const sourceComponentId = useWireCreationStore((s) => s.sourceComponentId);
  const sourcePortName = useWireCreationStore((s) => s.sourcePortName);
  const sourceWireId = useWireCreationStore((s) => s.sourceWireId);
  const sourceNodeId = useWireCreationStore((s) => s.sourceNodeId);
  const mousePosition = useWireCreationStore((s) => s.mousePosition);
  const startWireCreationFromNode = useWireCreationStore((s) => s.startWireCreationFromNode);
  
  const [dragState, setDragState] = useState<{ wireId: string; nodeId: string } | null>(null);

  // Calculate wire render data
  const wireRenderData = useMemo((): WireRenderData[] => {
    const results: WireRenderData[] = [];
    
    for (const wire of wires) {
      const sourceComp = components.find((c) => c.id === wire.source.componentId);
      if (!sourceComp) continue;

      // Get all ports for the source component
      const sourceObj = objects.get(wire.source.componentId);
      if (!sourceObj || !("getPorts" in sourceObj)) continue;
      
      const sourcePortMap = (sourceObj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
      const sourcePorts = Object.entries(sourcePortMap).map(([name, p]) => ({
        name,
        direction: p.direction as "input" | "output",
      }));

      // Calculate exact source port position
      const sourcePortPos = findPortPosition(
        sourceComp,
        wire.source.portName,
        "output",
        sourcePorts
      );

      // Build path with nodes
      const pathPoints = [sourcePortPos];
      wire.nodes.forEach((node) => pathPoints.push({ x: node.x, y: node.y }));

      // Get target positions with exact port locations
      const targetPositions = wire.targets
        .map((target) => {
          const targetComp = components.find((c) => c.id === target.componentId);
          if (!targetComp) return null;
          
          const targetObj = objects.get(target.componentId);
          if (!targetObj || !("getPorts" in targetObj)) return null;
          
          const targetPortMap = (targetObj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
          const targetPorts = Object.entries(targetPortMap).map(([name, p]) => ({
            name,
            direction: p.direction as "input" | "output",
          }));
          
          // Calculate exact target port position
          const targetPortPos = findPortPosition(
            targetComp,
            target.portName,
            "input",
            targetPorts
          );
          
          return {
            x: targetPortPos.x,
            y: targetPortPos.y,
            label: `${targetComp.label}.${target.portName}`,
          };
        })
        .filter((t): t is { x: number; y: number; label: string } => t !== null);

      // Get value from source port
      let value = "?";
      if (sourceObj && "getPorts" in sourceObj) {
        const ports = (sourceObj as { getPorts: () => Record<string, { value: unknown; bitWidth: number | null }> }).getPorts();
        const port = ports[wire.source.portName];
        if (port) {
          const raw = port.value;
          if (typeof raw === "number") {
            value = formatNum(raw, base, port.bitWidth ?? 16);
          } else {
            value = String(raw);
          }
        }
      }

      results.push({
        wire,
        sourcePos: pathPoints,
        targetPositions,
        value,
      });
    }
    
    return results;
  }, [wires, components, objects, revision, base]);

  // Handle node dragging
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.querySelector('[data-canvas]') as HTMLElement;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const scrollLeft = canvas.scrollLeft || 0;
      const scrollTop = canvas.scrollTop || 0;
      
      const canvasX = (e.clientX - rect.left + scrollLeft) / zoom;
      const canvasY = (e.clientY - rect.top + scrollTop) / zoom;
      
      updateWireNode(dragState.wireId, dragState.nodeId, canvasX, canvasY);
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, zoom, updateWireNode]);

  // Handle wire/node deselection
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        selectWire(null);
        selectNode(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Deselect if clicking on canvas background or SVG background
      if (target.tagName === "svg" || target.closest('[data-canvas]') === target) {
        selectWire(null);
        selectNode(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    window.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [selectWire, selectNode]);

  if (!visible) return null;

  // Calculate temporary wire preview
  let tempWirePreview: { x: number; y: number }[] | null = null;
  if (isCreating && mousePosition) {
    let startPos: { x: number; y: number } | null = null;
    
    if (sourceComponentId && sourcePortName) {
      // Starting from a port
      const sourceComp = components.find((c) => c.id === sourceComponentId);
      if (sourceComp) {
        const sourceObj = objects.get(sourceComponentId);
        if (sourceObj && "getPorts" in sourceObj) {
          const sourcePortMap = (sourceObj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
          const sourcePorts = Object.entries(sourcePortMap).map(([name, p]) => ({
            name,
            direction: p.direction as "input" | "output",
          }));
          
          startPos = findPortPosition(
            sourceComp,
            sourcePortName,
            "output",
            sourcePorts
          );
        }
      }
    } else if (sourceWireId && sourceNodeId) {
      // Starting from a node
      startPos = getNodePosition(sourceWireId, sourceNodeId);
    }
    
    if (startPos) {
      tempWirePreview = calculateOrthogonalPath(startPos, mousePosition);
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
        <linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
        </linearGradient>
        
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Arrow marker - smaller size matching port indicators */}
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="#22d3ee" />
        </marker>
      </defs>

      {/* Render wires */}
      {wireRenderData.map(({ wire, sourcePos, targetPositions, value }) => {
        const isSelected = wire.id === selectedWireId;
        
        return (
          <g key={wire.id}>
            {/* Render paths to each target */}
            {targetPositions.map((target, idx) => {
              const pathPoints = [...sourcePos, target];
              const segments: { x: number; y: number }[] = [];
              
              // Create orthogonal segments between each consecutive pair of points
              for (let i = 0; i < pathPoints.length - 1; i++) {
                const segment = calculateOrthogonalPath(pathPoints[i], pathPoints[i + 1]);
                segments.push(...segment.slice(i === 0 ? 0 : 1)); // Skip duplicate points
              }
              
              const path = pointsToSVGPath(segments);

              return (
                <g key={`${wire.id}-target-${idx}`}>
                  {/* Wire path */}
                  <path
                    d={path}
                    fill="none"
                    stroke={isSelected ? "#fbbf24" : "url(#wireGradient)"}
                    strokeWidth={isSelected ? 4 : 3}
                    strokeLinecap="round"
                    markerEnd="url(#arrowhead)"
                    filter="url(#glow)"
                    opacity="0.7"
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectWire(wire.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      // Add node at click position
                      const svg = e.currentTarget.ownerSVGElement;
                      if (svg) {
                        const pt = svg.createSVGPoint();
                        pt.x = e.clientX;
                        pt.y = e.clientY;
                        const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                        addWireNode(wire.id, svgPt.x, svgPt.y);
                      }
                    }}
                  />

                  {/* Target label */}
                  <text
                    x={target.x - 5}
                    y={target.y - 8}
                    textAnchor="end"
                    className="text-xs fill-gray-400"
                    style={{ fontSize: "9px" }}
                  >
                    {target.label}
                  </text>
                </g>
              );
            })}

            {/* Render wire nodes */}
            {wire.nodes.map((node) => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={selectedNodeId === node.id ? 6 : 4}
                fill={selectedNodeId === node.id ? "#fbbf24" : "#22d3ee"}
                stroke="#fff"
                strokeWidth="2"
                className="pointer-events-auto cursor-move"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragState({ wireId: wire.id, nodeId: node.id });
                  selectNode(node.id);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectNode(node.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  // Start wire creation from this node for bifurcation
                  startWireCreationFromNode(wire.id, node.id);
                }}
              />
            ))}

            {/* Value badge */}
            {sourcePos.length > 0 && (
              <g transform={`translate(${sourcePos[0].x + 20}, ${sourcePos[0].y})`}>
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
                  {value}
                </text>
              </g>
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
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="5,5"
          opacity="0.6"
        />
      )}

      {/* Show "No connections" if empty */}
      {wireRenderData.length === 0 && !isCreating && (
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
