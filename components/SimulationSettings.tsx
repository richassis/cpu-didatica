"use client";

import {
  useDisplayStore,
  ANIMATION_MIN_MS,
  ANIMATION_MAX_MS,
  isInstantSpeed,
} from "@/lib/displayStore";

/**
 * Every simulation display setting, in one place.
 *
 * There used to be two panels: one on the edit-mode FAB and one floating in
 * program mode. They overlapped on speed and diverged everywhere else, and
 * because the FAB is hidden on a read-only canvas the numeric base — the one
 * setting a student is most likely to want mid-run — was unreachable during a
 * simulation. Both surfaces now mount this.
 */
export default function SimulationSettings() {
  const numericBase = useDisplayStore((s) => s.numericBase);
  const setNumericBase = useDisplayStore((s) => s.setNumericBase);
  const showCpuSignalWires = useDisplayStore((s) => s.showCpuSignalWires);
  const setShowCpuSignalWires = useDisplayStore((s) => s.setShowCpuSignalWires);
  const showDataSignalWires = useDisplayStore((s) => s.showDataSignalWires);
  const setShowDataSignalWires = useDisplayStore((s) => s.setShowDataSignalWires);
  const showWireDots = useDisplayStore((s) => s.showWireDots);
  const setShowWireDots = useDisplayStore((s) => s.setShowWireDots);
  const showPortValues = useDisplayStore((s) => s.showPortValues);
  const setShowPortValues = useDisplayStore((s) => s.setShowPortValues);
  const animationEnabled = useDisplayStore((s) => s.animationEnabled);
  const setAnimationEnabled = useDisplayStore((s) => s.setAnimationEnabled);
  const animateCpuSignals = useDisplayStore((s) => s.animateCpuSignals);
  const setAnimateCpuSignals = useDisplayStore((s) => s.setAnimateCpuSignals);
  const animateDataSignals = useDisplayStore((s) => s.animateDataSignals);
  const setAnimateDataSignals = useDisplayStore((s) => s.setAnimateDataSignals);
  const animationDurationMs = useDisplayStore((s) => s.animationDurationMs);
  const setAnimationDurationMs = useDisplayStore((s) => s.setAnimationDurationMs);

  const instant = isInstantSpeed(animationDurationMs);

  return (
    <div className="w-72">
      <Section title="Values" first />
      <div className="mb-1 flex items-center gap-1">
        {(["hex", "dec", "bin", "oct"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setNumericBase(b)}
            aria-pressed={numericBase === b}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
              numericBase === b
                ? "border-st-active text-st-active"
                : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      <Section title="Signals" />
      <div className="space-y-1">
        <Toggle
          label="Control signal wires"
          on={showCpuSignalWires}
          onChange={setShowCpuSignalWires}
        />
        <Toggle label="Data wires" on={showDataSignalWires} onChange={setShowDataSignalWires} />
        <Toggle label="Value dots" on={showWireDots} onChange={setShowWireDots} />
        <Toggle label="Port values" on={showPortValues} onChange={setShowPortValues} />
      </div>

      <Section title="Animation" />
      <div className="space-y-1">
        <Toggle label="Enabled" on={animationEnabled} onChange={setAnimationEnabled} />
        <Toggle
          label="Control signals"
          on={animateCpuSignals}
          onChange={setAnimateCpuSignals}
          disabled={!animationEnabled}
        />
        <Toggle
          label="Data flow"
          on={animateDataSignals}
          onChange={setAnimateDataSignals}
          disabled={!animationEnabled}
        />
      </div>

      <Section title="Speed" />
      <div className="px-1">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs text-fg-muted">Per step</span>
          <span className="num font-mono text-xs text-fg">
            {instant ? "instant" : `${animationDurationMs} ms`}
          </span>
        </div>
        <input
          type="range"
          min={ANIMATION_MIN_MS}
          max={ANIMATION_MAX_MS}
          step={10}
          value={animationDurationMs}
          disabled={!animationEnabled}
          onChange={(e) => setAnimationDurationMs(Number(e.target.value))}
          aria-label="Animation speed in milliseconds per step"
          className="timeline-slider h-4 w-full cursor-pointer appearance-none bg-transparent disabled:opacity-40"
          style={{
            background:
              "linear-gradient(var(--border), var(--border)) center/100% 2px no-repeat",
          }}
        />
        <div className="flex items-center justify-between font-mono text-[10px] text-fg-faint">
          <span>instant</span>
          <span>slow</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, first = false }: { title: string; first?: boolean }) {
  return (
    <div className={`t-section mb-2 ${first ? "" : "mt-4 border-t border-line pt-3"}`}>{title}</div>
  );
}

/**
 * A row switch.
 *
 * `role="switch"` + `aria-checked` because the previous version was a bare
 * button whose state was carried only by colour, and its disabled form merely
 * dropped the click handler — leaving it focusable and operable-looking with no
 * effect. This one is a real disabled control.
 */
function Toggle({
  label,
  on,
  onChange,
  disabled,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="text-xs text-fg-muted">{label}</span>
      <span
        aria-hidden
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
