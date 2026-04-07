"use client";

import { useLayoutStore, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useEnhancedWireStore, type EnhancedWire, type WireEndpoint } from "@/lib/enhancedWireStore";
import { findPortPosition } from "@/lib/portPositioning";
import { getWidgetDefinition } from "@/lib/widgetDefinitions";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { pointsToSVGPath, snapToGrid } from "@/lib/wireRouting";
import { CPU } from "@/lib/simulator";

const GRID_SIZE = 16;
/** Invisible stroke width for easier hit detection */
const HIT_AREA_WIDTH = 16;
/** Duration of the data pulse animation in ms */
const PULSE_ANIMATION_DURATION = 2500;

interface WireRenderData {
  wire: EnhancedWire;
  path: Array<{ x: number; y: number }>;
  startPos: { x: number; y: number };
  hasAttachedEnd: boolean;
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
  const removeEnhancedWire = useEnhancedWireStore((s) => s.removeWire);
  
  // Simulator wire removal
  const removeSimulatorWire = useSimulatorStore((s) => s.removeWire);
  const bus = useSimulatorStore((s) => s.bus);
  
  // Wire creation state
  const isCreating = useWireCreationStore((s) => s.isCreating);
  const pathPoints = useWireCreationStore((s) => s.pathPoints);
  
  const [dragState, setDragState] = useState<{ wireId: string; nodeId: string } | null>(null);
  
  // Track wire values for animation
  const prevWireValues = useRef<Map<string, string>>(new Map());
  const [animatingWires, setAnimatingWires] = useState<Set<string>>(new Set());

