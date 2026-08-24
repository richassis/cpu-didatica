"use client";

import { useExecutionStore } from "@/lib/executionStore";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { usePlaybackStore } from "@/lib/playbackStore";

/**
 * Seven-segment tick counter.
 *
 * The tick was previously written twice — a 32px figure inside the timeline
 * card and a small `T{n}` in the canvas clock toolbar — and neither read as an
 * instrument. This is the single counter, parked in a corner of the canvas at a
 * size you can read from across a classroom.
 *
 * Drawn as inline SVG rather than with a display webfont: the repo has no font
 * files, and a seven-segment shape is seven polygons.
 *
 * On colour: the lit segments are plain foreground, not the accent. A block
 * this large filled with a saturated hue would eat most of the screen's colour
 * budget, and colour here has to keep meaning "state" — which is why the one
 * coloured case is a halted CPU.
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

function Digit({ char, lit }: { char: string; lit: string }) {
  const on = DIGIT_SEGMENTS[char] ?? "";
  return (
    <svg viewBox="0 0 36 64" className="h-11 w-auto" aria-hidden>
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
  const lit = halted ? "var(--st-error)" : "var(--text)";
  const digits = String(Math.min(currentIndex, 9999)).padStart(4, "0").split("");

  return (
    <div
      className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col items-end gap-1 rounded-xl border border-line bg-surface px-3 py-2"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-center gap-1">
        {digits.map((char, i) => (
          <Digit key={i} char={char} lit={lit} />
        ))}
      </div>
      <div className="flex w-full items-baseline justify-between gap-3">
        <span className="t-section leading-none">{halted ? "halted" : "tick"}</span>
        <span className="num font-mono text-[11px] text-fg-faint">of {totalTicks}</span>
      </div>

      {/*
        Announced for screen readers, but silenced while playing: a run of three
        hundred ticks would otherwise queue three hundred announcements.
      */}
      <span className="sr-only" role="status" aria-live={isPlaying ? "off" : "polite"}>
        {`Tick ${currentIndex} of ${totalTicks}${halted ? ", halted" : ""}`}
      </span>
    </div>
  );
}
