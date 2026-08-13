"use client";

import { useLayoutStore, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayMaskStore } from "@/lib/displayMaskStore";
import { useExecutionStore } from "@/lib/executionStore";
import { usePlaybackStore } from "@/lib/playbackStore";
import { useDisplayStore, formatNum, isInstantSpeed } from "@/lib/displayStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useWireSelectionStore } from "@/lib/wireSelectionStore";
import { useProjectStore } from "@/lib/projectStore";
import {
  calculatePortPosition,
  getPortPlacement,
  resolvePortConfig,
  type PortSide,
} from "@/lib/portPositioning";
import { getWidgetDefinition } from "@/lib/widgetDefinitions";
import {
  buildWirePath,
  enforceOrthogonal,
  escapePort,
  pointsToSVGPath,
  simplifyOrthogonalPath,
  snapToGrid,
  type AABB,
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
  const animationCycle = useSimulatorStore((s) => s.animationCycle);
  const displayMaskActive = useDisplayMaskStore((s) => s.isActive);
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
  const getPrimaryCpu = useSimulatorStore((s) => s.getPrimaryCpu);
  const getComponentTickSteps = useSimulatorStore((s) => s.getComponentTickSteps);
  const getComponentTickOrderByState = useSimulatorStore((s) => s.getComponentTickOrderByState);
  const base = useDisplayStore((s) => s.numericBase);
  const showCpuSignalWires = useDisplayStore((s) => s.showCpuSignalWires);
  const showDataSignalWires = useDisplayStore((s) => s.showDataSignalWires);
  const showWireDots = useDisplayStore((s) => s.showWireDots);
  const animationEnabled = useDisplayStore((s) => s.animationEnabled);
  const animateCpuSignals = useDisplayStore((s) => s.animateCpuSignals);
  const animateDataSignals = useDisplayStore((s) => s.animateDataSignals);
  const animationDurationMs = useDisplayStore((s) => s.animationDurationMs);

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
  /** Wire IDs that have delivered a value at least once — keep a resting dot at
   *  their target port until they flow again (persistent dots). */
  const [settledDots, setSettledDots] = useState<Set<string>>(new Set());
  const animationRef = useRef<number | null>(null);
  const wireDataByIdRef = useRef<Map<string, WireRenderData>>(new Map());
  const lastAnimatedCycleRef = useRef<number | null>(null);
  const previousCpuSignalValuesRef = useRef<Map<string, string>>(new Map());
  /** Substep order values already revealed in the current animation pass. */
  const revealedGroupsRef = useRef<Set<number>>(new Set());

  /**
   * Display settings, mirrored into a ref and read at pass start.
   *
   * They are deliberately NOT dependencies of the animation effect. When they
   * were, moving the speed slider mid-tick re-ran the effect, whose cleanup
   * cancelled the in-flight pass — and the "already animated this cycle" guard
   * then returned without starting a new one, so the pass never finished and
   * playback waited on a signal that could no longer come. Changing a setting
   * now takes effect from the next tick, which is also what the student
   * expects: it does not reach in and rewrite the animation already playing.
   */
  const settingsRef = useRef({
    showCpuSignalWires,
    showDataSignalWires,
    animationEnabled,
    animateCpuSignals,
    animateDataSignals,
    animationDurationMs,
  });
  // Declared before the animation effect so it refreshes first: effects run in
  // declaration order, and a pass starting this commit must read this commit's
  // settings.
  useEffect(() => {
    settingsRef.current = {
      showCpuSignalWires,
      showDataSignalWires,
      animationEnabled,
      animateCpuSignals,
      animateDataSignals,
      animationDurationMs,
    };
  });

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
      const placement = getPortPlacement(
        portName,
        direction,
        allPorts,
        resolvePortConfig(widgetDef?.portConfig, component.meta),
      );
      const pos = calculatePortPosition(component, placement.side, placement.offset);

      return { pos, side: placement.side };
    };

    const resolveWireValue = (wire: WireDescriptor): string => {
      const sourceObj = objects.get(wire.sourceComponentId);
      if (!sourceObj || !("getPorts" in sourceObj)) return "?";

      // For Register output ports during LIVE ticking, use the pre-commit
      // snapshot so the animation shows the value the register was *driving*
      // when this tick began, not the newly latched value from commit().
      //
      // In timeline mode the display-mask system has already applied the
      // pre-tick snapshot to out_value (and holds it there until the register's
      // incoming wire reveals it), so we read the live port instead — reading
      // the stale `preCommitValue` here would show the last batch tick's value
      // (e.g. PC showing 0x001C instead of 0x0000 on the first run).
      if (!displayMaskActive && sourceObj instanceof Register && wire.sourcePortName === "value") {
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

      // Every component except the two this wire connects is an obstacle, so the
      // router can drop corners without cutting a shortcut through a widget.
      const obstacles: AABB[] = [];
      const endpointBoxes: AABB[] = [];
      for (const c of components) {
        const box = { x: c.x, y: c.y, w: c.w, h: c.h };
        if (c.id === wire.sourceComponentId || c.id === wire.targetComponentId) {
          endpointBoxes.push(box);
        } else {
          obstacles.push(box);
        }
      }

      const path = buildWirePath(
        source.pos, source.side,
        target.pos, target.side,
        nodes,
        obstacles,
        endpointBoxes,
      );

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
  }, [projectWires, components, objects, base, revision, displayMaskActive]);

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

  // Drop persistent resting dots when leaving the timeline (fresh program run
  // starts with no settled values).
  useEffect(() => {
    if (!isTimelineActive) setSettledDots(new Set());
  }, [isTimelineActive]);

  useEffect(() => {
    // Animate once per timeline navigation (animationCycle), NOT per revision.
    // Per-substep reveals bump `revision` to refresh displayed values; keying on
    // `animationCycle` here prevents those reveals from restarting this pass.
    if (lastAnimatedCycleRef.current === null) {
      lastAnimatedCycleRef.current = animationCycle;
      return;
    }

    if (lastAnimatedCycleRef.current === animationCycle) {
      return;
    }

    lastAnimatedCycleRef.current = animationCycle;
    // Fresh pass: nothing revealed yet.
    revealedGroupsRef.current = new Set();

    const {
      showCpuSignalWires,
      showDataSignalWires,
      animationEnabled,
      animateCpuSignals,
      animateDataSignals,
      animationDurationMs,
    } = settingsRef.current;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Animation off, or the speed slider pushed all the way to instant: snap
    // straight to the post-tick state, no flow/dots. The two are separate
    // controls but the same behaviour, so they share one exit.
    if (!animationEnabled || isInstantSpeed(animationDurationMs)) {
      setAnimatingWires(new Set());
      setAnimationProgress(new Map());
      useDisplayMaskStore.getState().revealAll();
      // This pass is over before it began, but it is still a pass: playback
      // waits on this signal, so staying silent here would stall it.
      usePlaybackStore.getState().notifyTickAnimationComplete();
      return;
    }

    const currentWireData = Array.from(wireDataByIdRef.current.values());
    const cpu = getPrimaryCpu();
    const executedState = cpu?.previousState ?? cpu?.state;
    const changedCpuSignals = new Set(cpu?.getChangedControlSignalPorts() ?? []);

    const visibleWireIds = currentWireData
      .filter((wireData) => {
        if (wireData.wire.visible === false) return false;
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

    if (visibleWireIds.length === 0) {
      // No wire takes part in this state at all — the reset tick is the usual
      // case. Nothing to animate, but the pass is still over, and playback is
      // waiting to hear so.
      useDisplayMaskStore.getState().revealAll();
      usePlaybackStore.getState().notifyTickAnimationComplete();
      return;
    }

    const cpuValueChanges = new Set<string>();
    for (const id of visibleWireIds) {
      const wireData = wireDataByIdRef.current.get(id);
      if (!wireData?.isCpuControlSignal) continue;

      const previousValue = previousCpuSignalValuesRef.current.get(id);
      if (previousValue !== undefined && previousValue !== wireData.value) {
        cpuValueChanges.add(id);
      }
      previousCpuSignalValuesRef.current.set(id, wireData.value);
    }

    // Changed CPU signal wire IDs (those whose source port value changed this tick).
    const changedCpuIds = visibleWireIds.filter((id) => {
      const wireData = wireDataByIdRef.current.get(id);
      if (!wireData?.isCpuControlSignal) return false;
      return changedCpuSignals.has(wireData.wire.sourcePortName) || cpuValueChanges.has(id);
    });
    const allNonCpuIds = visibleWireIds.filter((id) => !wireDataByIdRef.current.get(id)?.isCpuControlSignal);

    // Apply per-category animation toggles.
    // Unchanged CPU wires are always static; changed ones obey animateCpuSignals.
    const animCpuIds = animateCpuSignals ? changedCpuIds : [];
    // Data wires obey animateDataSignals; if disabled, data reveals happen instantly.
    const animNonCpuIds = animateDataSignals ? allNonCpuIds : [];

    if (animCpuIds.length === 0 && animNonCpuIds.length === 0) {
      useDisplayMaskStore.getState().revealAll();
      // Nothing to animate this tick (a HALT, or every category switched off) —
      // still a completed pass as far as playback is concerned.
      usePlaybackStore.getState().notifyTickAnimationComplete();
      return;
    }

    // Build substep groups only from the wires we're actually animating.
    const nonCpuOrderGroups = new Map<number, string[]>();
    for (const id of animNonCpuIds) {
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

    // Keep the order key so each group can trigger the matching substep reveal.
    const sortedNonCpuGroups = Array.from(nonCpuOrderGroups.entries())
      .sort((a, b) => a[0] - b[0]);

    const startTime = Date.now();
    // CPU changed signals animate concurrently in a single phase before data substeps.
    const effectiveCpuDuration = animCpuIds.length > 0 ? animationDurationMs : 0;
    const nonCpuStaggerStep = animationDurationMs;
    const nonCpuGroupCount = sortedNonCpuGroups.length;
    const nonCpuPhaseDuration = nonCpuGroupCount > 0
      ? animationDurationMs * nonCpuGroupCount
      : 0;
    const totalDuration = effectiveCpuDuration + nonCpuPhaseDuration;

    // If data animation is disabled, reveal all data components immediately so
    // they show post-tick values; CPU signal animation (if any) runs on top.
    if (!animateDataSignals) {
      useDisplayMaskStore.getState().revealAll();
    }

    // Both changed CPU wires and data wires get animated dots.
    const animatingIds = [...animCpuIds, ...animNonCpuIds];

    const kickoff = window.setTimeout(() => {
      setAnimatingWires(new Set(animatingIds));
    }, 0);

    /**
     * End the pass: settle the dots, land every component on its post-tick
     * value and tell playback the tick is over.
     *
     * Idempotent, and reached from two directions on purpose. The rAF loop gets
     * here on the frame that crosses `totalDuration`, but requestAnimationFrame
     * stops being called altogether while the tab is hidden — so a run left in
     * a background tab would hang on the current tick forever and still be
     * sitting there on return. The timer below is what actually guarantees the
     * pass ends; the animation loop only paints it.
     */
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // The last substep finishes exactly at `totalDuration`, so the frame
      // where its `groupProgress` reaches 1 may never run and its wires were
      // never settled — which is why the final value delivered each state
      // (MUX_PC -> PC on a fetch) vanished instead of resting at its
      // destination. Settle everything that animated in this pass here.
      setSettledDots((prev) => {
        const next = new Set(prev);
        for (const id of animatingIds) next.add(id);
        return next;
      });
      setAnimatingWires(new Set());
      setAnimationProgress(new Map());
      useDisplayMaskStore.getState().revealAll();
      usePlaybackStore.getState().notifyTickAnimationComplete();
    };

    const finishTimer = window.setTimeout(finish, totalDuration);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= totalDuration) {
        finish();
        return;
      }

      const progress = new Map<string, number>();

      // ── CPU phase: changed control-signal wires animate concurrently ──────
      for (const id of animCpuIds) {
        progress.set(id, 0);
      }
      if (animCpuIds.length > 0 && effectiveCpuDuration > 0) {
        const cpuProgress = Math.min(1, elapsed / effectiveCpuDuration);
        for (const id of animCpuIds) {
          progress.set(id, cpuProgress);
        }
        // Once the CPU phase ends, mark these wires as settled.
        if (cpuProgress >= 1 && !revealedGroupsRef.current.has(-1)) {
          revealedGroupsRef.current.add(-1);
          setSettledDots((prev) => {
            const next = new Set(prev);
            for (const wireId of animCpuIds) next.add(wireId);
            return next;
          });
        }
      }

      // ── Data substep phases: sequential, one group per substep ────────────
      for (const id of animNonCpuIds) {
        progress.set(id, 0);
      }
      if (elapsed > effectiveCpuDuration && animationDurationMs > 0 && sortedNonCpuGroups.length > 0) {
        const compElapsed = elapsed - effectiveCpuDuration;

        sortedNonCpuGroups.forEach(([order, groupIds], index) => {
          const groupStart = index * nonCpuStaggerStep;
          const groupProgress = Math.min(1, Math.max(0, (compElapsed - groupStart) / animationDurationMs));
          for (const id of groupIds) {
            progress.set(id, groupProgress);
          }

          // ENGINE TICK: once this substep's wires finish, reveal the components
          // those wires TARGET — a component latches its new value only after the
          // wires feeding into it arrive. This keeps a register (e.g. PC) showing
          // its old value while it drives an earlier substep, updating only once
          // its own incoming wire (the last substep) completes.
          if (groupProgress >= 1 && !revealedGroupsRef.current.has(order)) {
            revealedGroupsRef.current.add(order);
            const targetIds: string[] = [];
            for (const wireId of groupIds) {
              const targetId = wireDataByIdRef.current.get(wireId)?.wire.targetComponentId;
              if (targetId) targetIds.push(targetId);
            }
            useDisplayMaskStore.getState().revealComponents(targetIds);

            // These wires have now delivered — keep a resting dot at their target.
            setSettledDots((prev) => {
              const next = new Set(prev);
              for (const wireId of groupIds) next.add(wireId);
              return next;
            });
          }
        });
      }

      setAnimationProgress(progress);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.clearTimeout(kickoff);
      window.clearTimeout(finishTimer);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
    // Settings are read from settingsRef at pass start, on purpose — see the
    // comment on that ref. Listing them here would let a mid-tick settings
    // change abort the pass.
  }, [animationCycle, getPrimaryCpu, getComponentTickSteps, getComponentTickOrderByState]);

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
  }, [selectedWireId, handleDeleteSelection, deselectWire]);

  if (!visible) return null;

  const visibleWires = wireRenderData.filter((wireData) => {
    if (wireData.wire.visible === false) return false;
    if (wireData.isCpuControlSignal && !showCpuSignalWires) return false;
    if (!wireData.isCpuControlSignal && !showDataSignalWires) return false;
    return true;
  });

  /**
   * Where the travelling value marker sits on each wire, or null when that wire
   * is not carrying anything right now.
   */
  const valueMarkers = visibleWires.flatMap((wireData) => {
    // Dots can be disabled globally; CPU wires only show dots when they're in
    // the current animation set (i.e. their value changed).
    if (!showWireDots) return [];
    if (wireData.isCpuControlSignal && !animatingWires.has(wireData.wire.id)) return [];

    const liveProgress = animationProgress.get(wireData.wire.id);
    let progress: number | null = null;
    if (liveProgress !== undefined) {
      // Flowing this pass: appear only once its substep starts.
      if (liveProgress > 0) progress = liveProgress;
    } else if (settledDots.has(wireData.wire.id)) {
      // Not flowing right now but has delivered before — rest at the target port
      // until a new value flows.
      progress = 1;
    }
    if (progress === null) return [];

    return [{
      id: wireData.wire.id,
      point: getPointAlongPath(wireData.path, progress),
      value: wireData.value,
      color: wireData.isCpuControlSignal ? "var(--wire-control)" : "var(--wire-data)",
      isResting: progress >= 1,
      // Resting markers sit on top of the destination widget, so push the badge
      // further away and to the side the wire arrived from.
      lift: progress >= 1 ? 26 : 20,
    }];
  });

  return (
    <>
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      }}
    >
      {/* The two multi-colour wire gradients and the two blur filters that used
          to live here are gone. A gradient spent colour on wire identity, and
          the filters glowed a wire whether or not anything was flowing through
          it — which is precisely the thing that made every tick look alike. */}

      {visibleWires
        .map((wireData) => {
          const { wire, path } = wireData;
          const pathD = pointsToSVGPath(path);
          const isSelected = wire.id === selectedWireId;
          const isHovered = wire.id === hoveredWireId && !isSelected;
          const isAnimating = animatingWires.has(wire.id);

          // A wire at rest is a hairline in the border colour — it is context,
          // not content. It takes the data colour only while it is actually
          // conducting, which is what makes a tick visible from across the room.
          const baseColor = isAnimating ? "var(--st-data)" : "var(--border)";
          const pulseColor = "var(--st-data)";

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

              {/* Wires are deliberately thin and un-glowed: they are context, not
                  content. Only the hovered/selected wire thickens, and only the
                  wire currently carrying a value lights up. */}
              <path
                d={pathD}
                fill="none"
                strokeWidth={isSelected || isHovered || isAnimating ? 1.5 : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none"
                style={{ stroke: isSelected || isHovered ? pulseColor : baseColor }}
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
                      fill={isNodeSelected ? "var(--st-active)" : isSelected ? "var(--text-muted)" : "transparent"}
                      stroke={isNodeSelected ? "var(--st-active)" : isSelected ? "var(--text)" : "transparent"}
                      strokeWidth={isNodeSelected ? 2 : 1}
                      className="pointer-events-none"
                    />
                  </g>
                );
              })}

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
              fill="var(--surface)" stroke="var(--st-error)" strokeWidth="1" cursor="pointer"
              onClick={(e) => { e.stopPropagation(); handleDeleteSelection(); }}
            />
            <text textAnchor="middle" dominantBaseline="central"
              style={{ fontSize: "12px", fill: "var(--st-error)", cursor: "pointer", userSelect: "none" }}
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
              fill={selectedWireId === wireId ? "var(--text-muted)" : "var(--text-faint)"}
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
            stroke={previewRejected ? "var(--st-error)" : "var(--st-active)"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="6,4"
          />
          {/* Endpoint dot */}
          <circle
            cx={previewPath[previewPath.length - 1].x}
            cy={previewPath[previewPath.length - 1].y}
            r="5"
            fill={previewRejected ? "var(--st-error)" : "var(--st-active)"}
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
          style={{ fill: "var(--text-faint)", fontSize: "14px" }}
        >
          No wire connections
        </text>
      )}
    </svg>

    {/*
      Transmitted values live in their own layer painted ABOVE the widgets
      (widgets sit at z-index 10). Previously they were drawn with the wires,
      underneath, so a value became unreadable exactly when it arrived at its
      destination — which is the moment that matters.
    */}
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, zIndex: 30 }}
    >
      {valueMarkers.map((marker) => {
        // The value sits ON the wire, with a canvas-coloured plate cutting the
        // stroke out behind the glyphs. It used to be a bordered badge floating
        // 20px above the line, which scattered saturated chips across the canvas
        // and left the reader to work out which wire each one belonged to.
        const width = marker.value.length * 6.7 + 8;

        return (
          <g key={`value-${marker.id}`} transform={`translate(${marker.point.x}, ${marker.point.y})`}>
            <rect
              x={-width / 2}
              y={-7}
              width={width}
              height={14}
              style={{ fill: "var(--canvas)" }}
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              className="font-mono num"
              style={{
                fontSize: "11px",
                fill: marker.isResting ? "var(--text-muted)" : "var(--st-data)",
              }}
            >
              {marker.value}
            </text>
          </g>
        );
      })}
    </svg>
    </>
  );
}
