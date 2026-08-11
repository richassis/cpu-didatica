"use client";

import { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSimulatorStore } from "@/lib/simulatorStore";

interface PortInfo {
  name: string;
  direction: "input" | "output";
  value: unknown;
  dataType: string;
  bitWidth: number | null;
}

interface Props {
  componentId: string;
  componentLabel: string;
  children: React.ReactNode;
}

export default function PortTooltipWrapper({ componentId, componentLabel, children }: Props) {
  const [visible, setVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objects = useSimulatorStore((s) => s.objects);
  const revision = useSimulatorStore((s) => s.revision);
  const ports = useMemo<PortInfo[]>(() => {
    void revision;
    const obj = objects.get(componentId);
    if (obj && "getPorts" in obj) {
      const portMap = (obj as { getPorts: () => Record<string, { name: string; direction: string; value: unknown; dataType: string; bitWidth: number | null }> }).getPorts();
      return Object.entries(portMap).map(([key, p]) => ({
        name: key,
        direction: p.direction as "input" | "output",
        value: p.value,
        dataType: p.dataType,
        bitWidth: p.bitWidth,
      }));
    }
    return [];
  }, [componentId, objects, revision]);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (ports.length === 0) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    // Offset tooltip so it doesn’t overlap the cursor
    setTooltipPos({ x: e.clientX + 16, y: e.clientY + 8 });
    setVisible(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!visible) return;
    setTooltipPos({ x: e.clientX + 16, y: e.clientY + 8 });
  };

  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setVisible(false), 120);
  };

  const inputPorts  = ports.filter((p) => p.direction === "input");
  const outputPorts = ports.filter((p) => p.direction === "output");

  const formatValue = (value: unknown): string => {
    if (typeof value === "number") return `0x${value.toString(16).toUpperCase().padStart(4, "0")}`;
    if (typeof value === "boolean") return value ? "1" : "0";
    return String(value);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="contents"
    >
      {children}

      {visible && ports.length > 0 && createPortal(
        <div
          className="fixed z-[100] pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="w-56 rounded-xl border border-line bg-surface">
            {/* Header */}
            <div className="border-b border-line px-3 py-1.5">
              <span className="text-xs font-semibold text-white truncate">{componentLabel}</span>
            </div>

            <div className="p-2 space-y-2">
              {/* Input Ports */}
              {inputPorts.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1 text-[11px] text-fg-muted">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                    Inputs
                  </div>
                  <div className="space-y-0.5">
                    {inputPorts.map((port) => (
                      <div key={port.name} className="flex items-center justify-between rounded px-2 py-0.5 text-[11px]">
                        <span className="font-mono text-fg-faint">{port.name}</span>
                        <span className="num font-mono text-fg">{formatValue(port.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Output Ports */}
              {outputPorts.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1 text-[11px] text-fg-muted">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                    Outputs
                  </div>
                  <div className="space-y-0.5">
                    {outputPorts.map((port) => (
                      <div key={port.name} className="flex items-center justify-between rounded px-2 py-0.5 text-[11px]">
                        <span className="font-mono text-fg-faint">{port.name}</span>
                        <span className="num font-mono text-fg">{formatValue(port.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
