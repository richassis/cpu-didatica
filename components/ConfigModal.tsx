"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLayoutStore, ComponentInstance } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { getWidgetDefinition } from "@/lib/widgetDefinitions";
import { ConfigPanelForType, ComponentConfig } from "@/components/widgets/ConfigPanel";
import { CpuState, CPU_STATE_LABELS, ALL_CPU_STATES, isClockable, Constant } from "@/lib/simulator";
import { Opcode, INSTRUCTION_SET } from "@/lib/simulator/ISA";
import { OPCODE_SEQUENCES } from "@/lib/simulator/Cpu";
import type { CPU } from "@/lib/simulator/Cpu";

interface Props {
  component: ComponentInstance;
  onClose: () => void;
}

/**
 * Config modal: label editing, manual port value overrides, animation step config, and wire management.
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
  const getComponentTickOrderByState = useSimulatorStore((s) => s.getComponentTickOrderByState);
  const setComponentTickOrderByState = useSimulatorStore((s) => s.setComponentTickOrderByState);
  const recreateObject = useSimulatorStore((s) => s.recreateObject);
  const getConstant = useSimulatorStore((s) => s.getConstant);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wires = useMemo(() => getWires(), [getWires, revision]);

  const [config, setConfig] = useState<ComponentConfig>({
    label:     component.label,
    bitWidth:  typeof component.meta?.bitWidth  === "number" ? component.meta.bitWidth  : undefined,
    numInputs: typeof component.meta?.numInputs === "number" ? component.meta.numInputs : undefined,
    wordCount: typeof component.meta?.wordCount === "number" ? component.meta.wordCount : undefined,
    hasWriteEnable: typeof component.meta?.hasWriteEnable === "boolean" ? component.meta.hasWriteEnable : undefined,
    holdOutputUntilFetch: typeof component.meta?.holdOutputUntilFetch === "boolean" ? component.meta.holdOutputUntilFetch : undefined,
    constantValue: typeof component.meta?.constantValue === "number" ? component.meta.constantValue : undefined,
    step: typeof component.meta?.step === "number" ? component.meta.step : undefined,
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
  // There used to be an early return here swapping the whole modal for the
  // InstructionBuilder. It compared against "InstructionMemory" while the
  // registered type is "InstructionMemoryComponent", so it never fired. Rather
  // than switch it on — which would make word count and bit width unreachable
  // for instruction memory — it is gone: the builder is reached by clicking a
  // row on the widget itself.
  
  // Animation step configuration (kept in tickSteps for backward compatibility)
  const currentTickSteps = useMemo(() => {
    void revision;
    return getComponentTickSteps(component.id) ?? [];
  }, [component.id, getComponentTickSteps, revision]);
  const [tickSteps, setTickSteps] = useState<CpuState[]>(currentTickSteps);
  const currentTickOrderByState = useMemo(() => {
    void revision;
    return getComponentTickOrderByState(component.id) ?? {};
  }, [component.id, getComponentTickOrderByState, revision]);
  const [tickOrderByState, setTickOrderByState] = useState<Partial<Record<CpuState, number>>>(currentTickOrderByState);
  
  // Update tickSteps when currentTickSteps changes
  useEffect(() => {
    setTickSteps(currentTickSteps);
  }, [currentTickSteps]);

  // Update tickOrderByState when currentTickOrderByState changes
  useEffect(() => {
    setTickOrderByState(currentTickOrderByState);
  }, [currentTickOrderByState]);
  
  const ports = useMemo(() => {
    void revision;
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

  const setTickOrderForState = (state: CpuState, rawValue: string) => {
    const trimmed = rawValue.trim();
    setTickOrderByState((prev) => {
      const next = { ...prev };
      if (trimmed === "") {
        delete next[state];
        return next;
      }

      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return prev;
      next[state] = Math.max(0, Math.floor(parsed));
      return next;
    });
  };

  const normalizeOrderMap = (orderMap: Partial<Record<CpuState, number>>): Partial<Record<CpuState, number>> => {
    const normalized: Partial<Record<CpuState, number>> = {};
    for (const [stateKey, rawOrder] of Object.entries(orderMap)) {
      const state = Number(stateKey) as CpuState;
      const parsed = Number(rawOrder);
      if (!Number.isFinite(parsed)) continue;
      normalized[state] = Math.max(0, Math.floor(parsed));
    }
    return normalized;
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
    const newLabel = config.label.trim() || (def?.label ?? component.type);
    updateLabel(component.id, newLabel);
    
    // Build meta object with any changed fields
    const meta: Record<string, unknown> = {};
    if (config.bitWidth  !== undefined) meta.bitWidth  = config.bitWidth;
    if (config.numInputs !== undefined) meta.numInputs = config.numInputs;
    if (config.wordCount !== undefined) meta.wordCount = config.wordCount;
    if (config.hasWriteEnable !== undefined) meta.hasWriteEnable = config.hasWriteEnable;
    if (config.holdOutputUntilFetch !== undefined) meta.holdOutputUntilFetch = config.holdOutputUntilFetch;
    if (config.constantValue !== undefined) meta.constantValue = config.constantValue;
    if (config.step !== undefined) meta.step = config.step;
    
    // Check if we need to recreate the object (when port structure changes)
    const currentNumInputs = component.meta?.numInputs;
    const currentHasWriteEnable =
      typeof component.meta?.hasWriteEnable === "boolean" ? component.meta.hasWriteEnable : true;
    const nextHasWriteEnable = config.hasWriteEnable ?? true;
    const currentHoldOutput =
      typeof component.meta?.holdOutputUntilFetch === "boolean"
        ? component.meta.holdOutputUntilFetch
        : false;
    const nextHoldOutput = config.holdOutputUntilFetch ?? false;

    const muxNeedsRecreate =
      component.type === "MuxComponent" &&
      config.numInputs !== undefined &&
      config.numInputs !== currentNumInputs;

    // `holdOutputUntilFetch` is fixed at construction time, so changing it needs
    // the same recreate path as a port-structure change.
    // `step` is fixed at construction time, like the Mux input count.
    const incrementerNeedsRecreate =
      component.type === "IncrementerComponent" &&
      config.step !== undefined &&
      config.step !== component.meta?.step;

    const registerNeedsRecreate =
      (component.type === "Register" || component.type === "PipelineRegister") &&
      (nextHasWriteEnable !== currentHasWriteEnable || nextHoldOutput !== currentHoldOutput);

    const needsRecreate = muxNeedsRecreate || registerNeedsRecreate || incrementerNeedsRecreate;
    
    if (needsRecreate) {
      // Recreate component when port structure changes.
      updateMeta(component.id, meta);
      recreateObject(component.id, component.type, newLabel, { ...component.meta, ...meta });
    } else if (Object.keys(meta).length > 0) {
      updateMeta(component.id, meta);

      // Keep Constant runtime output in sync without breaking existing wires.
      if (component.type === "ConstantComponent" && config.constantValue !== undefined) {
        const constant = getConstant(component.id);
        if (constant instanceof Constant) {
          constant.setConstantValue(config.constantValue);
          touch();
        }
      }
    }
    
    // Apply all pending port value changes (only if not recreated)
    if (!needsRecreate && isConnectable && Object.keys(portInputs).length > 0) {
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
    
    // Save animation step mask if it changed
    if (isClockableObj && JSON.stringify(tickSteps) !== JSON.stringify(currentTickSteps)) {
      setComponentTickSteps(component.id, tickSteps);
    }

    const normalizedCurrentOrder = normalizeOrderMap(currentTickOrderByState);
    const normalizedNewOrder = normalizeOrderMap(tickOrderByState);
    if (isClockableObj && JSON.stringify(normalizedNewOrder) !== JSON.stringify(normalizedCurrentOrder)) {
      setComponentTickOrderByState(component.id, normalizedNewOrder);
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex max-h-[90vh] w-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="t-panel text-fg">{def?.label ?? component.type}</h2>
            <p className="mt-0.5 font-mono text-[11px] text-fg-faint">
              id: {component.id.slice(0, 8)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-fg-muted transition-colors hover:text-fg"><X size={16} strokeWidth={1.5} /></button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Label / type config */}
          <div className="border-b border-line p-4">
            <ConfigPanelForType
              type={component.type}
              config={config}
              onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
            />
          </div>

          {/* ── Port value overrides ────────────────── */}
          {isConnectable && ports.length > 0 && (
            <div className="space-y-3 border-b border-line p-4">
              <h3 className="t-section">Port values</h3>

              {inputPorts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="mb-1 text-[11px] text-fg-muted">Inputs</div>
                  {inputPorts.map((port) => {
                    const key = port.name;
                    const inputVal = portInputs[key] ?? formatValue(port.value);
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate font-mono text-[11px] text-fg-muted">{key}</span>
                        <input
                          type="text"
                          value={inputVal}
                          onChange={(e) => setPortInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="num h-9 flex-1 rounded-lg border border-line bg-sunken px-2 font-mono text-[11px] text-fg focus:border-line-strong focus:outline-none"
                          placeholder={port.dataType === "boolean" ? "0 / 1" : "0x0000"}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {outputPorts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="mb-1 text-[11px] text-fg-muted">Outputs</div>
                  {outputPorts.map((port) => {
                    const key = port.name;
                    const inputVal = portInputs[key] ?? formatValue(port.value);
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate font-mono text-[11px] text-fg-muted">{key}</span>
                        <input
                          type="text"
                          value={inputVal}
                          onChange={(e) => setPortInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="num h-9 flex-1 rounded-lg border border-line bg-sunken px-2 font-mono text-[11px] text-fg focus:border-line-strong focus:outline-none"
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
            <div className="space-y-3 border-b border-line p-4">
              <h3 className="t-section">Testing mode</h3>
              <p className="text-[11px] text-fg-faint">
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
                className="h-9 w-full rounded-lg border border-line bg-sunken px-3 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none"
              >
                <option value="">Disable testing mode</option>
                {Object.entries(INSTRUCTION_SET).map(([mnemonic, descriptor]) => (
                  <option key={mnemonic} value={descriptor.opcode}>
                    {mnemonic} (0b{descriptor.opcode.toString(2).padStart(5, "0")})
                  </option>
                ))}
              </select>

              {/* Display selected instruction info */}
              {testingModeOpcode !== null && (
                <div className="space-y-2 rounded-lg border border-line p-3">
                  {(() => {
                    const selectedInstruction = Object.entries(INSTRUCTION_SET).find(([, descriptor]) => descriptor.opcode === testingModeOpcode);
                    if (!selectedInstruction) return null;

                    const [mnemonic, descriptor] = selectedInstruction;
                    const steps = OPCODE_SEQUENCES[testingModeOpcode] ?? [];
                    const isStandard = descriptor.format === "standard";

                    return (
                      <div key={mnemonic} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12px] text-fg">{mnemonic}</span>
                          <span className="num font-mono text-[11px] text-fg-faint">
                            0x{descriptor.opcode.toString(16).toUpperCase().padStart(2, "0")}
                          </span>
                        </div>

                        <p className="text-[11px] text-fg-muted">{descriptor.description}</p>

                        <div className="text-[11px] text-fg-faint">Format: {isStandard ? "Standard" : "ULA"}</div>

                        <div className="space-y-1">
                          <div className="t-section">Pipeline steps</div>
                          <div className="flex flex-wrap gap-1">
                            <span className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-fg-muted">
                              FETCH
                            </span>
                            <span className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-fg-muted">
                              DECODE
                            </span>

                            {steps.length > 0 ? (
                              steps.map((state, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-fg-muted"
                                >
                                  {CPU_STATE_LABELS[state] || `STATE_${state}`}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] italic text-fg-faint">no extra steps</span>
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

          {/* ── Animation Steps Configuration ────────────────── */}
          {isClockableObj && component.type !== "CpuComponent" && (
            <div className="space-y-3 border-b border-line p-4">
              <div className="flex items-center justify-between">
                <h3 className="t-section">Animation steps</h3>
                <button
                  onClick={handleTickComponent}
                  className="rounded-lg border border-line px-2 py-1 text-[11px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
                  title="Manually tick this component"
                >
                  Tick Now
                </button>
              </div>
              <p className="text-[11px] text-fg-faint">
                Select which CPU states animate this component's wires. Functional execution runs every CPU tick.
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {ALL_CPU_STATES.map((state) => {
                  const isActive = tickSteps.includes(state);
                  return (
                    <button
                      key={state}
                      onClick={() => toggleTickStep(state)}
                      className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
                        isActive
                          ? "border-st-active text-st-active"
                          : "border-line text-fg-faint hover:border-line-strong hover:text-fg"
                      }`}
                    >
                      {CPU_STATE_LABELS[state]}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2 border-t border-line pt-2">
                <h4 className="t-section">Animation substep order</h4>
                <p className="text-[11px] text-fg-faint">
                  Lower values animate earlier inside the same CPU state. Leave blank to use default order (0).
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_CPU_STATES.map((state) => {
                    const value = tickOrderByState[state];
                    return (
                      <label key={`order-${state}`} className="flex flex-col gap-1">
                        <span className="font-mono text-[11px] text-fg-muted">{CPU_STATE_LABELS[state]}</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={value ?? ""}
                          onChange={(e) => setTickOrderForState(state, e.target.value)}
                          className="num h-9 rounded-lg border border-line bg-sunken px-2 font-mono text-[11px] text-fg focus:border-line-strong focus:outline-none"
                          placeholder="0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Wire connections ────────────────────── */}
          {isConnectable && (
            <div className="p-4 space-y-2">
              <h3 className="t-section">
                Connections{" "}
                {componentWires.length > 0 && (
                  <span className="text-fg-faint">({componentWires.length})</span>
                )}
              </h3>
              {componentWires.length === 0 ? (
                <p className="text-[11px] italic text-fg-faint">No connections</p>
              ) : (
                <div className="space-y-1">
                  {componentWires.map((wire) => {
                    const isSource = wire.sourceComponentId === component.id;
                    return (
                      <div key={wire.id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-[11px]">
                        {/* Source side */}
                        <span className={`truncate font-mono ${isSource ? "text-fg" : "text-fg-muted"}`}>
                          {labelFor(wire.sourceComponentId)}.{wire.sourcePortName}
                        </span>
                        <svg className="h-3 w-3 shrink-0 text-fg-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        {/* Target side */}
                        <span className={`flex-1 truncate font-mono ${!isSource ? "text-fg" : "text-fg-muted"}`}>
                          {labelFor(wire.targetComponentId)}.{wire.targetPortName}
                        </span>
                        {/* Remove button */}
                        <button
                          onClick={() => removeWire(wire.id)}
                          className="ml-1 shrink-0 leading-none text-st-error transition-colors hover:opacity-70"
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
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-4 py-3">
          <button
            onClick={() => { removeComponent(component.id); onClose(); }}
            className="rounded-lg border border-st-error px-3 py-1.5 text-xs text-st-error transition-colors hover:bg-st-error/10"
          >
            Remove component
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-xs text-fg transition-colors hover:border-st-active"
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
