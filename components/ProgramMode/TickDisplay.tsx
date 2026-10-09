"use client";

import { useExecutionStore } from "@/lib/executionStore";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { usePlaybackStore } from "@/lib/playbackStore";

/**
 * Seven-segment tick counter.
 *
 * The tick was previously written twice — a 32px figure inside the timeline
 * card and a small `T{n}` in the canvas clock toolbar — and neither read as an
 * instrument. This is the one current-tick readout, part of the simulation bar,
 * sitting beside the player it belongs to. (The total, "de N", also appears as
 * "/ N" at the end of the player's controls.)
 *
 * Drawn as inline SVG rather than with a display webfont: the repo has no font
 * files, and a seven-segment shape is seven polygons.
 *
 * On colour: the counter takes the control-wire green — segments, border and
 * a faint fill — while the simulation runs, so it stands out as part of that
 * state, and turns red once the CPU halts.
 */

/** Segment presence per digit, in order: a b c d e f g. */
const DIGIT_SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

/**
 * Segment polygons on a 0..36 × 0..64 grid. Mitred ends, so neighbouring
 * segments meet at a diagonal the way a real display does.
 */
const SEGMENT_PATHS: Record<string, string> = {
  a: "M6,2 L30,2 L26,6 L10,6 Z",
  b: "M31,3 L33,7 L33,28 L29,31 L29,8 Z",
  c: "M33,36 L33,57 L31,61 L29,56 L29,33 Z",
  d: "M10,58 L26,58 L30,62 L6,62 Z",
  e: "M3,36 L7,33 L7,56 L5,61 L3,57 Z",
  f: "M3,7 L5,3 L7,8 L7,31 L3,28 Z",
  g: "M9,32 L27,32 L31,34.5 L27,37 L9,37 L5,34.5 Z",
};

const ALL_SEGMENTS = Object.keys(SEGMENT_PATHS);

/** Student-visible text of the counter, in one place for translation. */
const LABELS = {
  tick: "tick",
  halted: "parado",
  of: "de",
} as const;

function Digit({ char, lit }: { char: string; lit: string }) {
  const on = DIGIT_SEGMENTS[char] ?? "";
  return (
    <svg viewBox="0 0 36 64" className="h-7 w-auto" aria-hidden>
      {ALL_SEGMENTS.map((seg) => {
        const isOn = on.includes(seg);
        return (
          <path
            key={seg}
            d={SEGMENT_PATHS[seg]}
            // Unlit segments stay faintly visible. That "ghost" is what makes it
            // read as a physical display instead of a stylised number, and it
            // stops the digits from changing width as they change value.
            fill={isOn ? lit : "var(--border)"}
          />
        );
      })}
    </svg>
  );
}

export default function TickDisplay() {
  const currentIndex = useExecutionStore((s) => s.currentIndex);
  const totalTicks = useExecutionStore((s) => s.totalTicks);
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const revision = useSimulatorStore((s) => s.revision);
  const getPrimaryCpu = useSimulatorStore((s) => s.getPrimaryCpu);
  void revision;

  if (!isTimelineActive) return null;

  const halted = getPrimaryCpu()?.halted ?? false;
  const lit = halted ? "var(--st-error)" : "var(--st-active)";
  const digits = String(Math.min(currentIndex, 9999)).padStart(4, "0").split("");

  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-2 py-1"
      style={{
        borderColor: lit,
        background: `color-mix(in srgb, ${lit} 10%, var(--surface))`,
      }}
    >
      <div className="flex items-center gap-0.5">
        {digits.map((char, i) => (
          <Digit key={i} char={char} lit={lit} />
        ))}
      </div>
      <div className="flex flex-col items-start leading-none">
        <span className="t-section leading-none">{halted ? LABELS.halted : LABELS.tick}</span>
        <span className="num mt-1 font-mono text-caption text-fg-faint">
          {LABELS.of} {totalTicks}
        </span>
      </div>

      {/*
        Announced for screen readers, but silenced while playing: a run of three
        hundred ticks would otherwise queue three hundred announcements.
      */}
      <span className="sr-only" role="status" aria-live={isPlaying ? "off" : "polite"}>
        {`Tick ${currentIndex} ${LABELS.of} ${totalTicks}${halted ? `, ${LABELS.halted}` : ""}`}
      </span>
    </div>
  );
}
