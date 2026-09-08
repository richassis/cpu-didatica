"use client";

import { RotateCcw, Pause, Play } from "lucide-react";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum, type NumericBase } from "@/lib/displayStore";
import NodeShell from "@/components/widgets/NodeShell";
import CpuFsmGraph from "@/components/widgets/CpuFsmGraph";
import FlagSquares from "@/components/widgets/FlagSquares";
import { CpuState, CONTROL_SIGNAL_DEFS } from "@/lib/simulator/Cpu";
import type { CPU } from "@/lib/simulator/Cpu";

/**
 * The 10 control-signal outputs, in the order the CPU class declares them —
 * this is also the order `getPortOffset` walks when it auto-places the bottom
 * ports (nothing here overrides `offset` in the widget definition), so a
 * signal's index in this array is its index among the bottom ports too. The
 * strip below reuses that same `(i + 1) / (n + 1)` formula so its dots land
 * under the real port dots without having to measure anything.
 */
const BOTTOM_SIGNAL_ORDER = [
  "muxPC", "wrPC", "wrIR", "rdMem", "wrMem",
  "muxAReg", "muxDReg", "wrReg", "opULA", "muxAMem",
] as const;

const SIGNAL_BITS = Object.fromEntries(CONTROL_SIGNAL_DEFS.map((d) => [d.name, d.bitWidth]));

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
 * A wide, short block rather than the old tall one: the FSM graph reads left
 * to right (FETCH → DECODE → the chosen branch), so the shape follows the
 * content instead of fighting it. The old state headline and the row-per-
 * signal list are both gone — the graph shows the phase, and the signal strip
 * along the bottom edge shows each control line right next to the port it
 * actually drives, instead of in a list disconnected from the wiring.
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
  const opcode = cpu ? Number(cpu.in_opcode.value) : 0;
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
      dense
      state={halted ? "error" : undefined}
      actions={
        <>
          {paused && (
            <span className="shrink-0 rounded-md border border-st-warn px-1.5 py-0.5 font-mono text-[10px] text-st-warn">
              PAUSED
            </span>
          )}
          <FlagSquares
            flags={[
              { label: "Z", on: !!cpu && cpu.latchedFlagZero, title: "Zero flag" },
              { label: "C", on: !!cpu && cpu.latchedFlagCarry, title: "Carry flag" },
              { label: "N", on: !!cpu && cpu.latchedFlagNegative, title: "Negative flag" },
            ]}
          />
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
      <div className="min-h-0 flex-1 px-2 pt-1">
        <CpuFsmGraph
          currentState={currentState}
          nextState={nextState}
          opcode={opcode}
          halted={halted}
        />
      </div>

      {/* Signal strip: one dot per bottom control port, positioned with the
          same (i+1)/(n+1) formula the port itself is auto-placed with, so a
          dot sits directly under its port regardless of the node's width. */}
      <div className="relative h-11 shrink-0 border-t border-line">
        {BOTTOM_SIGNAL_ORDER.map((name, i) => {
          const active = isOn(name);
          const left = ((i + 1) / (BOTTOM_SIGNAL_ORDER.length + 1)) * 100;
          return (
            <div
              key={name}
              className="absolute top-1 flex -translate-x-1/2 flex-col items-center gap-0.5"
              style={{ left: `${left}%` }}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  active ? "bg-st-active" : "bg-line-strong"
                }`}
              />
              <span className={`font-mono text-[11px] leading-none ${active ? "text-fg" : "text-fg-faint"}`}>
                {name}
              </span>
              <span
                className={`num font-mono text-[12.5px] leading-none ${active ? "text-fg" : "text-fg-faint"}`}
              >
                {formatSignal(signals[name] ?? 0, SIGNAL_BITS[name] ?? 1, base)}
              </span>
            </div>
          );
        })}
      </div>
    </NodeShell>
  );
}
