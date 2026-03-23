"use client";

import { ComponentInstance } from "@/lib/store";
import { useEffect, useState } from "react";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { findPortPosition } from "@/lib/portPositioning";
import PortIndicator from "./PortIndicator";

interface Props {
  component: ComponentInstance;
  children: React.ReactNode;
}

interface PortInfo {
  name: string;
  direction: "input" | "output";
}

export default function WidgetWithPorts({ component, children }: Props) {
  const { id } = component;
  const objects = useSimulatorStore((s) => s.objects);
  const revision = useSimulatorStore((s) => s.revision);
  const startWireCreation = useWireCreationStore((s) => s.startWireCreation);
  const isCreating = useWireCreationStore((s) => s.isCreating);
  
  const [ports, setPorts] = useState<PortInfo[]>([]);

  // Get ports from simulator object
  useEffect(() => {
    const obj = objects.get(id);
    if (obj && "getPorts" in obj) {
      const portMap = (obj as { getPorts: () => Record<string, { direction: string }> }).getPorts();
      setPorts(
        Object.entries(portMap).map(([key, p]) => ({
          name: key,
          direction: p.direction as "input" | "output",
        }))
      );
    }
  }, [id, objects, revision]);

  const handlePortPointerDown = (
    compId: string,
    portName: string,
    direction: "input" | "output",
    event: React.PointerEvent,
  ) => {
    if (event.button !== 0 || isCreating) return;
    const startPosition = findPortPosition(component, portName, direction, ports);
    startWireCreation(compId, portName, direction, startPosition);
  };

  // Calculate port positions
  const inputPorts = ports.filter(p => p.direction === "input");
  const outputPorts = ports.filter(p => p.direction === "output");

  const getPortOffset = (index: number, total: number) => {
    if (total === 1) return 50;
    return ((index + 1) * 100) / (total + 1);
  };

  return (
    <div className="contents">
      {children}
      
      {/* Render input ports on the left */}
      {inputPorts.map((port, idx) => (
        <PortIndicator
          key={`in-${port.name}`}
          portName={port.name}
          direction="input"
          componentId={id}
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
          componentId={id}
          position="right"
          offset={getPortOffset(idx, outputPorts.length)}
          onPortPointerDown={handlePortPointerDown}
        />
      ))}
    </div>
  );
}
