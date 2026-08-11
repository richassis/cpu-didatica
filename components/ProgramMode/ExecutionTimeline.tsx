"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, X } from "lucide-react";
import { CpuState, CPU_STATE_LABELS, Opcode, opcodeToMnemonic } from "@/lib/simulator";
import { useExecutionStore } from "@/lib/executionStore";

function formatOpcode(opcode: number): string {
  try {
    return opcodeToMnemonic(opcode as Opcode);
  } catch {
    return `0x${opcode.toString(16).toUpperCase().padStart(2, "0")}`;
  }
}

function TransportButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-30 disabled:hover:border-line disabled:hover:text-fg-muted"
    >
      {children}
    </button>
  );
}

/**
 * The tick scrubber.
 *
 * The tick counter is the one place on screen entitled to a large number, so
 * it gets the 32/300 metric size with the total in muted text — the reader is
 * tracking one figure, not two.
 */
export default function ExecutionTimeline() {
  const frames = useExecutionStore((s) => s.frames);
  const currentIndex = useExecutionStore((s) => s.currentIndex);
  const totalTicks = useExecutionStore((s) => s.totalTicks);
  const canGoBack = useExecutionStore((s) => s.canGoBack);
  const canGoForward = useExecutionStore((s) => s.canGoForward);
  const executionError = useExecutionStore((s) => s.executionError);
  const goToTick = useExecutionStore((s) => s.goToTick);
  const goToStart = useExecutionStore((s) => s.goToStart);
  const goToEnd = useExecutionStore((s) => s.goToEnd);
  const stepBackward = useExecutionStore((s) => s.stepBackward);
  const stepForward = useExecutionStore((s) => s.stepForward);
  const exitTimeline = useExecutionStore((s) => s.exitTimeline);

  const currentSnapshot = frames[currentIndex]?.postTick;

  const stateLabel = useMemo(() => {
    if (!currentSnapshot) return "--";
    return CPU_STATE_LABELS[currentSnapshot.cpuState as CpuState] ?? "UNKNOWN";
  }, [currentSnapshot]);

  const opcodeLabel = useMemo(() => {
    if (!currentSnapshot) return "--";
    return formatOpcode(currentSnapshot.opcode);
  }, [currentSnapshot]);

  const progress = totalTicks > 0 ? (currentIndex / totalTicks) * 100 : 0;

  /**
   * Phase boundaries as 1px ticks on the track — where the instruction being
   * executed changes. Without them the slider is an undifferentiated bar and
   * there is no way to aim at the start of an instruction.
   */
  const phaseMarks = useMemo(() => {
    const marks: number[] = [];
    for (let i = 1; i < frames.length; i++) {
      if (frames[i]?.postTick?.opcode !== frames[i - 1]?.postTick?.opcode) {
        marks.push((i / Math.max(1, totalTicks)) * 100);
      }
    }
    return marks;
  }, [frames, totalTicks]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3">
      <div
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            stepBackward();
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            stepForward();
          }
        }}
        className="mx-auto w-full max-w-[1400px] rounded-2xl border border-line bg-surface px-4 py-3 focus:outline-none focus:ring-2 focus:ring-st-active focus:ring-offset-2 focus:ring-offset-canvas"
      >
        <div className="flex items-center gap-2">
          <TransportButton onClick={goToStart} disabled={!canGoBack} title="Go to start">
            <SkipBack size={14} strokeWidth={1.5} />
          </TransportButton>
          <TransportButton onClick={stepBackward} disabled={!canGoBack} title="Back one tick">
            <ChevronLeft size={16} strokeWidth={1.5} />
          </TransportButton>

          <div className="ml-2 flex items-baseline gap-1.5">
            <span className="t-metric num leading-none text-fg">{currentIndex}</span>
            <span className="num text-fg-muted">/ {totalTicks}</span>
          </div>

          <span className="ml-3 rounded-md border border-st-active px-2 py-1 font-mono text-[11px] text-st-active">
            {stateLabel}
          </span>

          <span className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-fg-muted">
            {opcodeLabel}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <TransportButton onClick={stepForward} disabled={!canGoForward} title="Forward one tick">
              <ChevronRight size={16} strokeWidth={1.5} />
            </TransportButton>
            <TransportButton onClick={goToEnd} disabled={!canGoForward} title="Go to end">
              <SkipForward size={14} strokeWidth={1.5} />
            </TransportButton>

            <button
              onClick={exitTimeline}
              title="End the execution timeline"
              className="ml-1 flex h-8 items-center gap-1.5 rounded-lg border border-st-error px-3 text-xs text-st-error transition-colors hover:bg-st-error/10"
            >
              <X size={13} strokeWidth={1.5} />
              Exit
            </button>
          </div>
        </div>

        {executionError && (
          <div className="mt-3 rounded-lg border border-st-error px-3 py-2 text-xs text-st-error">
            {executionError}
          </div>
        )}

        <div className="mt-3">
          {/* The native range input is transparent and sits on top; the track it
              would draw is replaced by the two 2px rules underneath, so the
              filled portion follows the theme instead of a hardcoded gradient. */}
          <div className="relative h-4">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-line" />
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-st-active"
              style={{ width: `${progress}%` }}
            />
            {phaseMarks.map((left, i) => (
              <div
                key={i}
                className="pointer-events-none absolute top-1/2 h-2 w-px -translate-y-1/2 bg-line-strong"
                style={{ left: `${left}%` }}
              />
            ))}
            <input
              type="range"
              min={0}
              max={Math.max(0, totalTicks)}
              value={Math.min(currentIndex, Math.max(0, totalTicks))}
              onChange={(event) => goToTick(Number(event.target.value))}
              aria-label="Tick"
              className="timeline-slider absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
            />
          </div>

          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-fg-faint">
            <span>0</span>
            <span>{totalTicks}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
