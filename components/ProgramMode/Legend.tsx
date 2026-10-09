"use client";

import { Silhouette, MemorySpine } from "@/components/widgets/silhouettes";
import { useT } from "@/lib/i18n";

/**
 * How to read the canvas.
 *
 * Two columns, and the point of the panel is the sentence between them: shape
 * and colour are independent channels. Nothing on the canvas itself explains
 * the shapes, the wire colours or the state colours (a flag Z/C/N/V lit, the
 * UC halted), so a student had to infer the whole vocabulary. Now it is
 * written down; the Ajuda's guide tab shows it.
 */

/** A miniature of one component class, drawn with the real silhouette parts. */
function ShapeSample({
  children,
  label,
  note,
}: {
  children: React.ReactNode;
  label: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="node relative h-7 w-10 shrink-0" data-state="idle">
        {children}
      </div>
      <div className="min-w-0">
        <div className="truncate text-small text-fg-muted">{label}</div>
        {note && <div className="truncate text-caption text-fg-faint">{note}</div>}
      </div>
    </div>
  );
}

function StateSample({ color, label, note }: { color: string; label: string; note: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-3 w-3 shrink-0 rounded-full border"
        style={{ borderColor: color, background: `color-mix(in srgb, ${color} 25%, transparent)` }}
      />
      <div className="min-w-0">
        <div className="truncate text-small text-fg-muted">{label}</div>
        <div className="truncate text-caption text-fg-faint">{note}</div>
      </div>
    </div>
  );
}

export default function Legend() {
  const { shapeHeading, colorHeading, shapes, states } = useT().legend;
  return (
    <div className="w-[380px]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <div className="t-section mb-2">{shapeHeading}</div>
              <div className="space-y-2">
                <ShapeSample {...shapes.register}>
                  <span className="node--boxed absolute inset-0 rounded-[6px]" />
                </ShapeSample>

                <ShapeSample {...shapes.memory}>
                  <span className="node--boxed absolute inset-0 rounded-[6px]" />
                  <MemorySpine />
                </ShapeSample>

                <ShapeSample {...shapes.alu}>
                  <Silhouette kind="alu" />
                </ShapeSample>

                <ShapeSample {...shapes.mux}>
                  <Silhouette kind="mux" />
                </ShapeSample>

                <ShapeSample {...shapes.decoder}>
                  <span className="node--boxed absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 rounded-[3px]" />
                </ShapeSample>

                <ShapeSample {...shapes.control}>
                  <span className="node--boxed node--control absolute inset-0 rounded-[6px]" />
                </ShapeSample>
              </div>
            </div>

            <div>
              <div className="t-section mb-2">{colorHeading}</div>
              <div className="space-y-2">
                <StateSample
                  color="var(--st-active)"
                  {...states.active}
                />
                <StateSample
                  color="var(--st-data)"
                  {...states.dataWire}
                />
                <StateSample
                  color="var(--st-active)"
                  {...states.controlWire}
                />
                <StateSample color="var(--st-warn)" {...states.warning} />
                <StateSample color="var(--st-error)" {...states.error} />
                <StateSample
                  color="var(--border-strong)"
                  {...states.idle}
                />
              </div>
            </div>
          </div>
    </div>
  );
}
