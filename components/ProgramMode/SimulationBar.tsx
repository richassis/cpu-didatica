"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Pause,
  Play,
  Settings2,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { Opcode, opcodeToMnemonic } from "@/lib/simulator";
import { useExecutionStore } from "@/lib/executionStore";
import { usePlaybackStore } from "@/lib/playbackStore";
import SimulationSettings from "@/components/SimulationSettings";
import Legend from "@/components/ProgramMode/Legend";

function formatOpcode(opcode: number): string {
  try {
    return opcodeToMnemonic(opcode as Opcode);
  } catch {
    return `0x${opcode.toString(16).toUpperCase().padStart(2, "0")}`;
  }
}

/**
 * The single simulation control bar.
 *
 * Assembly, configuration and playback used to be spread across a top bar, a
 * fixed timeline card and two floating buttons stacked in the same corner. This
 * gathers the playback half into one strip.
 *
 * Two things it deliberately does NOT show:
 *  - the tick number, which now lives in the seven-segment display so there is
 *    exactly one counter on screen;
 *  - the CPU phase. The bar used to render a phase pill fed by
 *    `postTick.cpuState`, which is the phase that runs *next*, while the
 *    control unit's headline shows the phase that just ran. The same screen
 *    stated two different current phases. The control unit owns the phase now,
 *    and it already shows both.
 *
 * It mounts whenever program mode is up, not only once a timeline exists —
 * otherwise the settings and legend would be unreachable before the first Run.
 */
export default function SimulationBar() {
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
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

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const togglePlay = usePlaybackStore((s) => s.toggle);
  const pause = usePlaybackStore((s) => s.pause);

  const [panel, setPanel] = useState<"settings" | "legend" | null>(null);

  /**
   * Every manual navigation stops playback first. It cannot live inside
   * `goToTick`, because playback drives that same funnel — the distinction is
   * who asked, and only the UI knows.
   */
  const manual = (action: () => void) => () => {
    pause();
    action();
  };

  const opcodeLabel = useMemo(() => {
    const snapshot = frames[currentIndex]?.postTick;
    return snapshot ? formatOpcode(snapshot.opcode) : "--";
  }, [frames, currentIndex]);

  const progress = totalTicks > 0 ? (currentIndex / totalTicks) * 100 : 0;

  /**
   * Where the executing instruction changes — aiming points on the track.
   * Keyed on `pc` rather than opcode: the PC is stable across every tick of
   * one instruction and only changes at FETCH, so it also tells apart two
   * consecutive instructions that happen to share an opcode (a loop body).
   */
  const phaseMarks = useMemo(() => {
    const marks: number[] = [];
    for (let i = 1; i < frames.length; i++) {
      if (frames[i]?.postTick?.pc !== frames[i - 1]?.postTick?.pc) {
        marks.push((i / Math.max(1, totalTicks)) * 100);
      }
    }
    return marks;
  }, [frames, totalTicks]);

  // Playback must not outlive the bar, or a timer keeps stepping a timeline
  // nobody is looking at.
  useEffect(() => () => pause(), [pause]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3">
      <div className="mx-auto w-full max-w-[1400px]">
        {panel && (
          <div
            role="dialog"
            aria-modal="false"
            aria-label={panel === "settings" ? "Ajustes da simulação" : "Legenda"}
            className="mb-2 ml-auto w-fit rounded-2xl border border-line bg-surface p-4"
          >
            {panel === "settings" ? <SimulationSettings /> : <Legend />}
          </div>
        )}

        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            {isTimelineActive ? (
              <>
                <TransportButton
                  onClick={manual(goToStart)}
                  disabled={!canGoBack}
                  title="Ir para o início"
                >
                  <SkipBack size={14} strokeWidth={1.5} />
                </TransportButton>
                <TransportButton
                  onClick={manual(stepBackward)}
                  disabled={!canGoBack}
                  title="Voltar um tick"
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </TransportButton>

                {/* Play walks the timeline tick by tick with the animations
                    intact; the skip button beside it is the instant jump. Two
                    buttons rather than one hidden mode. */}
                <button
                  onClick={togglePlay}
                  title={isPlaying ? "Pausar" : "Percorrer todos os ticks"}
                  aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs text-fg transition-colors hover:border-st-active"
                >
                  {isPlaying ? (
                    <Pause size={14} strokeWidth={1.5} className="text-st-active" />
                  ) : (
                    <Play size={14} strokeWidth={1.5} className="text-st-active" />
                  )}
                  {isPlaying ? "Pausar" : "Reproduzir"}
                </button>

                <TransportButton
                  onClick={manual(stepForward)}
                  disabled={!canGoForward}
                  title="Avançar um tick"
                >
                  <ChevronRight size={16} strokeWidth={1.5} />
                </TransportButton>
                <TransportButton
                  onClick={manual(goToEnd)}
                  disabled={!canGoForward}
                  title="Ir para o fim, sem animar"
                >
                  <SkipForward size={14} strokeWidth={1.5} />
                </TransportButton>

                <span className="num ml-2 font-mono text-xs text-fg-muted">/ {totalTicks}</span>

                <span className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-fg-muted">
                  {opcodeLabel}
                </span>
              </>
            ) : (
              <span className="text-xs text-fg-faint">Execute um programa para percorrê-lo tick a tick.</span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <PanelButton
                label="Ajustes"
                active={panel === "settings"}
                onClick={() => setPanel((p) => (p === "settings" ? null : "settings"))}
              >
                <Settings2 size={14} strokeWidth={1.5} />
              </PanelButton>
              <PanelButton
                label="Legenda"
                active={panel === "legend"}
                onClick={() => setPanel((p) => (p === "legend" ? null : "legend"))}
              >
                <HelpCircle size={14} strokeWidth={1.5} />
              </PanelButton>

              {isTimelineActive && (
                <button
                  onClick={manual(exitTimeline)}
                  title="Encerrar a linha do tempo"
                  className="ml-1 flex h-8 items-center gap-1.5 rounded-lg border border-st-error px-3 text-xs text-st-error transition-colors hover:bg-st-error/10"
                >
                  <X size={13} strokeWidth={1.5} />
                  Encerrar
                </button>
              )}
            </div>
          </div>

          {executionError && (
            <div className="mt-3 rounded-lg border border-st-error px-3 py-2 text-xs text-st-error">
              {executionError}
            </div>
          )}

          {isTimelineActive && (
            <div className="mt-3">
              {/* The range input is transparent; the rules underneath draw the
                  track so it follows the theme. */}
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
                  onChange={(event) => {
                    pause();
                    goToTick(Number(event.target.value));
                  }}
                  aria-label="Tick"
                  className="timeline-slider absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

function PanelButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  // Escape closes the panel and puts focus back on the button that opened it.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClick();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClick]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-expanded={active}
      title={label}
      className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors ${
        active
          ? "border-line-strong text-fg"
          : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
      }`}
    >
      {children}
      {label}
    </button>
  );
}
