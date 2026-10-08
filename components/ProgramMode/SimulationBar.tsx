"use client";

import { useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FastForward,
  Hammer,
  LoaderCircle,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { useExecutionStore } from "@/lib/executionStore";
import { usePlaybackStore } from "@/lib/playbackStore";
import { useProgramDataStore, mountStatus } from "@/lib/programDataStore";
import TickDisplay from "@/components/ProgramMode/TickDisplay";

/**
 * The single simulation control bar, along the bottom.
 *
 * Everything you do to run a program is here: Montar and Simular on the left,
 * the player centred, the tick counter on the right. Settings, zoom, help and
 * file actions are in the top bar.
 *
 * Montar produces the listing and Simular refuses to run anything that is not
 * a clean, up-to-date mount (`mountStatus`) — two separate steps, which is the
 * point being taught. The accent follows the state: unmounted or stale, Montar
 * is the next thing to press; once the mount is clean it moves to Simular.
 * Never both at once.
 *
 * The CPU phase is deliberately not shown. The control unit owns it, and a
 * second, differently-timed phase readout here once contradicted it.
 *
 * It mounts whenever program mode is up, not only once a timeline exists, so
 * that Montar and Simular are reachable before the first run.
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

  const assemblySource = useProgramDataStore((s) => s.assemblySource);
  const mountedSource = useProgramDataStore((s) => s.mountedSource);
  const assembled = useProgramDataStore((s) => s.assembled);
  const assemblyErrors = useProgramDataStore((s) => s.assemblyErrors);
  const isRunning = useProgramDataStore((s) => s.isRunning);
  const mountProgram = useProgramDataStore((s) => s.mountProgram);
  const runProgram = useProgramDataStore((s) => s.runProgram);

  const isLocked = isTimelineActive || isRunning;
  const status = mountStatus({ mountedSource, assemblySource, assembled, assemblyErrors });
  const canRun = status === "ok" && !isLocked;
  const runTitle = isLocked
    ? "Simulação em andamento"
    : status === "none"
      ? "Monte o programa primeiro"
      : status === "stale"
        ? "Montagem desatualizada — monte de novo"
        : status === "errors"
          ? "Corrija os erros de montagem"
          : "Simular o programa até HLT";

  /**
   * Every manual navigation stops playback first. It cannot live inside
   * `goToTick`, because playback drives that same funnel — the distinction is
   * who asked, and only the UI knows.
   */
  const manual = (action: () => void) => () => {
    pause();
    action();
  };

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
        <div data-tour="bar" className="rounded-2xl border border-line bg-surface px-4 py-3">
          {/* Three areas: build on the left, the player centred, the counter on
              the right. The outer columns share the leftover width equally,
              so the player stays centred whatever either side holds. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <button
                data-tour="montar"
                onClick={() => mountProgram()}
                disabled={isLocked}
                title="Montar (compilar) o código-fonte"
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  status === "ok"
                    ? "border-line text-fg-muted hover:border-line-strong hover:text-fg"
                    : "border-st-active bg-st-active/10 text-fg"
                }`}
              >
                <Hammer size={14} strokeWidth={1.5} className={status === "ok" ? "" : "text-st-active"} />
                Montar
                {status === "stale" && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-st-warn" aria-hidden />
                )}
              </button>

              <button
                data-tour="simular"
                onClick={() => runProgram()}
                disabled={!canRun}
                title={runTitle}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  status === "ok"
                    ? "border-st-active bg-st-active/10 text-fg"
                    : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                {isRunning ? (
                  <LoaderCircle size={14} strokeWidth={1.5} className="animate-spin text-st-active" />
                ) : (
                  <Play size={14} strokeWidth={1.5} className={status === "ok" ? "text-st-active" : ""} />
                )}
                {isRunning ? "Simulando…" : "Simular"}
              </button>

              {!isTimelineActive && (
                <span
                  className={`min-w-0 truncate font-mono text-small ${
                    status === "errors" ? "text-st-error" : "text-fg-faint"
                  }`}
                >
                  {status === "errors"
                    ? `${assemblyErrors.length} ${assemblyErrors.length === 1 ? "erro" : "erros"} de montagem`
                    : status === "ok" && assembled
                      ? `${assembled.listing.length} instruções — simule para percorrer tick a tick`
                      : status === "stale"
                        ? "código alterado — monte de novo"
                        : "monte o programa para simular"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isTimelineActive && (
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
                  <BoostButton />
                  <TransportButton
                    onClick={manual(goToEnd)}
                    disabled={!canGoForward}
                    title="Ir para o fim, sem animar"
                  >
                    <SkipForward size={14} strokeWidth={1.5} />
                  </TransportButton>

                  <span className="num ml-2 font-mono text-xs text-fg-muted">/ {totalTicks}</span>

                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <TickDisplay />
              {isTimelineActive && (
                <button
                  onClick={manual(exitTimeline)}
                  title="Encerrar a linha do tempo"
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-st-error px-3 text-xs text-st-error transition-colors hover:bg-st-error/10"
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

/**
 * Hold to run the animation faster — same animation, sooner, without skipping
 * to the next tick. Momentary on purpose: releasing it, or losing the pointer
 * or the window, always puts the speed back, so it can never stay switched on
 * by accident. The `F` key does the same (`useSimulationShortcuts`).
 */
function BoostButton() {
  const boost = usePlaybackStore((s) => s.boost);
  const setBoost = usePlaybackStore((s) => s.setBoost);

  // The button goes away with the timeline; never leave the clock sped up.
  useEffect(() => () => setBoost(false), [setBoost]);

  return (
    <button
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setBoost(true);
      }}
      onPointerUp={() => setBoost(false)}
      onPointerCancel={() => setBoost(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setBoost(true);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") setBoost(false);
      }}
      title="Segure para acelerar a animação (F)"
      aria-label="Acelerar a animação"
      aria-pressed={boost}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
        boost
          ? "border-st-active text-st-active"
          : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
      }`}
    >
      <FastForward size={14} strokeWidth={1.5} />
    </button>
  );
}
