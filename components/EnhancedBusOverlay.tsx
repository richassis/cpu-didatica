"use client";

import { useLayoutStore, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useWireSelectionStore } from "@/lib/wireSelectionStore";
import type { DragSegmentState, DragNodeState } from "@/lib/wireSelectionStore";
import { useProjectStore } from "@/lib/projectStore";
import { calculatePortPosition, getPortPlacement, type PortSide } from "@/lib/portPositioning";
import { getWidgetDefinition } from "@/lib/widgetDefinitions";
import {
  enforceOrthogonal,
  escapePort,
  pointsToSVGPath,
  simplifyOrthogonalPath,
  snapToGrid,
  type Point,
} from "@/lib/wireRouting";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { WireDescriptor } from "@/lib/simulator";
import { Register } from "@/lib/simulator";

const GRID_SIZE = 16;
const HIT_AREA_WIDTH = 14;

type SegmentOrientation = "horizontal" | "vertical";

interface WireRenderData {
  wire: WireDescriptor;
  path: Point[];
  sourceEscape: Point;
  targetEscape: Point;
  value: string;
  isCpuControlSignal: boolean;
}

function normalizeNodes(nodes: Array<{ x: number; y: number }>): Point[] {
  const snapped = nodes.map((node) => ({
    x: snapToGrid(node.x, GRID_SIZE),
    y: snapToGrid(node.y, GRID_SIZE),
  }));

  return simplifyOrthogonalPath(enforceOrthogonal(snapped));
}

