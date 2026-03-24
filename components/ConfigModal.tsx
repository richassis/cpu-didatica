"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLayoutStore, ComponentInstance } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { getWidgetDefinition } from "@/lib/widgetDefinitions";
import { ConfigPanelForType, ComponentConfig } from "@/components/widgets/ConfigPanel";
import { CpuState, CPU_STATE_LABELS, ALL_CPU_STATES, isClockable } from "@/lib/simulator";
import { Opcode, INSTRUCTION_SET } from "@/lib/simulator/ISA";
import { OPCODE_SEQUENCES } from "@/lib/simulator/Cpu";
import type { CPU } from "@/lib/simulator/Cpu";

interface Props {
  component: ComponentInstance;
  onClose: () => void;
}

/**
 * Config modal: label editing, manual port value overrides, tick step config, and wire management.
 */
export default function ConfigModal({ component, onClose }: Props) {
  const updateLabel = useLayoutStore((s) => s.updateLabel);
  const updateMeta  = useLayoutStore((s) => s.updateMeta);
  const removeComponent = useLayoutStore((s) => s.removeComponent);
  const layoutComponents = useLayoutStore((s) => s.components);
  const def = getWidgetDefinition(component.type);

  const objects   = useSimulatorStore((s) => s.objects);
  const removeWire = useSimulatorStore((s) => s.removeWire);
  const getWires  = useSimulatorStore((s) => s.getWires);
  const revision  = useSimulatorStore((s) => s.revision);
  const touch     = useSimulatorStore((s) => s.touch);
  const tickSingleComponent = useSimulatorStore((s) => s.tickSingleComponent);
  const getComponentTickSteps = useSimulatorStore((s) => s.getComponentTickSteps);
  const setComponentTickSteps = useSimulatorStore((s) => s.setComponentTickSteps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wires = useMemo(() => getWires(), [getWires, revision]);

  const [config, setConfig] = useState<ComponentConfig>({
    label:     component.label,
    bitWidth:  typeof component.meta?.bitWidth  === "number" ? component.meta.bitWidth  : undefined,
    numInputs: typeof component.meta?.numInputs === "number" ? component.meta.numInputs : undefined,
    wordCount: typeof component.meta?.wordCount === "number" ? component.meta.wordCount : undefined,
  });
  // portInputs: map portName → current text being typed
  const [portInputs, setPortInputs] = useState<Record<string, string>>({});
  
  // CPU testing mode: opcode to force set and keep
  const [testingModeOpcode, setTestingModeOpcode] = useState<Opcode | null>(null);

  const obj = objects.get(component.id);
  const isConnectable = obj && "getPorts" in obj;
  const isClockableObj = obj && isClockable(obj);
  const isCpu = component.type === "CpuComponent";
  const cpu = isCpu ? (obj as CPU | undefined) : undefined;
  
  // Tick steps configuration
  const currentTickSteps = useMemo(() => getComponentTickSteps(component.id) ?? [], [component.id, getComponentTickSteps, revision]);
  const [tickSteps, setTickSteps] = useState<CpuState[]>(currentTickSteps);
  
  // Update tickSteps when currentTickSteps changes
  useEffect(() => {
    setTickSteps(currentTickSteps);
  }, [currentTickSteps]);
  
  const ports = useMemo(() => {
    if (!isConnectable) return [];
    const portMap = (obj as { getPorts: () => Record<string, { name: string; direction: string; value: unknown; dataType: string; bitWidth: number | null }> }).getPorts();
    // Use the map KEY (not port.name) so lookups in applyPortValue and Bus stay consistent.
    // Read .value explicitly — it's a getter on the prototype, so spreading loses it.
    return Object.entries(portMap).map(([key, p]) => ({
      name:      key,
      direction: p.direction,
      value:     p.value,
      dataType:  p.dataType,
      bitWidth:  p.bitWidth,
    }));
  }, [isConnectable, obj, revision]);

  // Wires this component participates in
  const componentWires = useMemo(
    () => wires.filter((w) => w.sourceComponentId === component.id || w.targetComponentId === component.id),
    [wires, component.id]
  );

  // Helper: label for a component id
  const labelFor = (id: string) => layoutComponents.find((c) => c.id === id)?.label ?? id.slice(0, 8);
  
  // Toggle a tick step
  const toggleTickStep = (state: CpuState) => {
    setTickSteps((prev) =>
      prev.includes(state)
        ? prev.filter((s) => s !== state)
        : [...prev, state].sort((a, b) => a - b)
    );
  };

  // Sync testing mode from CPU when modal is opened for this component
  useEffect(() => {
    if (isCpu && cpu) {
      const currentOpcode = cpu.getTestingModeOpcode();
      setTestingModeOpcode(currentOpcode);
    }
  }, [isCpu, cpu, component.id]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = () => {
    updateLabel(component.id, config.label.trim() || (def?.label ?? component.type));
    // Persist any meta fields (bitWidth, numInputs, wordCount) that were changed
    const meta: Record<string, unknown> = {};
    if (config.bitWidth  !== undefined) meta.bitWidth  = config.bitWidth;
    if (config.numInputs !== undefined) meta.numInputs = config.numInputs;
    if (config.wordCount !== undefined) meta.wordCount = config.wordCount;
    if (Object.keys(meta).length > 0) updateMeta(component.id, meta);
    
    // Apply all pending port value changes
    if (isConnectable && Object.keys(portInputs).length > 0) {
      for (const [portName, rawText] of Object.entries(portInputs)) {
        const port = ports.find(p => p.name === portName);
        if (port) {
          applyPortValue(portName, rawText, port.dataType);
        }
      }
    }
    
    // Apply CPU testing mode if set
    if (isCpu && cpu) {
      cpu.setTestingModeOpcode(testingModeOpcode);
      touch();
    }
    
    // Save tick steps if they changed
    if (isClockableObj && JSON.stringify(tickSteps) !== JSON.stringify(currentTickSteps)) {
      setComponentTickSteps(component.id, tickSteps);
    }
    
    onClose();
  };
  
  const handleTickComponent = () => {
    tickSingleComponent(component.id);
  };

  // CPU Testing Mode: set opcode and keep it
  const handleSetTestingOpcode = (opcode: Opcode) => {
    setTestingModeOpcode(opcode);
  };

  /** Apply a typed value to the port directly */
  const applyPortValue = (portName: string, rawText: string, dataType: string) => {
    if (!isConnectable) return;
    const portMap = (obj as unknown as { getPorts: () => Record<string, { set: (v: unknown) => void; direction: string; dataType: string }> }).getPorts();
    const port = portMap[portName];
    if (!port) return;

    let parsed: unknown;
    if (dataType === "boolean") {
      parsed = rawText.trim() === "1" || rawText.trim().toLowerCase() === "true";
    } else {
      // Accept decimal or 0x hex
      const n = rawText.trim().startsWith("0x")
        ? parseInt(rawText.trim(), 16)
        : parseInt(rawText.trim(), 10);
      if (isNaN(n)) return;
      parsed = n;
    }

    port.set(parsed);
    touch();
  };

  const formatValue = (value: unknown): string => {
    if (typeof value === "number") return `0x${value.toString(16).toUpperCase().padStart(4, "0")}`;
    if (typeof value === "boolean") return value ? "1" : "0";
    return String(value);
  };

  const inputPorts  = ports.filter((p) => p.direction === "input");
  const outputPorts = ports.filter((p) => p.direction === "output");

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-96 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">
              {def?.icon} {def?.label ?? component.type}
            </h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
              id: {component.id.slice(0, 8)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Label / type config */}
          <div className="p-4 border-b border-gray-800">
            <ConfigPanelForType
              type={component.type}
              config={config}
              onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
            />
          </div>

          {/* ── Port value overrides ────────────────── */}
          {isConnectable && ports.length > 0 && (
            <div className="p-4 border-b border-gray-800 space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Port Values</h3>

              {inputPorts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold text-green-400 mb-1">Inputs</div>
                  {inputPorts.map((port) => {
                    const key = port.name;
                    const inputVal = portInputs[key] ?? formatValue(port.value);
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-gray-300 w-24 truncate shrink-0">{key}</span>
                        <input
                          type="text"
                          value={inputVal}
                          onChange={(e) => setPortInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-[10px] font-mono text-cyan-200 focus:border-cyan-500 focus:outline-none"
                          placeholder={port.dataType === "boolean" ? "0 / 1" : "0x0000"}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {outputPorts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold text-orange-400 mb-1">Outputs</div>
                  {outputPorts.map((port) => {
                    const key = port.name;
                    const inputVal = portInputs[key] ?? formatValue(port.value);
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-gray-300 w-24 truncate shrink-0">{key}</span>
                        <input
                          type="text"
                          value={inputVal}
                          onChange={(e) => setPortInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-[10px] font-mono text-purple-200 focus:border-purple-500 focus:outline-none"
                          placeholder={port.dataType === "boolean" ? "0 / 1" : "0x0000"}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── CPU Testing Mode ────────────────────────── */}
          {isCpu && (
            <div className="p-4 border-b border-gray-800 space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Testing Mode</h3>
              <p className="text-[10px] text-gray-500">
                Select an instruction to force the CPU in_opcode port and keep it set.
              </p>
              
              {/* Opcode selector dropdown */}
              <select
                value={testingModeOpcode ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const opcode = val ? (Number(val) as Opcode) : null;
                  if (opcode !== null) {
                    handleSetTestingOpcode(opcode);
                  } else {
                    setTestingModeOpcode(null);
                  }
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">-- Disable Testing Mode --</option>
                {Object.entries(INSTRUCTION_SET).map(([mnemonic, descriptor]) => (
                  <option key={mnemonic} value={descriptor.opcode}>
                    {mnemonic} (0b{descriptor.opcode.toString(2).padStart(5, "0")})
                  </option>
                ))}
              </select>

              {/* Display selected instruction info */}
              {testingModeOpcode !== null && (
                <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                  {(() => {
                    const selectedInstruction = Object.entries(INSTRUCTION_SET).find(([, descriptor]) => descriptor.opcode === testingModeOpcode);
                    if (!selectedInstruction) return null;

                    const [mnemonic, descriptor] = selectedInstruction;
                    const steps = OPCODE_SEQUENCES[testingModeOpcode] ?? [];
                    const isStandard = descriptor.format === "standard";

                    return (
                      <div key={mnemonic} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-indigo-300">{mnemonic}</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            0x{descriptor.opcode.toString(16).toUpperCase().padStart(2, "0")}
                          </span>
                        </div>

                        <p className="text-[10px] text-gray-400">{descriptor.description}</p>

                        <div className="text-[10px] text-gray-500">
                          <span className="font-semibold">Format:</span> {isStandard ? "Standard" : "ULA"}
                        </div>

                        <div className="space-y-1">
                          <div className="text-[10px] font-semibold text-cyan-400">Pipeline Steps:</div>
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[9px] px-2 py-1 rounded bg-indigo-900/60 border border-indigo-600 text-indigo-200 font-mono">
                              FETCH
                            </span>
                            <span className="text-[9px] px-2 py-1 rounded bg-purple-900/60 border border-purple-600 text-purple-200 font-mono">
                              DECODE
                            </span>

                            {steps.length > 0 ? (
                              steps.map((state, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] px-2 py-1 rounded bg-cyan-900/60 border border-cyan-600 text-cyan-200 font-mono"
                                >
                                  {CPU_STATE_LABELS[state] || `STATE_${state}`}
                                </span>
                              ))
                            ) : (
                              <span className="text-[9px] text-gray-500 italic">no extra steps</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ── Tick Steps Configuration ────────────────── */}
          {isClockableObj && component.type !== "CpuComponent" && (
            <div className="p-4 border-b border-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tick Steps</h3>
                <button
                  onClick={handleTickComponent}
                  className="text-[10px] px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                  title="Manually tick this component"
                >
                  Tick Now
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                Select which CPU states trigger this component to tick.
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {ALL_CPU_STATES.map((state) => {
                  const isActive = tickSteps.includes(state);
                  return (
                    <button
                      key={state}
                      onClick={() => toggleTickStep(state)}
                      className={`px-2 py-1 rounded text-[9px] font-mono font-semibold transition-colors ${
                        isActive
                          ? "bg-cyan-600 text-white"
                          : "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
                      }`}
                    >
                      {CPU_STATE_LABELS[state]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Wire connections ────────────────────── */}
          {isConnectable && (
            <div className="p-4 space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Connections {componentWires.length > 0 && <span className="text-gray-600 normal-case font-normal">({componentWires.length})</span>}
              </h3>
              {componentWires.length === 0 ? (
                <p className="text-[10px] text-gray-600 italic">No connections</p>
              ) : (
                <div className="space-y-1">
                  {componentWires.map((wire) => {
                    const isSource = wire.sourceComponentId === component.id;
                    return (
                      <div key={wire.id} className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1.5 text-[10px]">
                        {/* Source side */}
                        <span className={`font-mono truncate ${isSource ? "text-orange-300 font-semibold" : "text-gray-400"}`}>
                          {labelFor(wire.sourceComponentId)}.{wire.sourcePortName}
                        </span>
                        <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        {/* Target side */}
                        <span className={`font-mono truncate flex-1 ${!isSource ? "text-cyan-300 font-semibold" : "text-gray-400"}`}>
                          {labelFor(wire.targetComponentId)}.{wire.targetPortName}
                        </span>
                        {/* Remove button */}
                        <button
                          onClick={() => removeWire(wire.id)}
                          className="text-red-500 hover:text-red-400 leading-none shrink-0 ml-1"
                          aria-label="Remove connection"
                          title="Remove connection"
                        >✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={() => { removeComponent(component.id); onClose(); }}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Remove component
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
