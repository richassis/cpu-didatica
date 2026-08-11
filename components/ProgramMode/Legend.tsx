"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Silhouette, ClockNotch, MemorySpine, GLYPHS } from "@/components/widgets/silhouettes";

/**
 * How to read the canvas.
 *
 * Two columns, and the point of the panel is the sentence between them: shape
 * and colour are independent channels. Nothing on this screen explained the
 * wire colours, the phase pills or the Z/C/N flags before, so a student had to
 * infer the whole vocabulary. Now it is written down.
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
        <div className="truncate text-[11px] text-fg-muted">{label}</div>
        {note && <div className="truncate text-[10px] text-fg-faint">{note}</div>}
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
        <div className="truncate text-[11px] text-fg-muted">{label}</div>
        <div className="truncate text-[10px] text-fg-faint">{note}</div>
      </div>
    </div>
  );
}

export default function Legend() {
  const [open, setOpen] = useState(false);

  const Register = GLYPHS.Register;
  const Memory = GLYPHS.MemoryComponent;

  return (
    <div className="absolute bottom-4 right-20 z-30 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[380px] rounded-2xl border border-line bg-surface p-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <div className="t-section mb-2">Shape — what it is</div>
              <div className="space-y-2">
                <ShapeSample label="Register" note="single value slot">
                  <span className="node--boxed absolute inset-0 rounded-[6px]" />
                  <ClockNotch />
                  <span className="absolute left-0 top-0 flex h-4 w-4 items-center justify-center text-fg-faint">
                    <Register size={10} strokeWidth={1.5} />
                  </span>
                </ShapeSample>

                <ShapeSample label="Memory" note="spine on the left edge">
                  <span className="node--boxed absolute inset-0 rounded-[6px]" />
                  <MemorySpine />
                  <ClockNotch />
                  <span className="absolute right-0.5 top-0.5 text-fg-faint">
                    <Memory size={10} strokeWidth={1.5} />
                  </span>
                </ShapeSample>

                <ShapeSample label="ALU" note="notched trapezoid">
                  <Silhouette kind="alu" />
                </ShapeSample>

                <ShapeSample label="Multiplexer" note="trapezoid, no notch">
                  <Silhouette kind="mux" />
                </ShapeSample>

                <ShapeSample label="Decoder" note="inverted trapezoid">
                  <Silhouette kind="decoder" />
                </ShapeSample>

                <ShapeSample label="Control unit" note="dashed — commands the datapath">
                  <span className="node--boxed node--control absolute inset-0 rounded-[6px]" />
                </ShapeSample>
              </div>
            </div>

            <div>
              <div className="t-section mb-2">Colour — what is happening</div>
              <div className="space-y-2">
                <StateSample
                  color="var(--st-active)"
                  label="Active"
                  note="executing this tick"
                />
                <StateSample
                  color="var(--st-data)"
                  label="Data"
                  note="wire or register holding a value"
                />
                <StateSample color="var(--st-warn)" label="Watch" note="flag set" />
                <StateSample color="var(--st-error)" label="Error" note="halt, overflow, bad address" />
                <StateSample
                  color="var(--border-strong)"
                  label="Idle"
                  note="not involved this tick"
                />
              </div>

              <div className="mt-4 border-t border-line pt-3">
                <div className="t-section mb-1.5">Clock notch ▷</div>
                <p className="text-[10px] leading-snug text-fg-faint">
                  Components carrying the notch are sequential — they latch on the clock.
                  Those without it are combinational.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-3 border-t border-line pt-3 text-[10px] leading-snug text-fg-faint">
            The two columns are independent. Shape never changes during execution, and
            colour never tells you which component you are looking at.
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-11 items-center gap-1.5 rounded-full border bg-surface px-3 text-xs transition-colors ${
          open ? "border-line-strong text-fg" : "border-line text-fg-muted hover:text-fg"
        }`}
        aria-expanded={open}
        title="How to read the canvas"
      >
        <HelpCircle size={16} strokeWidth={1.5} />
        Legend
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
