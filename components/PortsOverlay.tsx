"use client";

import { useEffect, useState } from "react";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";
import { useEnhancedWireStore } from "@/lib/enhancedWireStore";
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
  const createWire = useSimulatorStore((s) => s.createWire);
  const revision = useSimulatorStore((s) => s.revision);
  const startWireCreation = useWireCreationStore((s) => s.startWireCreation);
  const completeWireCreation = useWireCreationStore((s) => s.completeWireCreation);
  const isCreating = useWireCreationStore((s) => s.isCreating);
  const sourceComponentId = useWireCreationStore((s) => s.sourceComponentId);
  const sourcePortName = useWireCreationStore((s) => s.sourcePortName);
  
  // Enhanced wire store
  const addWire = useEnhancedWireStore((s) => s.addWire);
  const addWireTarget = useEnhancedWireStore((s) => s.addWireTarget);
  const wires = useEnhancedWireStore((s) => s.wires);
  
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

  const handlePortClick = (compId: string, portName: string, direction: "input" | "output") => {
    if (!isCreating) {
      // Start wire creation
      if (direction === "output") {
        startWireCreation(compId, portName, direction);
      }
    } else {
      // Complete wire creation
      if (direction === "input" && sourceComponentId !== compId && sourcePortName) {
        const success = completeWireCreation(compId, portName, direction);
        if (success && sourceComponentId) {
          try {
            // Check if there's already a wire from this source
            const existingWire = wires.find(
              (w) => w.source.componentId === sourceComponentId && w.source.portName === sourcePortName
            );
            
            if (existingWire) {
              // Add as another target to existing wire (bifurcation)
              addWireTarget(existingWire.id, compId, portName);
            } else {
              // Create new wire
              const wireId = addWire(sourceComponentId, sourcePortName, compId, portName);
              
              // Also create in simulator store for backwards compatibility
              createWire(sourceComponentId, sourcePortName, compId, portName);
            }
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
          onPortClick={handlePortClick}
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
          onPortClick={handlePortClick}
        />
      ))}
    </>
  );
}
