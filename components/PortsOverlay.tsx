"use client";

import { useEffect, useState } from "react";
import { useLayoutStore } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useDisplayStore } from "@/lib/displayStore";
import { findPortPosition } from "@/lib/portPositioning";
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

  const [ports, setPorts] = useState<PortInfo[]>([]);

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

    const sourceComp = components.find((component) => component.id === compId);
    const sourceObj = objects.get(compId);
    if (!sourceComp || !sourceObj || !("getPorts" in sourceObj)) return;

    const sourcePortMap = (sourceObj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
    const sourcePorts = Object.entries(sourcePortMap).map(([name, port]) => ({
      name,
      direction: port.direction as "input" | "output",
    }));

    const startPosition = findPortPosition(sourceComp, portName, direction, sourcePorts);

    startWireCreation(compId, portName, direction, startPosition);
  };

  // Hide ports when wires are hidden
  if (!showWiresAndPorts) {
    return null;
  }

  // Calculate port positions
  const inputPorts = ports.filter(p => p.direction === "input");
  const outputPorts = ports.filter(p => p.direction === "output");

  const getPortOffset = (index: number, total: number) => {
    if (total === 1) return 50;
    return ((index + 1) * 100) / (total + 1);
  };

  return (
    <>
      {/* Render input ports on the left */}
      {inputPorts.map((port, idx) => (
        <PortIndicator
          key={`in-${port.name}`}
          portName={port.name}
          direction="input"
          componentId={componentId}
          position="left"
          offset={getPortOffset(idx, inputPorts.length)}
          onPortPointerDown={handlePortPointerDown}
        />
      ))}
      
      {/* Render output ports on the right */}
      {outputPorts.map((port, idx) => (
        <PortIndicator
          key={`out-${port.name}`}
          portName={port.name}
          direction="output"
          componentId={componentId}
          position="right"
          offset={getPortOffset(idx, outputPorts.length)}
          onPortPointerDown={handlePortPointerDown}
        />
      ))}
    </>
  );
}
