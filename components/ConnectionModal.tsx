"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLayoutStore } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useProjectStore } from "@/lib/projectStore";

interface PortOption {
  name: string;
  direction: "input" | "output";
  dataType: string;
  bitWidth: number | null;
  connected?: boolean;
}

interface ComponentOption {
  id: string;
  label: string;
  type: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectionModal({ isOpen, onClose }: Props) {
  const components = useLayoutStore((s) => s.components);
  const objects = useSimulatorStore((s) => s.objects);
  const bus = useSimulatorStore((s) => s.bus);
  const createWire = useSimulatorStore((s) => s.createWire);
  const getWires = useSimulatorStore((s) => s.getWires);
  const addWireToProject = useProjectStore((s) => s.addWireToProject);
  const revision = useSimulatorStore((s) => s.revision);
  const wires = useMemo(() => getWires(), [getWires, revision]);

  // Selection state
  const [sourceComponentId, setSourceComponentId] = useState<string>("");
  const [sourcePortName, setSourcePortName] = useState<string>("");
  const [targetComponentId, setTargetComponentId] = useState<string>("");
  const [targetPortName, setTargetPortName] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSourceComponentId("");
      setSourcePortName("");
      setTargetComponentId("");
      setTargetPortName("");
      setError("");
    }
  }, [isOpen]);

  // Get components that have ports (are Connectable)
  const connectableComponents = useMemo((): ComponentOption[] => {
    return components
      .filter((c) => {
        const obj = objects.get(c.id);
        return obj && "getPorts" in obj;
      })
      .map((c) => ({
        id: c.id,
        label: c.label,
        type: c.type,
      }));
  }, [components, objects]);

  // Get ports for a component
  const getPortsForComponent = (componentId: string, direction: "input" | "output"): PortOption[] => {
    const obj = objects.get(componentId);
    if (!obj || !("getPorts" in obj)) return [];

    const portMap = (obj as { getPorts: () => Record<string, { name: string; direction: string; dataType: string; bitWidth: number | null }> }).getPorts();
    
    return Object.entries(portMap)
      .filter(([, p]) => p.direction === direction)
      .map(([key, p]) => {
        // Check if port is already connected (for inputs)
        const connected = direction === "input" && wires.some(
          (w) => w.targetComponentId === componentId && w.targetPortName === key
        );
        return {
          name: key,
          direction: p.direction as "input" | "output",
          dataType: p.dataType,
          bitWidth: p.bitWidth,
          connected,
        };
      });
  };

  const sourcePorts = useMemo(
    () => (sourceComponentId ? getPortsForComponent(sourceComponentId, "output") : []),
    [sourceComponentId, objects, wires]
  );

  const targetPorts = useMemo(
    () => (targetComponentId ? getPortsForComponent(targetComponentId, "input") : []),
    [targetComponentId, objects, wires]
  );

  // Filter target components (exclude source if same)
  const availableTargetComponents = useMemo(
    () => connectableComponents.filter((c) => c.id !== sourceComponentId || sourceComponentId === ""),
    [connectableComponents, sourceComponentId]
  );

  const handleCreate = () => {
    if (!sourceComponentId || !sourcePortName || !targetComponentId || !targetPortName) {
      setError("Please select all fields");
      return;
    }

    try {
      const wireId = createWire(sourceComponentId, sourcePortName, targetComponentId, targetPortName);
      if (wireId) {
        addWireToProject({
          id: wireId,
          sourceComponentId,
          sourcePortName,
          targetComponentId,
          targetPortName,
          label: "",
          visible: true,
          nodes: [],
        });
        onClose();
      } else {
        setError("Failed to create connection");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Create Connection
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Source Section */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-orange-400 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs">1</span>
              Source (Output)
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Component</label>
                <select
                  value={sourceComponentId}
                  onChange={(e) => {
                    setSourceComponentId(e.target.value);
                    setSourcePortName("");
                  }}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">Select component...</option>
                  {connectableComponents.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Output Port</label>
                <select
                  value={sourcePortName}
                  onChange={(e) => setSourcePortName(e.target.value)}
                  disabled={!sourceComponentId}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select port...</option>
                  {sourcePorts.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} ({p.dataType}{p.bitWidth ? `, ${p.bitWidth}b` : ""})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Arrow indicator */}
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          {/* Target Section */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-green-400 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs">2</span>
              Target (Input)
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Component</label>
                <select
                  value={targetComponentId}
                  onChange={(e) => {
                    setTargetComponentId(e.target.value);
                    setTargetPortName("");
                  }}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">Select component...</option>
                  {availableTargetComponents.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Input Port</label>
                <select
                  value={targetPortName}
                  onChange={(e) => setTargetPortName(e.target.value)}
                  disabled={!targetComponentId}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select port...</option>
                  {targetPorts.map((p) => (
                    <option key={p.name} value={p.name} disabled={p.connected}>
                      {p.name} ({p.dataType}{p.bitWidth ? `, ${p.bitWidth}b` : ""})
                      {p.connected ? " [connected]" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!sourceComponentId || !sourcePortName || !targetComponentId || !targetPortName}
            className="px-4 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Create Connection
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
