"use client";

import { useEffect, useRef, useState } from "react";
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
          className="bg-gray-900/95 border border-gray-700 rounded-2xl shadow-2xl backdrop-blur-sm p-4 w-60"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Wires</div>
          <div className="space-y-1.5 mb-4">
            <Toggle label="CPU control signals" on={showCpuSignalWires} onClick={() => setShowCpuSignalWires(!showCpuSignalWires)} />
            <Toggle label="Data signals" on={showDataSignalWires} onClick={() => setShowDataSignalWires(!showDataSignalWires)} />
            <Toggle label="Value dots" on={showWireDots} onClick={() => setShowWireDots(!showWireDots)} />
          </div>

          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Animation</div>
          <div className="space-y-1.5 mb-4">
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

          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Speed</div>
          <div className="flex items-center gap-1">
            {(["fast", "normal", "slow"] as AnimationSpeedPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setAnimationSpeed(preset)}
                disabled={!animationEnabled}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize disabled:opacity-40 ${
                  animationSpeed === preset
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
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
        className={`w-11 h-11 rounded-full shadow-xl flex items-center justify-center text-white text-lg transition-all ${
          open ? "bg-indigo-600" : "bg-gray-800 hover:bg-gray-700 border border-gray-600"
        }`}
        aria-label="Visual settings"
        title="Visual settings"
      >
        ⚙
      </button>
    </div>
  );
}

function Toggle({ label, on, onClick, disabled }: { label: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg transition-colors ${
        disabled ? "opacity-40 cursor-not-allowed bg-gray-800/40" : "bg-gray-800/70 hover:bg-gray-800"
      }`}
    >
      <span className="text-xs text-gray-200">{label}</span>
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-emerald-500" : "bg-gray-600"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            on ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
