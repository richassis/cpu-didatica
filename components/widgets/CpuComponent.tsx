"use client";

import { RotateCcw, Pause, Play } from "lucide-react";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum, type NumericBase } from "@/lib/displayStore";
import NodeShell from "@/components/widgets/NodeShell";
import FlagSquares from "@/components/widgets/FlagSquares";
import { CpuState, CONTROL_SIGNAL_DEFS } from "@/lib/simulator/Cpu";
import { CPU_STATE_LABELS } from "@/lib/simulator/CpuState";
import type { CPU } from "@/lib/simulator/Cpu";

/**
 * There used to be a private STATE_LABELS here in short form (WRREG2) next to
 * the canonical long form in CpuState.ts (WRITEREG2), so the same phase read
 * under two different names depending on where you looked. One name now.
 */
function stateLabel(state: CpuState): string {
  return CPU_STATE_LABELS[state] ?? "???";
}

/** Read every control-signal output port value from the CPU instance. */
function readSignals(cpu: CPU): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  const portMap = cpu.getPorts();
  for (const def of CONTROL_SIGNAL_DEFS) {
    const port = portMap[`out_${def.name}`];
    out[def.name] = port ? (port.value as number | boolean) : 0;
  }
  return out;
}

function formatSignal(value: number | boolean, bits: number, base: NumericBase): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  if (bits <= 1) return String(Number(value));
  return formatNum(Number(value), base, bits);
}

/**
 * The control unit.
 *
 * The only component with a dashed outline, and the only one entitled to it:
 * it is not part of the datapath, it commands it. It carries no clock notch —
 * the notch marks datapath storage.
 *
 * This component used to own two maps assigning a hue per CPU phase, eleven
 * hues in total against a budget of four. Both are gone. A phase is now an
 * outlined pill that takes the accent only while it is the current one, which
 * is the same rule every other state indicator follows.
 */
export default function CpuComponent({ component, zoom }: Props) {
  const { id } = component;

  const revision = useSimulatorStore((s) => s.revision);
  const cpu = useSimulatorStore((s) => s.getCpu(id));
  const pauseCpu = useSimulatorStore((s) => s.pauseCpu);
  const resetCpu = useSimulatorStore((s) => s.resetCpu);
  const base = useDisplayStore((s) => s.numericBase);
  void revision;

  const nextState = cpu ? (cpu.state as CpuState) : CpuState.FETCH;
  const currentState = cpu ? (cpu.previousState as CpuState) : CpuState.RESET;
  const halted = cpu ? cpu.halted : false;
  const paused = cpu ? cpu.paused : false;
  const signals = cpu ? readSignals(cpu) : {};

  const isOn = (name: string) => {
    const v = signals[name];
    return (typeof v === "boolean" ? (v ? 1 : 0) : (v ?? 0)) !== 0;
  };

  return (
    <NodeShell
      component={component}
      zoom={zoom}
      control
      state={halted ? "error" : undefined}
      value={
        <span className="flex flex-col items-center leading-none">
          <span className="font-mono text-[18px] font-medium">
            {paused ? "PAUSED" : halted ? "HALT" : stateLabel(currentState)}
          </span>
          {!paused && !halted && (
            <span className="mt-1 font-mono text-[10px] text-fg-faint">
              → {stateLabel(nextState)}
            </span>
          )}
        </span>
      }
      actions={
        <>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              resetCpu(id);
            }}
            className="shrink-0 rounded p-0.5 text-fg-faint transition-colors hover:text-fg"
            title="Reset CPU"
          >
            <RotateCcw size={12} strokeWidth={1.5} />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              pauseCpu(id, !paused);
            }}
            disabled={halted}
            className={`shrink-0 rounded p-0.5 transition-colors ${
              paused ? "text-st-warn" : "text-fg-faint hover:text-fg"
            } disabled:opacity-40`}
            title={paused ? "Resume CPU" : "Pause CPU"}
          >
            {paused ? <Play size={12} strokeWidth={1.5} /> : <Pause size={12} strokeWidth={1.5} />}
          </button>
        </>
      }
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line px-2 py-1">
        <span className="font-mono text-[10px] text-fg-faint">flags</span>
        <FlagSquares
          flags={[
            { label: "Z", on: !!cpu && cpu.in_flagZero.value !== 0, title: "Zero flag" },
            { label: "C", on: !!cpu && cpu.in_flagCarry.value !== 0, title: "Carry flag" },
            { label: "N", on: !!cpu && cpu.in_flagNegative.value !== 0, title: "Negative flag" },
          ]}
        />
      </div>

      {/* High-density signal list: name → value. An asserted signal is marked
          by a filled dot and full-strength text, not by a coloured row. */}
      <div className="flex-1 overflow-y-auto">
        {CONTROL_SIGNAL_DEFS.map((def) => {
          const active = isOn(def.name);
          return (
            <div
              key={def.name}
              className="flex items-center justify-between gap-1 px-2 py-[2px]"
            >
              <span className="w-20 shrink-0 truncate font-mono text-[11px] text-fg-faint">
                {def.name}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    active ? "bg-st-active" : "bg-line-strong"
                  }`}
                />
                <span
                  className={`num min-w-[1.75rem] text-right font-mono text-[11px] ${
                    active ? "text-fg" : "text-fg-faint"
                  }`}
                >
                  {formatSignal(signals[def.name] ?? 0, def.bitWidth, base)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </NodeShell>
  );
}
