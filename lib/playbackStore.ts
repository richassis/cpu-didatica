/**
 * playbackStore.ts
 *
 * Continuous playback of the execution timeline.
 *
 * Before this existed the only way to reach the end of a program was to press
 * "forward" once per tick, or to press "go to end" — which is a single seek that
 * skips every intermediate frame and every animation with it. Neither shows the
 * student what the machine did along the way.
 *
 * Playback advances one tick at a time, chained to the *completion of the
 * previous tick's animation* rather than to a fixed interval. That matters
 * because a tick is not a constant length: it costs
 * `(control signals changed ? D : 0) + D × number of substeps`, so a FETCH and a
 * HALT take very different amounts of time. Pacing on a timer would either cut
 * animations short or leave dead air between them.
 *
 * The completion signal comes from EnhancedBusOverlay, which owns the animation
 * pass. See `notifyTickAnimationComplete`.
 */

import { create } from "zustand";
import { useExecutionStore } from "./executionStore";
import { useDisplayStore } from "./displayStore";

/**
 * Beat between the end of one tick's animation and the start of the next.
 *
 * It is never zero, for two independent reasons:
 *  - the completion signal can fire *inside* the overlay's effect (when the
 *    animation is switched off there is nothing to wait for), and advancing the
 *    timeline from there would re-enter that effect while it is still running;
 *  - at instant speed a program of several hundred ticks would otherwise run as
 *    one synchronous burst and lock the tab.
 */
const INTER_TICK_PAUSE_MS = 60;

interface PlaybackState {
  /** True while the timeline is advancing on its own. */
  isPlaying: boolean;

  play: () => void;
  pause: () => void;
  toggle: () => void;

  /**
   * Called by the wire-animation overlay when a tick's animation pass ends.
   *
   * Must be called from *every* path that ends a pass, including the ones that
   * end it immediately (animation disabled, nothing to animate). If a path
   * stays silent, playback stops there and looks like a freeze.
   */
  notifyTickAnimationComplete: () => void;
}

/** Handle of the pending advance, so pause() can cancel it. */
let advanceTimer: number | null = null;

/**
 * Backstop for a completion signal that never arrives.
 *
 * Playback waits on the animation to report itself finished, which makes a lost
 * signal indistinguishable from a very slow tick — the run simply stops with
 * the button still reading "Pause". That is the worst failure mode this feature
 * has, so rather than trust the chain completely, a generously-sized timer
 * advances anyway. A tick that animates for longer than its own worst case is
 * over as far as the student is concerned.
 */
let watchdogTimer: number | null = null;

function clearAdvance() {
  if (advanceTimer !== null) {
    window.clearTimeout(advanceTimer);
    advanceTimer = null;
  }
  if (watchdogTimer !== null) {
    window.clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

/**
 * Longest a single tick can reasonably animate: the per-step duration times a
 * generous substep count, plus a floor for the short ones.
 */
function watchdogDelay(): number {
  const perStep = useDisplayStore.getState().animationDurationMs;
  return Math.max(2000, perStep * 12);
}

/** Advance one tick if playback is still running, or stop at the end. */
function advance(set: (partial: { isPlaying: boolean }) => void, isPlaying: () => boolean) {
  if (!isPlaying()) return;

  const execution = useExecutionStore.getState();
  if (!execution.isTimelineActive) {
    set({ isPlaying: false });
    return;
  }
  if (!execution.canGoForward) {
    // Reached the end — stop rather than loop, so the final state stays up.
    set({ isPlaying: false });
    return;
  }

  execution.stepForward();

  // Re-arm the backstop for the tick just started.
  if (watchdogTimer !== null) window.clearTimeout(watchdogTimer);
  watchdogTimer = window.setTimeout(() => {
    watchdogTimer = null;
    advance(set, isPlaying);
  }, watchdogDelay());
}

export const usePlaybackStore = create<PlaybackState>()((set, get) => ({
  isPlaying: false,

  play: () => {
    const execution = useExecutionStore.getState();
    if (!execution.isTimelineActive) return;

    // Pressing play at the end restarts from the top; otherwise the button
    // would look broken on the last tick.
    if (!execution.canGoForward) {
      execution.goToStart();
    }

    set({ isPlaying: true });

    // Kick the chain off. The current tick's animation may already have
    // finished (the student paused, looked around, then pressed play), in which
    // case no completion signal is coming and nothing would ever start.
    clearAdvance();
    advanceTimer = window.setTimeout(() => {
      advanceTimer = null;
      advance(set, () => get().isPlaying);
    }, INTER_TICK_PAUSE_MS);
  },

  pause: () => {
    clearAdvance();
    if (get().isPlaying) set({ isPlaying: false });
  },

  toggle: () => {
    if (get().isPlaying) get().pause();
    else get().play();
  },

  notifyTickAnimationComplete: () => {
    if (!get().isPlaying) return;

    clearAdvance();
    advanceTimer = window.setTimeout(() => {
      advanceTimer = null;
      advance(set, () => get().isPlaying);
    }, INTER_TICK_PAUSE_MS);
  },
}));