export default function EnhancedBusOverlay({
  visible,
  previewRejected = false,
}: {
  visible: boolean;
  previewRejected?: boolean;
}) {
  const components = useLayoutStore((s) => s.components);
  const zoom = useLayoutStore((s) => s.zoom);
  const objects = useSimulatorStore((s) => s.objects);
  const revision = useSimulatorStore((s) => s.revision);
  const getPrimaryCpu = useSimulatorStore((s) => s.getPrimaryCpu);
  const getComponentTickSteps = useSimulatorStore((s) => s.getComponentTickSteps);
  const getComponentTickOrderByState = useSimulatorStore((s) => s.getComponentTickOrderByState);
  const base = useDisplayStore((s) => s.numericBase);
  const showCpuSignalWires = useDisplayStore((s) => s.showCpuSignalWires);
  const showDataSignalWires = useDisplayStore((s) => s.showDataSignalWires);
  const cpuAnimationDuration = useDisplayStore((s) => s.cpuAnimationDuration);
  const componentAnimationDuration = useDisplayStore((s) => s.componentAnimationDuration);

  const removeSimulatorWire = useSimulatorStore((s) => s.removeWire);

  const activeTabId = useProjectStore((s) => s.activeTabId);
  const projectData = useProjectStore((s) => s.projectData);
  const updateWireNodes = useProjectStore((s) => s.updateWireNodes);
  const removeWireFromProject = useProjectStore((s) => s.removeWireFromProject);

  const creationPhase = useWireCreationStore((s) => s.phase);
  const previewPath = useWireCreationStore((s) => s.previewPath);
  const isCreating = creationPhase === "dragging";

  // Wire selection/editing from shared store
  const selectedWireId = useWireSelectionStore((s) => s.selectedWireId);
  const hoveredWireId = useWireSelectionStore((s) => s.hoveredWireId);
  const selectedNodeIndex = useWireSelectionStore((s) => s.selectedNodeIndex);
  const dragNodeState = useWireSelectionStore((s) => s.dragNode);
  const dragSegmentState = useWireSelectionStore((s) => s.dragSegment);
  const selectWire = useWireSelectionStore((s) => s.selectWire);
  const deselectWire = useWireSelectionStore((s) => s.deselectWire);
  const setHoveredWire = useWireSelectionStore((s) => s.setHoveredWire);
  const selectNode = useWireSelectionStore((s) => s.selectNode);
  const startSegmentDrag = useWireSelectionStore((s) => s.startSegmentDrag);
  const startNodeDrag = useWireSelectionStore((s) => s.startNodeDrag);
  const endDrag = useWireSelectionStore((s) => s.endDrag);

  const [animatingWires, setAnimatingWires] = useState<Set<string>>(new Set());
  const [animationProgress, setAnimationProgress] = useState<Map<string, number>>(new Map());
  const animationRef = useRef<number | null>(null);
  const wireDataByIdRef = useRef<Map<string, WireRenderData>>(new Map());
  const lastAnimatedRevisionRef = useRef<number | null>(null);

  const projectWires = useMemo(
    () => (activeTabId ? projectData[activeTabId]?.wires ?? [] : []),
    [activeTabId, projectData]
  );

  const wireRenderData = useMemo((): WireRenderData[] => {
    const resolveEndpoint = (
      componentId: string,
      portName: string,
      direction: "input" | "output"
    ): { pos: Point; side: PortSide } | null => {
      const component = components.find((c) => c.id === componentId);
      const obj = objects.get(componentId);
      if (!component || !obj || !("getPorts" in obj)) return null;

      const portMap = (obj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
      const allPorts = Object.entries(portMap).map(([name, port]) => ({
        name,
        direction: port.direction as "input" | "output",
      }));

      const widgetDef = getWidgetDefinition(component.type);
      const placement = getPortPlacement(portName, direction, allPorts, widgetDef?.portConfig);
      const pos = calculatePortPosition(component, placement.side, placement.offset);

      return { pos, side: placement.side };
    };

    const resolveWireValue = (wire: WireDescriptor): string => {
      const sourceObj = objects.get(wire.sourceComponentId);
      if (!sourceObj || !("getPorts" in sourceObj)) return "?";

      // For Register output ports, use the pre-commit snapshot so the animation
      // shows the value the register was *driving* when this tick began,
      // not the newly latched value it received during commit().
      // This is most visible on PC: PC=0 sends 0 to InstructionMemory in FETCH,
      // even though PC commits to 1 in the same tick.
      if (sourceObj instanceof Register && wire.sourcePortName === "value") {
        return formatNum(sourceObj.preCommitValue, base, sourceObj.bitWidth);
      }

      const ports = (sourceObj as { getPorts: () => Record<string, { value: unknown; bitWidth: number | null }> }).getPorts();
      const port = ports[wire.sourcePortName];
      if (!port) return "?";

      const raw = port.value;
      if (typeof raw === "number") {
        return formatNum(raw, base, port.bitWidth ?? 16);
      }

      return String(raw);
    };

    const data: WireRenderData[] = [];

    for (const wire of projectWires) {
      const source = resolveEndpoint(wire.sourceComponentId, wire.sourcePortName, "output");
      const target = resolveEndpoint(wire.targetComponentId, wire.targetPortName, "input");
      if (!source || !target) continue;

      const sourceEscape = escapePort(source.pos, source.side)[1] ?? source.pos;
      const targetEscape = escapePort(target.pos, target.side)[1] ?? target.pos;
      const nodes = normalizeNodes(wire.nodes ?? []);

      const rawPath = [source.pos, sourceEscape, ...nodes, targetEscape, target.pos];
      const path = simplifyOrthogonalPath(enforceOrthogonal(rawPath));

      const sourceComponent = components.find((c) => c.id === wire.sourceComponentId);
      const isCpuControlSignal = sourceComponent?.type === "CpuComponent";

      data.push({
        wire,
        path,
        sourceEscape,
        targetEscape,
        value: resolveWireValue(wire),
        isCpuControlSignal,
      });
    }

    return data;
  }, [projectWires, components, objects, base]);

  const wireDataById = useMemo(() => {
    const map = new Map<string, WireRenderData>();
    for (const wireData of wireRenderData) {
      map.set(wireData.wire.id, wireData);
    }
    return map;
  }, [wireRenderData]);

  useEffect(() => {
    wireDataByIdRef.current = wireDataById;
  }, [wireDataById]);

  useEffect(() => {
    // Only animate once per simulator tick revision.
    if (lastAnimatedRevisionRef.current === null) {
      lastAnimatedRevisionRef.current = revision;
      return;
    }

    if (lastAnimatedRevisionRef.current === revision) {
      return;
    }

    lastAnimatedRevisionRef.current = revision;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const currentWireData = Array.from(wireDataByIdRef.current.values());
    const cpu = getPrimaryCpu();
    const executedState = cpu?.previousState ?? cpu?.state;
    const changedCpuSignals = new Set(cpu?.getChangedControlSignalPorts() ?? []);

    const visibleWireIds = currentWireData
      .filter((wireData) => {
        if (wireData.isCpuControlSignal && !showCpuSignalWires) return false;
        if (!wireData.isCpuControlSignal && !showDataSignalWires) return false;

        // Keep per-state configuration as animation-only masking.
        if (!wireData.isCpuControlSignal && executedState !== undefined) {
          const animationSteps = getComponentTickSteps(wireData.wire.sourceComponentId);
          if (
            animationSteps &&
            animationSteps.length > 0 &&
            !animationSteps.includes(executedState)
          ) {
            return false;
          }
        }

        return true;
      })
      .map((wireData) => wireData.wire.id);

    if (visibleWireIds.length === 0) return;

    const cpuIds = visibleWireIds.filter((id) => {
      const wireData = wireDataByIdRef.current.get(id);
      if (!wireData?.isCpuControlSignal) return false;
      return changedCpuSignals.has(wireData.wire.sourcePortName);
    });
    const nonCpuIds = visibleWireIds.filter((id) => !wireDataByIdRef.current.get(id)?.isCpuControlSignal);
    if (cpuIds.length === 0 && nonCpuIds.length === 0) return;
    const nonCpuOrderGroups = new Map<number, string[]>();

    for (const id of nonCpuIds) {
      const wireData = wireDataByIdRef.current.get(id);
      if (!wireData) continue;

      const sourceId = wireData.wire.sourceComponentId;
      const orderForState =
        executedState !== undefined
          ? getComponentTickOrderByState(sourceId)?.[executedState] ?? 0
          : 0;
      const normalizedOrder = Number.isFinite(orderForState)
        ? Math.max(0, Math.floor(orderForState))
        : 0;

      const group = nonCpuOrderGroups.get(normalizedOrder) ?? [];
      group.push(id);
      nonCpuOrderGroups.set(normalizedOrder, group);
    }

    const sortedNonCpuGroups = Array.from(nonCpuOrderGroups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, ids]) => ids);

    const startTime = Date.now();
    const nonCpuGroupCount = sortedNonCpuGroups.length;
    // Strict sequencing: each substep starts only after the previous one finishes.
    const nonCpuStaggerStep = componentAnimationDuration;
    const effectiveCpuDuration = cpuIds.length > 0 ? cpuAnimationDuration : 0;
    const nonCpuPhaseDuration = nonCpuGroupCount > 0
      ? componentAnimationDuration * nonCpuGroupCount
      : 0;
    const totalDuration = effectiveCpuDuration + nonCpuPhaseDuration;

    const animatingIds = [...cpuIds, ...nonCpuIds];

    const kickoff = window.setTimeout(() => {
      setAnimatingWires(new Set(animatingIds));
    }, 0);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= totalDuration) {
        setAnimatingWires(new Set());
        setAnimationProgress(new Map());
        animationRef.current = null;
        return;
      }

      const progress = new Map<string, number>();

      for (const id of cpuIds) {
        progress.set(id, Math.min(1, elapsed / Math.max(1, effectiveCpuDuration)));
      }

      for (const id of nonCpuIds) {
        progress.set(id, 0);
      }

      if (elapsed > effectiveCpuDuration && componentAnimationDuration > 0 && sortedNonCpuGroups.length > 0) {
        const compElapsed = elapsed - effectiveCpuDuration;

        sortedNonCpuGroups.forEach((groupIds, index) => {
          const groupStart = index * nonCpuStaggerStep;
          const groupProgress = Math.min(1, Math.max(0, (compElapsed - groupStart) / componentAnimationDuration));
          for (const id of groupIds) {
            progress.set(id, groupProgress);
          }
        });
      }

      setAnimationProgress(progress);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.clearTimeout(kickoff);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [
    revision,
    getPrimaryCpu,
    getComponentTickSteps,
    getComponentTickOrderByState,
    showCpuSignalWires,
    showDataSignalWires,
    cpuAnimationDuration,
    componentAnimationDuration,
  ]);

  const getPointAlongPath = useCallback((path: Point[], progress: number): Point => {
    if (path.length < 2) return path[0] ?? { x: 0, y: 0 };

    const segments: Array<{ start: Point; end: Point; length: number }> = [];
    let totalLength = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      segments.push({ start, end, length });
      totalLength += length;
    }

    const targetLength = totalLength * progress;
    let consumed = 0;

    for (const segment of segments) {
      if (consumed + segment.length >= targetLength) {
        const localT = segment.length === 0 ? 0 : (targetLength - consumed) / segment.length;
        return {
          x: segment.start.x + (segment.end.x - segment.start.x) * localT,
          y: segment.start.y + (segment.end.y - segment.start.y) * localT,
        };
      }
      consumed += segment.length;
    }

    return path[path.length - 1];
  }, []);

  const commitWireNodes = useCallback(
    (wireId: string, nodes: Point[]) => {
      updateWireNodes(wireId, normalizeNodes(nodes));
    },
    [updateWireNodes]
  );

  useEffect(() => {
    if (!dragNodeState && !dragSegmentState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.querySelector("[data-canvas]") as HTMLElement | null;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = snapToGrid((e.clientX - rect.left + canvas.scrollLeft) / zoom, GRID_SIZE);
      const canvasY = snapToGrid((e.clientY - rect.top + canvas.scrollTop) / zoom, GRID_SIZE);

      if (dragNodeState) {
        const wireData = wireDataById.get(dragNodeState.wireId);
        if (!wireData) return;

        const nodes = [...(wireData.wire.nodes ?? [])];
        const current = nodes[dragNodeState.nodeIndex];
        if (!current) return;

        const prev = dragNodeState.nodeIndex === 0
          ? wireData.sourceEscape
          : nodes[dragNodeState.nodeIndex - 1];
        const next = dragNodeState.nodeIndex === nodes.length - 1
          ? wireData.targetEscape
          : nodes[dragNodeState.nodeIndex + 1];

        const fixedX = prev.x === current.x || next.x === current.x;
        const fixedY = prev.y === current.y || next.y === current.y;

        nodes[dragNodeState.nodeIndex] = {
          x: fixedX && !fixedY ? current.x : canvasX,
          y: fixedY && !fixedX ? current.y : canvasY,
        };

        commitWireNodes(dragNodeState.wireId, nodes);
      }

      if (dragSegmentState) {
        const axisValue = dragSegmentState.orientation === "horizontal" ? canvasY : canvasX;
        const delta = axisValue - dragSegmentState.startAxisValue;

        const nodes = dragSegmentState.initialNodes.map((node) => ({ ...node }));

        if (nodes.length === 0) {
          const wireData = wireDataById.get(dragSegmentState.wireId);
          if (!wireData) return;

          const synthetic = [
            { ...wireData.sourceEscape },
            { ...wireData.targetEscape },
          ];

          if (dragSegmentState.orientation === "horizontal") {
            synthetic[0].y += delta;
            synthetic[1].y += delta;
          } else {
            synthetic[0].x += delta;
            synthetic[1].x += delta;
          }

          commitWireNodes(dragSegmentState.wireId, synthetic);
          return;
        }

        const leftNodeIndex = dragSegmentState.segmentIndex - 1;
        const rightNodeIndex = dragSegmentState.segmentIndex;

        const affectedIndices = new Set<number>();
        if (leftNodeIndex >= 0 && leftNodeIndex < nodes.length) {
          affectedIndices.add(leftNodeIndex);
        }
        if (rightNodeIndex >= 0 && rightNodeIndex < nodes.length) {
          affectedIndices.add(rightNodeIndex);
        }

        for (const index of affectedIndices) {
          if (dragSegmentState.orientation === "horizontal") {
            nodes[index].y += delta;
          } else {
            nodes[index].x += delta;
          }
        }

        commitWireNodes(dragSegmentState.wireId, nodes);
      }
    };

    const handleMouseUp = () => {
      endDrag();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragNodeState, dragSegmentState, zoom, wireDataById, commitWireNodes, endDrag]);

  const handleDeleteSelection = useCallback(() => {
    if (!selectedWireId) return;

    const wireData = wireDataById.get(selectedWireId);
    if (!wireData) return;

    if (selectedNodeIndex !== null) {
      const nodes = [...(wireData.wire.nodes ?? [])];
      if (selectedNodeIndex >= 0 && selectedNodeIndex < nodes.length) {
        nodes.splice(selectedNodeIndex, 1);
        commitWireNodes(selectedWireId, nodes);
      }
      useWireSelectionStore.getState().deselectNode();
      return;
    }

    removeSimulatorWire(selectedWireId);
    removeWireFromProject(selectedWireId);
    deselectWire();
  }, [
    selectedWireId,
    selectedNodeIndex,
    wireDataById,
    commitWireNodes,
    removeSimulatorWire,
    removeWireFromProject,
    deselectWire,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        deselectWire();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedWireId) {
        e.preventDefault();
        handleDeleteSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedWireId, handleDeleteSelection]);

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
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="pulseGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id="wireGradientData" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.85" />
        </linearGradient>

        <linearGradient id="wireGradientControl" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {wireRenderData
        .filter((wireData) => {
          if (wireData.isCpuControlSignal && !showCpuSignalWires) return false;
          if (!wireData.isCpuControlSignal && !showDataSignalWires) return false;
          return true;
        })
        .map((wireData) => {
          const { wire, path, value, isCpuControlSignal } = wireData;
          const pathD = pointsToSVGPath(path);
          const isSelected = wire.id === selectedWireId;
          const isHovered = wire.id === hoveredWireId && !isSelected;
          const isAnimating = animatingWires.has(wire.id);

          const baseColor = isCpuControlSignal ? "url(#wireGradientControl)" : "url(#wireGradientData)";
          const pulseColor = isCpuControlSignal ? "#60a5fa" : "#fbbf24";

          const editableChain = [wireData.sourceEscape, ...(wire.nodes ?? []), wireData.targetEscape];

          return (
            <g key={wire.id}>
              {editableChain.slice(0, -1).map((point, index) => {
                const next = editableChain[index + 1];
                const orientation: SegmentOrientation = point.y === next.y ? "horizontal" : "vertical";
                const insertIndex = index;

                return (
                  <path
                    key={`${wire.id}-segment-${index}`}
                    d={`M ${point.x} ${point.y} L ${next.x} ${next.y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={HIT_AREA_WIDTH}
                    className="pointer-events-auto cursor-pointer"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const canvas = document.querySelector("[data-canvas]") as HTMLElement | null;
                      if (!canvas) return;

                      const rect = canvas.getBoundingClientRect();
                      const canvasX = snapToGrid((e.clientX - rect.left + canvas.scrollLeft) / zoom, GRID_SIZE);
                      const canvasY = snapToGrid((e.clientY - rect.top + canvas.scrollTop) / zoom, GRID_SIZE);

                      selectWire(wire.id);
                      startSegmentDrag({
                        wireId: wire.id,
                        segmentIndex: index,
                        orientation,
                        startAxisValue: orientation === "horizontal" ? canvasY : canvasX,
                        initialNodes: (wire.nodes ?? []).map((node) => ({ ...node })),
                      });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      const svg = e.currentTarget.ownerSVGElement;
                      if (!svg) return;

                      const pointRef = svg.createSVGPoint();
                      pointRef.x = e.clientX;
                      pointRef.y = e.clientY;
                      const transformed = pointRef.matrixTransform(svg.getScreenCTM()?.inverse());

                      const nodes = [...(wire.nodes ?? [])];
                      nodes.splice(insertIndex, 0, {
                        x: snapToGrid(transformed.x, GRID_SIZE),
                        y: snapToGrid(transformed.y, GRID_SIZE),
                      });

                      commitWireNodes(wire.id, nodes);
                      selectWire(wire.id);
                    }}
                  />
                );
              })}

              <path
                d={pathD}
                fill="none"
                stroke={isSelected ? pulseColor : isHovered ? pulseColor : baseColor}
                strokeWidth={isSelected ? 5 : isHovered ? 4 : 3}
                strokeLinecap="round"
                filter="url(#glow)"
                opacity={isAnimating ? 0.95 : 0.78}
                className="pointer-events-none"
              />

              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={HIT_AREA_WIDTH}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  selectWire(wire.id);
                }}
                onMouseEnter={() => setHoveredWire(wire.id)}
                onMouseLeave={() => setHoveredWire(null)}
              />

              {(wire.nodes ?? []).map((node, index) => {
                const isNodeSelected = isSelected && selectedNodeIndex === index;

                return (
                  <g key={`${wire.id}-node-${index}`}>
                    <rect
                      x={node.x - 6}
                      y={node.y - 6}
                      width={12}
                      height={12}
                      fill="transparent"
                      className="pointer-events-auto cursor-move"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        selectNode(wire.id, index);
                        startNodeDrag({ wireId: wire.id, nodeIndex: index });
                      }}
                    />
                    <rect
                      x={node.x - 4}
                      y={node.y - 4}
                      width={8}
                      height={8}
                      rx={2}
                      fill={isNodeSelected ? "#22d3ee" : isSelected ? "#9ca3af" : "transparent"}
                      stroke={isNodeSelected ? "#67e8f9" : isSelected ? "#e5e7eb" : "transparent"}
                      strokeWidth={isNodeSelected ? 2 : 1}
                      className="pointer-events-none"
                    />
                  </g>
                );
              })}

              {isAnimating && (
                (() => {
                  const progress = animationProgress.get(wire.id) ?? 0;
                  const point = getPointAlongPath(path, progress);

                  return (
                    <g transform={`translate(${point.x}, ${point.y})`} className="pointer-events-none">
                      <circle r="6" fill={pulseColor} filter="url(#pulseGlow)" opacity="0.9" />
                      <g transform="translate(0, -16)">
                        <rect x="-18" y="-8" width="36" height="16" rx="4" fill="#111827" stroke={pulseColor} strokeWidth="1.4" />
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="font-mono"
                          style={{ fontSize: "9px", fill: "#f3f4f6" }}
                        >
                          {value}
                        </text>
                      </g>
                    </g>
                  );
                })()
              )}
            </g>
          );
        })}
      {/* ── Selected wire delete button ──────────────────────── */}
      {selectedWireId && (() => {
        const wd = wireDataById.get(selectedWireId);
        if (!wd) return null;
        const mid = wd.path[Math.floor(wd.path.length / 2)];
        if (!mid) return null;
        return (
          <g transform={`translate(${mid.x}, ${mid.y - 18})`} className="pointer-events-auto">
            <rect x="-12" y="-12" width="24" height="24" rx="6"
              fill="#1f2937" stroke="#ef4444" strokeWidth="1.5" cursor="pointer"
              onClick={(e) => { e.stopPropagation(); handleDeleteSelection(); }}
            />
            <text textAnchor="middle" dominantBaseline="central"
              style={{ fontSize: "14px", fill: "#ef4444", cursor: "pointer", userSelect: "none" }}
              onClick={(e) => { e.stopPropagation(); handleDeleteSelection(); }}
            >✕</text>
          </g>
        );
      })()}

      {/* ── Segment hover handles ──────────────────────────── */}
      {(selectedWireId || hoveredWireId) && (() => {
        const wireId = selectedWireId || hoveredWireId;
        if (!wireId) return null;
        const wd = wireDataById.get(wireId);
        if (!wd) return null;
        const chain = [wd.sourceEscape, ...(wd.wire.nodes ?? []), wd.targetEscape];
        return chain.slice(0, -1).map((pt, i) => {
          const next = chain[i + 1];
          const mx = (pt.x + next.x) / 2;
          const my = (pt.y + next.y) / 2;
          const isH = pt.y === next.y;
          return (
            <rect key={`handle-${wireId}-${i}`}
              x={isH ? mx - 3 : mx - 2} y={isH ? my - 2 : my - 3}
              width={isH ? 6 : 4} height={isH ? 4 : 6} rx="1"
              fill={selectedWireId === wireId ? "#9ca3af" : "#6b7280"}
              opacity="0.7"
              className="pointer-events-none"
            />
          );
        });
      })()}

      {/* ── Wire creation preview (auto-routed) ───────────── */}
      {isCreating && previewPath.length > 1 && (
        <g>
          <path
            d={pointsToSVGPath(previewPath)}
            fill="none"
            stroke={previewRejected ? "#ef4444" : "#22d3ee"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="8,4"
            opacity="0.8"
            filter="url(#glow)"
          />
          {/* Endpoint dot */}
          <circle
            cx={previewPath[previewPath.length - 1].x}
            cy={previewPath[previewPath.length - 1].y}
            r="5"
            fill={previewRejected ? "#ef4444" : "#22d3ee"}
            opacity="0.9"
            className="pointer-events-none"
          />
        </g>
      )}

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
