"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useLayoutStore, ComponentInstance } from "@/lib/store";
import React, { useState, useEffect } from "react";
import ConfigModal from "@/components/ConfigModal";
import PortIndicator from "@/components/PortIndicator";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useWireCreationStore } from "@/lib/wireCreationStore";

interface PortPosition {
  name: string;
  direction: "input" | "output";
  position: "left" | "right" | "top" | "bottom";
  offset: number;
}

interface Props {
  component: ComponentInstance;
  zoom: number;
  accentClass?: string;
  title?: string;
  children: React.ReactNode;
  portPositions?: PortPosition[];
}

export default function DraggableWidget({
  component,
  zoom,
  accentClass = "bg-indigo-700",
  title,
  children,
  portPositions = [],
}: Props) {
  const { id, x, y, w, h, label } = component;
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const [configOpen, setConfigOpen] = useState(false);
  const objects = useSimulatorStore((s) => s.objects);
  const createWire = useSimulatorStore((s) => s.createWire);
  const revision = useSimulatorStore((s) => s.revision);
  const startWireCreation = useWireCreationStore((s) => s.startWireCreation);
  const completeWireCreation = useWireCreationStore((s) => s.completeWireCreation);
  const isCreating = useWireCreationStore((s) => s.isCreating);
  const sourceComponentId = useWireCreationStore((s) => s.sourceComponentId);
  
  const [ports, setPorts] = useState<Array<{ name: string; direction: "input" | "output" }>>([]);

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

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });

  const correctedTransform = transform
    ? { ...transform, x: transform.x / zoom, y: transform.y / zoom }
    : null;

  const style: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    transform: CSS.Translate.toString(correctedTransform),
    zIndex: isDragging ? 50 : 10,
    touchAction: "none",
  };

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
        if (success && sourceComponentId) {
          const sourcePort = useWireCreationStore.getState().sourcePortName;
          if (sourcePort) {
            try {
              createWire(sourceComponentId, sourcePort, compId, portName);
            } catch (e) {
              console.error("Failed to create wire:", e);
            }
          }
        }
      }
    }
  };

  // Auto-generate port positions if not provided
  const effectivePortPositions = portPositions.length > 0 ? portPositions : 
    ports.map((port, idx) => ({
      name: port.name,
      direction: port.direction,
      position: (port.direction === "input" ? "left" : "right") as "left" | "right",
      offset: ports.filter(p => p.direction === port.direction).length > 1 
        ? ((idx % ports.filter(p => p.direction === port.direction).length) + 1) * (100 / (ports.filter(p => p.direction === port.direction).length + 1))
        : 50,
    }));

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        data-draggable
        className={`
          select-none rounded-xl border-2 flex flex-col overflow-hidden
          ${isDragging ? "border-indigo-400 shadow-2xl opacity-90" : "border-indigo-600 shadow-lg"}
          bg-gray-800 cursor-grab active:cursor-grabbing
        `}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setConfigOpen(true);
        }}
        onContextMenu={(e) => {
          // Let contextmenu bubble to PortTooltipWrapper; dnd-kit doesn't handle it
          e.stopPropagation();
        }}
      >
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
        
        {/* Render port indicators */}
        {effectivePortPositions.map((portPos) => (
          <PortIndicator
            key={portPos.name}
            portName={portPos.name}
            direction={portPos.direction}
            componentId={id}
            position={portPos.position}
            offset={portPos.offset}
            onPortClick={handlePortClick}
          />
        ))}
      </div>
      {configOpen && (
        <ConfigModal component={component} onClose={() => setConfigOpen(false)} />
      )}
    </>
  );
}
