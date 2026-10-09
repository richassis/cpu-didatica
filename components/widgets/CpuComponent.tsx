"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum, type NumericBase } from "@/lib/displayStore";
import NodeShell from "@/components/widgets/NodeShell";
import CpuFsmGraph from "@/components/widgets/CpuFsmGraph";
import FlagSquares, { flagSpecs } from "@/components/widgets/FlagSquares";
import { CpuState, CONTROL_SIGNAL_DEFS } from "@/lib/simulator/Cpu";
import { CPU_SIDE_INPUT_OFFSET } from "@/lib/widgetDefinitions";

function formatSignal(value: number, bits: number, base: NumericBase): string {
  if (bits <= 1) return String(Number(value));
  // Every control line is unsigned, whatever the base.
  return formatNum(Number(value), base === "decSigned" ? "dec" : base, bits);
}

/**
 * The control unit.
 *
 * The only component with a dashed outline, and the only one entitled to it:
 * it is not part of the datapath, it commands it.
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
  const base = useDisplayStore((s) => s.numericBase);
  void revision;

  const nextState = cpu ? (cpu.state as CpuState) : CpuState.FETCH;
  const currentState = cpu ? (cpu.previousState as CpuState) : CpuState.RESET;
  const opcode = cpu ? Number(cpu.in_opcode.value) : 0;
  const halted = cpu ? cpu.halted : false;
  // A dot lights when the executed state writes that signal — even to 0, and
  // even when the value doesn't change. The value printed under it tells which.
  const driven = new Set(cpu ? cpu.getDrivenControlSignalPorts() : []);

  const isOn = (name: string) => driven.has(`out_${name}`);

  return (
    <NodeShell
      component={component}
      zoom={zoom}
      control
      dense
      state={halted ? "error" : undefined}
      // The two side inputs' names, just above their ports — not level with
      // them, or the value tag a live wire draws at the port covers the name.
      // In `frame` because it renders straight into the node's root — the same
      // box the ports' `top: offset%` is measured against — not below the
      // title like children.
      frame={
        <>
          <span
            className="absolute left-2 z-20 font-mono text-cv-sm leading-none text-fg-muted"
            style={{ top: `${CPU_SIDE_INPUT_OFFSET}%`, transform: "translateY(calc(-100% - 10px))" }}
          >
            OPCODE
          </span>
          <span
            className="absolute right-2 z-20 font-mono text-cv-sm leading-none text-fg-muted"
            style={{ top: `${CPU_SIDE_INPUT_OFFSET}%`, transform: "translateY(calc(-100% - 10px))" }}
          >
            FLAGS
          </span>
        </>
      }
      actions={
        <FlagSquares
          flags={flagSpecs({
            zero: !!cpu && cpu.latchedFlagZero,
            carry: !!cpu && cpu.latchedFlagCarry,
            negative: !!cpu && cpu.latchedFlagNegative,
            overflow: !!cpu && cpu.latchedFlagOverflow,
          })}
        />
      }
    >
      <div className="min-h-0 flex-1 px-2 pt-1">
        <CpuFsmGraph
          currentState={currentState}
          nextState={nextState}
          opcode={opcode}
        />
      </div>

      {/* Signal strip: one dot per bottom control port. The ports are the
          control signals in `CONTROL_SIGNAL_DEFS` order, which is also the
          order `getPortOffset` walks when it auto-places them, so the strip
          reuses that same (i+1)/(n+1) formula and each dot sits directly under
          its port regardless of the node's width — except `out_opULA`, whose
          widget definition pins `offset: 91` instead of the computed 90, about
          9px right of its dot. Tall enough that the value row ends clear of
          the port squares straddling the bottom edge. */}
      <div className="relative h-16 shrink-0 border-t border-line">
        {CONTROL_SIGNAL_DEFS.map(({ name, bitWidth }, i) => {
          const active = isOn(name);
          const left = ((i + 1) / (CONTROL_SIGNAL_DEFS.length + 1)) * 100;
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
              <span className={`font-mono text-cv-sm leading-none ${active ? "text-fg" : "text-fg-faint"}`}>
                {name}
              </span>
              <span
                className={`num font-mono text-cv-md leading-none ${active ? "text-fg" : "text-fg-faint"}`}
              >
                {formatSignal(cpu ? cpu.controlPorts[name].value : 0, bitWidth, base)}
              </span>
            </div>
          );
        })}
      </div>
    </NodeShell>
  );
}