  // Calculate wire render data
  const wireRenderData = useMemo((): WireRenderData[] => {
    const resolveEndpointPosition = (endpoint: WireEndpoint): { x: number; y: number } | null => {
      const endpointComp = components.find((component) => component.id === endpoint.componentId);
      const endpointObj = objects.get(endpoint.componentId);
      if (!endpointComp || !endpointObj || !("getPorts" in endpointObj)) return null;

      const endpointPortMap = (endpointObj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
      const endpointPorts = Object.entries(endpointPortMap).map(([name, port]) => ({
        name,
        direction: port.direction as "input" | "output",
      }));

      // Get widget definition and port config
      const widgetDef = getWidgetDefinition(endpointComp.type);
      const portConfig = widgetDef?.portConfig;

      return findPortPosition(endpointComp, endpoint.portName, endpoint.direction, endpointPorts, portConfig);
    };

    const resolveWireValue = (wire: EnhancedWire): string => {
      const outputEndpoint = wire.start.direction === "output" ? wire.start : wire.end?.direction === "output" ? wire.end : null;
      if (!outputEndpoint) return "?";

      const outputObj = objects.get(outputEndpoint.componentId);
      if (!outputObj || !("getPorts" in outputObj)) return "?";

      const ports = (outputObj as { getPorts: () => Record<string, { value: unknown; bitWidth: number | null }> }).getPorts();
      const port = ports[outputEndpoint.portName];
      if (!port) return "?";

      const raw = port.value;
      if (typeof raw === "number") {
        return formatNum(raw, base, port.bitWidth ?? 16);
      }
      return String(raw);
    };

    /**
     * Expand path to include orthogonal segments between consecutive points.
     * For each pair of points, if they're not aligned, add a corner point.
     */
    const expandOrthogonalPath = (points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> => {
      if (points.length < 2) return points;

      const expanded: Array<{ x: number; y: number }> = [points[0]];
      for (let index = 0; index < points.length - 1; index++) {
        const current = points[index];
        const next = points[index + 1];
        
        // If not aligned, add a corner
        if (current.x !== next.x && current.y !== next.y) {
          // Prefer horizontal-then-vertical routing
          expanded.push({ x: next.x, y: current.y });
        }
        expanded.push(next);
      }
      return expanded;
    };

    const results: WireRenderData[] = [];

    for (const wire of wires) {
      const isAttached = Boolean(wire.end);

      const outputEndpoint = wire.start.direction === "output"
        ? wire.start
        : wire.end?.direction === "output"
          ? wire.end
          : null;

      const inputEndpoint = wire.start.direction === "input"
        ? wire.start
        : wire.end?.direction === "input"
          ? wire.end
          : null;

      const shouldRenderOutputToInput = isAttached && Boolean(outputEndpoint && inputEndpoint);

      const startEndpoint = shouldRenderOutputToInput ? outputEndpoint! : wire.start;
      const endEndpoint = shouldRenderOutputToInput ? inputEndpoint! : wire.end;

      const startPos = resolveEndpointPosition(startEndpoint);
      if (!startPos) continue;

      const endPos = endEndpoint ? resolveEndpointPosition(endEndpoint) : wire.floatingEnd;
      if (!endPos) continue;

      const orderedNodes = shouldRenderOutputToInput && wire.start.direction === "input"
        ? [...wire.nodes].reverse()
        : wire.nodes;

      const basePath = [
        startPos,
        ...orderedNodes.map((node) => ({ x: node.x, y: node.y })),
        endPos,
      ];

      const expandedPath = expandOrthogonalPath(basePath);

      results.push({
        wire,
        path: expandedPath,
        startPos,
        hasAttachedEnd: Boolean(wire.end),
        value: resolveWireValue(wire),
      });
    }

    return results;
  }, [wires, components, objects, base]);

  // Track animation progress for flowing effect
  const [animationProgress, setAnimationProgress] = useState<Map<string, number>>(new Map());
  
  // Detect value changes and trigger animations
  useEffect(() => {
    const newAnimating = new Set<string>();
    
    for (const { wire, value } of wireRenderData) {
      const prevValue = prevWireValues.current.get(wire.id);
      
      // Determine if this wire is a CPU control signal
      const outputEndpoint = wire.start.direction === "output" ? wire.start : wire.end?.direction === "output" ? wire.end : null;
      const sourceComponent = outputEndpoint ? components.find(c => c.id === outputEndpoint.componentId) : null;
      const isCpuControlSignal = sourceComponent?.type === "CpuComponent" && outputEndpoint?.direction === "output";
      
      // Trigger animation on:
      // 1. CPU control signals - ALWAYS animate on every tick/state change (new behavior)
      // 2. Other component outputs - only animate when values change (original behavior)
      if (isCpuControlSignal) {
        // CPU control signals always animate regardless of value changes
        newAnimating.add(wire.id);
      } else if (prevValue !== undefined && prevValue !== value) {
        // Other components only animate on value changes
        newAnimating.add(wire.id);
      }
      
      prevWireValues.current.set(wire.id, value);
    }
    
    if (newAnimating.size > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnimatingWires((prev) => new Set([...prev, ...newAnimating]));
      
      // Animate progress from 0 to 1
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / PULSE_ANIMATION_DURATION, 1);
        
        setAnimationProgress((prev) => {
          const updated = new Map(prev);
          for (const id of newAnimating) {
            updated.set(id, progress);
          }
          return updated;
        });
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Clear animations after completion
          setAnimatingWires((prev) => {
            const updated = new Set(prev);
            for (const id of newAnimating) {
              updated.delete(id);
            }
            return updated;
          });
          setAnimationProgress((prev) => {
            const updated = new Map(prev);
            for (const id of newAnimating) {
              updated.delete(id);
            }
            return updated;
          });
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [wireRenderData, revision, components]); // Added revision and components to dependencies

  // Calculate a point along a path at a given progress (0-1)
  const getPointAlongPath = useCallback((path: Array<{ x: number; y: number }>, progress: number) => {
    if (path.length < 2) return path[0] || { x: 0, y: 0 };
    
    // Calculate total path length
    let totalLength = 0;
    const segments: { start: { x: number; y: number }; end: { x: number; y: number }; length: number }[] = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i + 1].x - path[i].x;
      const dy = path[i + 1].y - path[i].y;
      const length = Math.sqrt(dx * dx + dy * dy);
      segments.push({ start: path[i], end: path[i + 1], length });
      totalLength += length;
    }
    
    // Find point at progress
    const targetLength = totalLength * progress;
    let accLength = 0;
    
    for (const seg of segments) {
      if (accLength + seg.length >= targetLength) {
        const segProgress = (targetLength - accLength) / seg.length;
        return {
          x: seg.start.x + (seg.end.x - seg.start.x) * segProgress,
          y: seg.start.y + (seg.end.y - seg.start.y) * segProgress,
        };
      }
      accLength += seg.length;
    }
    
    return path[path.length - 1];
  }, []);

  // Delete selected wire handler
  const handleDeleteSelectedWire = useCallback(() => {
    if (!selectedWireId) return;
    
    // Find the enhanced wire to get its connection info
    const enhancedWire = wires.find(w => w.id === selectedWireId);
    if (enhancedWire && enhancedWire.end) {
      // Find corresponding simulator wire by matching endpoints
      const simWires = bus.wires;
      const matchingWire = simWires.find(w => {
        const srcMatch = (w.sourceComponentId === enhancedWire.start.componentId && 
                         w.sourcePortName === enhancedWire.start.portName) ||
                        (enhancedWire.end && w.sourceComponentId === enhancedWire.end.componentId && 
                         w.sourcePortName === enhancedWire.end.portName);
        const tgtMatch = (enhancedWire.end && w.targetComponentId === enhancedWire.end.componentId && 
                         w.targetPortName === enhancedWire.end.portName) ||
                        (w.targetComponentId === enhancedWire.start.componentId && 
                         w.targetPortName === enhancedWire.start.portName);
        return srcMatch && tgtMatch;
      });
      
      if (matchingWire) {
        removeSimulatorWire(matchingWire.id);
      }
    }
    
    // Remove from enhanced wire store
    removeEnhancedWire(selectedWireId);
    selectWire(null);
  }, [selectedWireId, wires, bus, removeSimulatorWire, removeEnhancedWire, selectWire]);

  // Handle node dragging
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.querySelector('[data-canvas]') as HTMLElement;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const scrollLeft = canvas.scrollLeft || 0;
      const scrollTop = canvas.scrollTop || 0;

      const canvasX = snapToGrid((e.clientX - rect.left + scrollLeft) / zoom, GRID_SIZE);
      const canvasY = snapToGrid((e.clientY - rect.top + scrollTop) / zoom, GRID_SIZE);

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

  // Handle wire/node deselection and deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        selectWire(null);
        selectNode(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedWireId) {
        e.preventDefault();
        handleDeleteSelectedWire();
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [selectWire, selectNode, selectedWireId, handleDeleteSelectedWire]);

  if (!visible) return null;

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
        
        {/* Animated gradient for data pulse */}
        <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="1">
            <animate
              attributeName="stop-color"
              values="#22d3ee;#fbbf24;#22d3ee"
              dur="0.6s"
              repeatCount="1"
            />
          </stop>
          <stop offset="100%" stopColor="#a855f7" stopOpacity="1">
            <animate
              attributeName="stop-color"
              values="#a855f7;#f97316;#a855f7"
              dur="0.6s"
              repeatCount="1"
            />
          </stop>
        </linearGradient>
        
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        {/* Stronger glow for animated wires */}
        <filter id="pulseGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

      </defs>

      {/* Render wires */}
      {wireRenderData.map(({ wire, path, startPos, hasAttachedEnd, value }) => {
        const isSelected = wire.id === selectedWireId;
        const isAnimating = animatingWires.has(wire.id);
        const pathD = pointsToSVGPath(path);

        return (
          <g key={wire.id}>
            {/* Invisible wider path for easier selection */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={HIT_AREA_WIDTH}
              strokeLinecap="round"
              className="pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                selectWire(wire.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const svg = e.currentTarget.ownerSVGElement;
                if (svg) {
                  const point = svg.createSVGPoint();
                  point.x = e.clientX;
                  point.y = e.clientY;
                  const svgPoint = point.matrixTransform(svg.getScreenCTM()?.inverse());
                  addWireNode(wire.id, svgPoint.x, svgPoint.y);
                }
              }}
            />
            {/* Animated flowing dot when data changes */}
            {isAnimating && (
              <>
                {/* Glow path effect */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={6}
                  strokeLinecap="round"
                  filter="url(#pulseGlow)"
                  opacity={0.5}
                  className="pointer-events-none"
                />
                {/* Flowing data indicator */}
                {(() => {
                  const progress = animationProgress.get(wire.id) ?? 0;
                  const point = getPointAlongPath(path, progress);
                  return (
                    <g transform={`translate(${point.x}, ${point.y})`}>
                      {/* Glowing circle */}
                      <circle
                        r="8"
                        fill="#fbbf24"
                        filter="url(#pulseGlow)"
                        opacity="0.9"
                      />
                      {/* Value badge */}
                      <g transform="translate(0, -18)">
                        <rect
                          x="-20"
                          y="-8"
                          width="40"
                          height="16"
                          rx="4"
                          fill="#1f2937"
                          stroke="#fbbf24"
                          strokeWidth="1.5"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="font-mono fill-amber-300"
                          style={{ fontSize: "9px", fontWeight: "bold" }}
                        >
                          {value}
                        </text>
                      </g>
                    </g>
                  );
                })()}
              </>
            )}
            {/* Visible wire path */}
            <path
              d={pathD}
              fill="none"
              stroke={isSelected ? "#fbbf24" : isAnimating ? "#fbbf24" : "url(#wireGradient)"}
              strokeWidth={isSelected ? 4 : isAnimating ? 4 : 3}
              strokeLinecap="round"
              markerEnd={isAnimating ? "url(#arrowheadPulse)" : "url(#arrowhead)"}
              filter="url(#glow)"
              opacity={hasAttachedEnd ? (isAnimating ? 0.9 : 0.75) : 0.55}
              className="pointer-events-none"
            />

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
              />
            ))}
          </g>
        );
      })}

      {/* Temporary wire preview during creation */}
      {isCreating && pathPoints.length > 1 && (
        <path
          d={pointsToSVGPath(pathPoints)}
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
