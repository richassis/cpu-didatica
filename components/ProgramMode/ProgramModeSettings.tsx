"use client";

import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { useDisplayStore, type AnimationSpeedPreset } from "@/lib/displayStore";

/**
 * Floating visual-settings control for Program Mode.
 *
 * Program mode renders the canvas read-only, which hides the edit-mode FAB, so
 * this exposes the visual options that matter during playback: wire visibility,
 * value dots, animation on/off, and speed.
 */
export default function ProgramModeSettings() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const showCpuSignalWires = useDisplayStore((s) => s.showCpuSignalWires);
  const setShowCpuSignalWires = useDisplayStore((s) => s.setShowCpuSignalWires);
  const showDataSignalWires = useDisplayStore((s) => s.showDataSignalWires);
  const setShowDataSignalWires = useDisplayStore((s) => s.setShowDataSignalWires);
  const showWireDots = useDisplayStore((s) => s.showWireDots);
  const setShowWireDots = useDisplayStore((s) => s.setShowWireDots);
  const animationEnabled = useDisplayStore((s) => s.animationEnabled);
  const setAnimationEnabled = useDisplayStore((s) => s.setAnimationEnabled);
  const animateCpuSignals = useDisplayStore((s) => s.animateCpuSignals);
  const setAnimateCpuSignals = useDisplayStore((s) => s.setAnimateCpuSignals);
  const animateDataSignals = useDisplayStore((s) => s.animateDataSignals);
  const setAnimateDataSignals = useDisplayStore((s) => s.setAnimateDataSignals);
  const animationSpeed = useDisplayStore((s) => s.animationSpeed);
  const setAnimationSpeed = useDisplayStore((s) => s.setAnimationSpeed);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={rootRef} className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {open && (
        <div
          className="w-60 rounded-2xl border border-line bg-surface p-4"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="t-section mb-2">Wires</div>
          <div className="mb-4 space-y-1">
            <Toggle label="CPU control signals" on={showCpuSignalWires} onClick={() => setShowCpuSignalWires(!showCpuSignalWires)} />
            <Toggle label="Data signals" on={showDataSignalWires} onClick={() => setShowDataSignalWires(!showDataSignalWires)} />
            <Toggle label="Value dots" on={showWireDots} onClick={() => setShowWireDots(!showWireDots)} />
          </div>

          <div className="t-section mb-2 border-t border-line pt-3">Animation</div>
          <div className="mb-4 space-y-1">
            <Toggle label="Enabled" on={animationEnabled} onClick={() => setAnimationEnabled(!animationEnabled)} />
            <Toggle
              label="CPU signals"
              on={animateCpuSignals}
              onClick={() => setAnimateCpuSignals(!animateCpuSignals)}
              disabled={!animationEnabled}
            />
            <Toggle
              label="Data flow"
              on={animateDataSignals}
              onClick={() => setAnimateDataSignals(!animateDataSignals)}
              disabled={!animationEnabled}
            />
          </div>

          <div className="t-section mb-2 border-t border-line pt-3">Speed</div>
          <div className="flex items-center gap-1">
            {(["fast", "normal", "slow"] as AnimationSpeedPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setAnimationSpeed(preset)}
                disabled={!animationEnabled}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs capitalize transition-colors disabled:opacity-40 ${
                  animationSpeed === preset
                    ? "border-st-active text-st-active"
                    : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-11 w-11 items-center justify-center rounded-full border bg-surface transition-colors ${
          open ? "border-line-strong text-fg" : "border-line text-fg-muted hover:text-fg"
        }`}
        aria-label="Visual settings"
        title="Visual settings"
      >
        <Settings2 size={18} strokeWidth={1.5} />
      </button>
    </div>
  );
}

/**
 * A row toggle. The track is outlined and the knob carries the accent when on,
 * so an enabled switch reads as a state without filling a 28px block with
 * saturated colour.
 */
function Toggle({
  label,
  on,
  onClick,
  disabled,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors ${
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-raised"
      }`}
    >
      <span className="text-xs text-fg-muted">{label}</span>
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${
          on ? "border-st-active" : "border-line-strong"
        }`}
      >
        <span
          className={`inline-block h-2.5 w-2.5 transform rounded-full transition-transform ${
            on ? "translate-x-3.5 bg-st-active" : "translate-x-0.5 bg-line-strong"
          }`}
        />
      </span>
    </button>
  );
}
