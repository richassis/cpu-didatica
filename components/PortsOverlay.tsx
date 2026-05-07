"use client";

import { useCallback } from "react";
import { useLayoutStore } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import type { HoveredPort } from "@/lib/wireCreationStore";
import { useDisplayStore } from "@/lib/displayStore";
import { useModeStore } from "@/lib/modeStore";
import { useExecutionStore } from "@/lib/executionStore";
import { getWidgetDefinition } from "@/lib/widgetDefinitions";
import { findPortPosition, getPortPlacement } from "@/lib/portPositioning";
import type { PortSide } from "@/lib/portPositioning";
import type { AABB } from "@/lib/wireRouting";
import PortIndicator from "./PortIndicator";
import { useMemo } from "react";

interface PortInfo {
  name: string;
  direction: "input" | "output";
}

interface Props {
  componentId: string;
}

/**
 * Renders port indicators for a component.
 * Must be used inside a relatively-positioned container.
 */
export default function PortsOverlay({ componentId }: Props) {
  const objects = useSimulatorStore((s) => s.objects);
  const revision = useSimulatorStore((s) => s.revision);
  const components = useLayoutStore((s) => s.components);

  const startDrag = useWireCreationStore((s) => s.startDrag);
  const updateDrag = useWireCreationStore((s) => s.updateDrag);
  const phase = useWireCreationStore((s) => s.phase);
  const sourceDirection = useWireCreationStore((s) => s.sourceDirection);
  const sourceComponentId = useWireCreationStore((s) => s.sourceComponentId);
  const sourcePortName = useWireCreationStore((s) => s.sourcePortName);
  const hoveredTargetPort = useWireCreationStore((s) => s.hoveredTargetPort);

  const showWiresAndPorts = useDisplayStore((s) => s.showWiresAndPorts);
  const isEditMode = useModeStore((s) => s.mode === "edit");
  const isProgramMode = useExecutionStore((s) => s.isProgramMode);
  const isEditableCanvas = isEditMode && !isProgramMode;

  const isCreating = phase === "dragging";

  // Get the component and its widget definition for port configuration
  const component = components.find((c) => c.id === componentId);
  const widgetDef = component ? getWidgetDefinition(component.type) : undefined;
  const portConfig = widgetDef?.portConfig;

  // Get ports from simulator object
  const ports = useMemo((): PortInfo[] => {
    const obj = objects.get(componentId);
    if (!obj || !("getPorts" in obj)) return [];

    const portMap = (obj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
    return Object.entries(portMap).map(([key, p]) => ({
      name: key,
      direction: p.direction as "input" | "output",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentId, objects, revision]);

  /** Build obstacle list (all components except source & target). */
  const buildObstacles = useCallback(
    (excludeId: string): AABB[] =>
      components
        .filter((c) => c.id !== excludeId)
        .map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
    [components],
  );

  const handleDragStart = useCallback(
    (
      compId: string,
      portName: string,
      direction: "input" | "output",
      portSide: PortSide,
    ) => {
      if (!isEditableCanvas) return;
      if (isCreating) return;

      const sourceComp = components.find((c) => c.id === compId);
      if (!sourceComp) return;

      const position = findPortPosition(
        sourceComp,
        portName,
        direction,
        ports,
        portConfig,
      );

      startDrag(
        {
          componentId: compId,
          portName,
          direction,
          position,
          portSide,
        },
        buildObstacles(compId),
      );
    },
    [isEditableCanvas, isCreating, components, ports, portConfig, startDrag, buildObstacles],
  );

  const handlePortHoverStart = useCallback(
    (
      compId: string,
      portName: string,
      direction: "input" | "output",
      portSide: PortSide,
    ) => {
      if (!isCreating) return;
      // Don't allow connecting to self (same port)
      if (compId === sourceComponentId && portName === sourcePortName) return;
      // Must be compatible direction
      if (direction === sourceDirection) return;

      const targetComp = components.find((c) => c.id === compId);
      if (!targetComp) return;

      const targetObj = objects.get(compId);
      if (!targetObj || !("getPorts" in targetObj)) return;

      const targetPortMap = (targetObj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
      const targetPorts = Object.entries(targetPortMap).map(([name, port]) => ({
        name,
        direction: port.direction as "input" | "output",
      }));

      const targetWidgetDef = getWidgetDefinition(targetComp.type);
      const targetPosition = findPortPosition(
        targetComp,
        portName,
        direction,
        targetPorts,
        targetWidgetDef?.portConfig,
      );

      const hovered: HoveredPort = {
        componentId: compId,
        portName,
        direction,
        position: targetPosition,
        portSide,
      };

      // Get current mouse position from the store to provide to updateDrag
      const currentMouse = useWireCreationStore.getState().mousePosition;
      if (currentMouse) {
        updateDrag(currentMouse, hovered);
      }
    },
    [isCreating, sourceComponentId, sourcePortName, sourceDirection, components, objects, updateDrag],
  );

  const handlePortHoverEnd = useCallback(() => {
    if (!isCreating) return;
    const currentMouse = useWireCreationStore.getState().mousePosition;
    if (currentMouse) {
      updateDrag(currentMouse, null);
    }
  }, [isCreating, updateDrag]);

  // Hide ports when wires are hidden
  if (!showWiresAndPorts) {
    return null;
  }

  return (
    <>
      {ports.map((port) => {
        const { side, offset } = getPortPlacement(port.name, port.direction, ports, portConfig);

        // During wire creation, check if this port is a valid drop target
        const isCompatibleTarget =
          isCreating &&
          port.direction !== sourceDirection &&
          !(componentId === sourceComponentId && port.name === sourcePortName);

        const isHovered =
          hoveredTargetPort?.componentId === componentId &&
          hoveredTargetPort?.portName === port.name;

        return (
          <PortIndicator
            key={`${port.direction}-${port.name}`}
            portName={port.name}
            direction={port.direction}
            componentId={componentId}
            position={side}
            offset={offset}
            portSide={side}
            isDropTarget={isCompatibleTarget}
            isHoveredTarget={isHovered}
            onDragStart={handleDragStart}
            onPortHoverStart={handlePortHoverStart}
            onPortHoverEnd={handlePortHoverEnd}
          />
        );
      })}
    </>
  );
}
