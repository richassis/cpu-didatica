"use client";

import { ComponentInstance } from "@/lib/store";
import { useEffect, useState } from "react";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
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
  const createWire = useSimulatorStore((s) => s.createWire);
  const revision = useSimulatorStore((s) => s.revision);
  const startWireCreation = useWireCreationStore((s) => s.startWireCreation);
  const completeWireCreation = useWireCreationStore((s) => s.completeWireCreation);
  const isCreating = useWireCreationStore((s) => s.isCreating);
  const sourceComponentId = useWireCreationStore((s) => s.sourceComponentId);
  const sourcePortName = useWireCreationStore((s) => s.sourcePortName);
  
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

  const handlePortClick = (compId: string, portName: string, direction: "input" | "output") => {
    if (!isCreating) {
      // Start wire creation
      if (direction === "output") {
        startWireCreation(compId, portName, direction);
      }
    } else {
      // Complete wire creation
      if (direction === "input" && sourceComponentId !== compId) {
        const success = completeWireCreation(compId, portName, direction);
        if (success && sourceComponentId && sourcePortName) {
          try {
            createWire(sourceComponentId, sourcePortName, compId, portName);
          } catch (e) {
            console.error("Failed to create wire:", e);
          }
        }
      }
    }
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
          onPortClick={handlePortClick}
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
          onPortClick={handlePortClick}
        />
      ))}
    </div>
  );
}
