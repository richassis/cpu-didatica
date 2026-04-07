"use client";

import { useEffect, useState } from "react";
import { useLayoutStore } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useDisplayStore } from "@/lib/displayStore";
import { useModeStore } from "@/lib/modeStore";
import { getWidgetDefinition } from "@/lib/widgetDefinitions";
import { findPortPosition, getPortPlacement } from "@/lib/portPositioning";
import PortIndicator from "./PortIndicator";

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
  const startWireCreation = useWireCreationStore((s) => s.startWireCreation);
  const isCreating = useWireCreationStore((s) => s.isCreating);
  const showWiresAndPorts = useDisplayStore((s) => s.showWiresAndPorts);
  const isEditMode = useModeStore((s) => s.mode === "edit");

  const [ports, setPorts] = useState<PortInfo[]>([]);

  // Get the component and its widget definition for port configuration
  const component = components.find((c) => c.id === componentId);
  const widgetDef = component ? getWidgetDefinition(component.type) : undefined;
  const portConfig = widgetDef?.portConfig;

  // Get ports from simulator object
  useEffect(() => {
    const obj = objects.get(componentId);
    if (obj && "getPorts" in obj) {
      const portMap = (obj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
      setPorts(
        Object.entries(portMap).map(([key, p]) => ({
          name: key,
          direction: p.direction as "input" | "output",
        }))
      );
    }
  }, [componentId, objects, revision]);

  const handlePortPointerDown = (
    compId: string,
    portName: string,
    direction: "input" | "output",
    event: React.PointerEvent,
  ) => {
    if (event.button !== 0) return;
    if (isCreating) return;
    // Block wire creation in simulation mode
    if (!isEditMode) return;

    const sourceComp = components.find((component) => component.id === compId);
    const sourceObj = objects.get(compId);
    if (!sourceComp || !sourceObj || !("getPorts" in sourceObj)) return;

    const sourcePortMap = (sourceObj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
    const sourcePorts = Object.entries(sourcePortMap).map(([name, port]) => ({
      name,
      direction: port.direction as "input" | "output",
    }));

    const sourceWidgetDef = getWidgetDefinition(sourceComp.type);
    const sourcePortConfig = sourceWidgetDef?.portConfig;
    const startPosition = findPortPosition(sourceComp, portName, direction, sourcePorts, sourcePortConfig);

    startWireCreation(compId, portName, direction, startPosition);
  };

  // Hide ports when wires are hidden
  if (!showWiresAndPorts) {
    return null;
  }

  return (
    <>
      {ports.map((port) => {
        const { side, offset } = getPortPlacement(port.name, port.direction, ports, portConfig);

        return (
          <PortIndicator
            key={`${port.direction}-${port.name}`}
            portName={port.name}
            direction={port.direction}
            componentId={componentId}
            position={side}
            offset={offset}
            onPortPointerDown={handlePortPointerDown}
          />
        );
      })}
    </>
  );
}
