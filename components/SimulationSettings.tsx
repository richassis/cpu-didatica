"use client";

import {
  useDisplayStore,
  ANIMATION_MIN_MS,
  ANIMATION_MAX_MS,
  type NumericBase,
  type TextSize,
} from "@/lib/displayStore";

/** Button labels — "decSigned" is a valid NumericBase but not a word anyone should read. */
const BASE_LABELS: Record<NumericBase, string> = {
  hex: "hex",
  dec: "dec+",
  decSigned: "dec±",
  bin: "bin",
  oct: "oct",
};

/**
 * Every simulation display setting, in one place.
 *
 * There used to be two panels: one on the edit-mode FAB and one floating in
 * program mode. They overlapped on speed and diverged everywhere else, and
 * because the FAB is hidden on a read-only canvas the numeric base — the one
 * setting a student is most likely to want mid-run — was unreachable during a
 * simulation. Both surfaces now mount this.
 */
/** The button's own "A" is drawn at the size it selects (relative to the base). */
const TEXT_SIZES: Array<{ id: TextSize; label: string; sample: string }> = [
  { id: "normal", label: "Texto normal", sample: "0.8125rem" },
  { id: "large", label: "Texto grande", sample: "1rem" },
  { id: "xlarge", label: "Texto muito grande", sample: "1.25rem" },
];

const SLIDER_STEPS = 100;
const SPEED_RATIO = Math.log(ANIMATION_MAX_MS / ANIMATION_MIN_MS);

/** Slider position 0 (slow) to `SLIDER_STEPS` (fast) for a stored duration. */
function speedToSlider(durationMs: number): number {
  const clamped = Math.min(ANIMATION_MAX_MS, Math.max(ANIMATION_MIN_MS, durationMs));
  return Math.round((Math.log(ANIMATION_MAX_MS / clamped) / SPEED_RATIO) * SLIDER_STEPS);
}

function sliderToDuration(position: number): number {
  return ANIMATION_MAX_MS * Math.exp(-(position / SLIDER_STEPS) * SPEED_RATIO);
}

export default function SimulationSettings() {
  const numericBase = useDisplayStore((s) => s.numericBase);
  const setNumericBase = useDisplayStore((s) => s.setNumericBase);
  const showWiresAndPorts = useDisplayStore((s) => s.showWiresAndPorts);
  const setShowWiresAndPorts = useDisplayStore((s) => s.setShowWiresAndPorts);
  const showCpuSignalWires = useDisplayStore((s) => s.showCpuSignalWires);
  const setShowCpuSignalWires = useDisplayStore((s) => s.setShowCpuSignalWires);
  const showDataSignalWires = useDisplayStore((s) => s.showDataSignalWires);
  const setShowDataSignalWires = useDisplayStore((s) => s.setShowDataSignalWires);
  const textSize = useDisplayStore((s) => s.textSize);
  const setTextSize = useDisplayStore((s) => s.setTextSize);
  const animationDurationMs = useDisplayStore((s) => s.animationDurationMs);
  const setAnimationDurationMs = useDisplayStore((s) => s.setAnimationDurationMs);

  return (
    <div className="w-72">
      <Section title="Valores" first />
      <div className="mb-1 flex items-center gap-1">
        {/* {(["hex", "dec", "decSigned", "bin", "oct"] as const).map((b) => ( */}
        {(["hex", "dec", "decSigned", "bin"] as const).map((b) => (
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
            {BASE_LABELS[b]}
          </button>
        ))}
      </div>

      <Section title="Texto" />
      <div className="mb-1 flex items-center gap-1">
        {TEXT_SIZES.map(({ id, label, sample }) => (
          <button
            key={id}
            onClick={() => setTextSize(id)}
            aria-pressed={textSize === id}
            title={label}
            className={`flex-1 rounded-lg border px-2 py-1 transition-colors ${
              textSize === id
                ? "border-st-active text-st-active"
                : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
            }`}
            style={{ fontSize: sample }}
          >
            A
          </button>
        ))}
      </div>

      <Section title="Sinais" />
      <div className="space-y-1">
        {/* The master switch. It used to exist only on the edit-mode FAB, which
            made it the one display setting a student could never reach — while
            the three it governs were already here. */}
        <Toggle label="Fios e portas" on={showWiresAndPorts} onChange={setShowWiresAndPorts} />
        <Toggle
          label="Sinais de controle"
          on={showCpuSignalWires}
          onChange={setShowCpuSignalWires}
          disabled={!showWiresAndPorts}
        />
        <Toggle
          label="Fios de dados"
          on={showDataSignalWires}
          onChange={setShowDataSignalWires}
          disabled={!showWiresAndPorts}
        />
      </div>

      <Section title="Velocidade" />
      {/* Left is slow, right is fast. The store keeps the time a dot takes to
          cross a reference wire, where smaller is faster, and the slider runs
          on its logarithm: speed is a ratio, so equal steps along the bar are
          equal factors of speed, and the middle is a middling speed. */}
      <div className="px-1">
        <input
          type="range"
          min={0}
          max={SLIDER_STEPS}
          step={1}
          value={speedToSlider(animationDurationMs)}
          onChange={(e) => setAnimationDurationMs(sliderToDuration(Number(e.target.value)))}
          aria-label="Velocidade da animação"
          className="timeline-slider h-4 w-full cursor-pointer appearance-none bg-transparent"
          style={{
            background:
              "linear-gradient(var(--border), var(--border)) center/100% 2px no-repeat",
          }}
        />
        <div className="flex items-center justify-between font-mono text-caption text-fg-faint">
          <span>Baixa</span>
          <span>Alta</span>
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
