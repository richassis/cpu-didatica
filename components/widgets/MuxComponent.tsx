"use client";

import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import NodeShell from "@/components/widgets/NodeShell";

/**
 * Multiplexer.
 *
 * It draws its own trapezoid rather than using the shared silhouette, because
 * the internal selection rail has to line up with the real port offsets —
 * `(i + 1) / (count + 1) * H`, the same formula getPortOffset uses. A stretched
 * viewBox would drift away from the ports.
 *
 * The rail is the anatomy: every input reaches it, and exactly one path
 * continues to the output. Which one is the whole content of the component, so
 * that path is the only thing here allowed to take the data colour.
 */
export default function MuxComponent({ component, zoom }: Props) {
  const { id, w, h } = component;

  const revision = useSimulatorStore((s) => s.revision);
  const mux = useSimulatorStore((s) => s.getMux(id));
  const base = useDisplayStore((s) => s.numericBase);
  void revision;

  const sel = mux ? mux.sel : 0;
  const numInputs = mux ? mux.numInputs : ((component.meta?.numInputs as number) ?? 2);
  const bitWidth = mux ? mux.bitWidth : 16;

  const W = !w || isNaN(w) ? 84 : w;
  const H = !h || isNaN(h) ? 104 : h;
  const inset = Math.round(H * 0.18);
  const trapPoints = `0,0 ${W},${inset} ${W},${H - inset} 0,${H}`;

  const railX = W * 0.5;
  const outputY = H * 0.5;
  const inputYs = Array.from({ length: numInputs }, (_, i) => (H * (i + 1)) / (numInputs + 1));
  const clampedSel = Math.max(0, Math.min(sel, numInputs - 1));
  const selY = inputYs[clampedSel] ?? outputY;

  return (
    <NodeShell
      component={component}
      zoom={zoom}
      silhouette="custom"
      value={formatNum(mux ? mux.result : 0, base, bitWidth)}
      actions={
        <span className="shrink-0 font-mono text-[10px] leading-none text-fg-faint">
          s={clampedSel}
        </span>
      }
      frame={
        <svg
          className="absolute inset-0 pointer-events-none"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          aria-hidden
        >
          <defs>
            <radialGradient id={`mux-glow-${id}`} cx="50%" cy="115%" r="95%">
              <stop offset="0%" stopColor="var(--node-glow)" />
              <stop offset="70%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <polygon points={trapPoints} fill="var(--surface-raised)" />
          <polygon
            points={trapPoints}
            fill={`url(#mux-glow-${id})`}
            stroke="var(--node-line)"
            strokeWidth={1}
          />
        </svg>
      }
    >
      <svg
        className="absolute inset-0 pointer-events-none"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden
      >
        {/* The rail every input reaches. */}
        <line
          x1={railX}
          y1={inputYs[0]}
          x2={railX}
          y2={inputYs[numInputs - 1]}
          stroke="var(--border-strong)"
          strokeWidth={1}
          strokeLinecap="round"
        />

        {inputYs.map((iy, i) => (
          <line
            key={i}
            x1={2}
            y1={iy}
            x2={railX}
            y2={iy}
            stroke={clampedSel === i ? "var(--st-data)" : "var(--border-strong)"}
            strokeWidth={clampedSel === i ? 1.5 : 1}
            strokeLinecap="round"
          />
        ))}

        {/* The one path that continues. */}
        <line
          x1={railX}
          y1={selY}
          x2={W - 2}
          y2={outputY}
          stroke="var(--st-data)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        <circle
          cx={railX}
          cy={0}
          r={3}
          fill="var(--st-data)"
          style={{
            transform: `translateY(${selY}px)`,
            transition: "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      </svg>
    </NodeShell>
  );
}
