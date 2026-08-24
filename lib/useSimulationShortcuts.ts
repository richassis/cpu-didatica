"use client";

import { useEffect } from "react";
import { useExecutionStore } from "./executionStore";
import { usePlaybackStore } from "./playbackStore";

/**
 * Keyboard transport for program mode.
 *
 * Stepping used to work only while the timeline card itself held focus, which
 * meant clicking the canvas silently disabled it. These are document-level, so
 * the shortcuts work wherever the student is looking.
 *
 * The assembly editor sits beside the canvas, so anything typed into a text
 * field has to be left alone — otherwise the arrow keys stop moving the caret
 * and space stops inserting a space, which is a far worse bug than the one this
 * fixes.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export default function useSimulationShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const execution = useExecutionStore.getState();
      if (!execution.isTimelineActive) return;

      const playback = usePlaybackStore.getState();

      switch (event.key) {
        case " ":
        case "Spacebar":
          event.preventDefault();
          playback.toggle();
          break;
        case "ArrowRight":
          event.preventDefault();
          playback.pause();
          execution.stepForward();
          break;
        case "ArrowLeft":
          event.preventDefault();
          playback.pause();
          execution.stepBackward();
          break;
        case "Home":
          event.preventDefault();
          playback.pause();
          execution.goToStart();
          break;
        case "End":
          event.preventDefault();
          playback.pause();
          execution.goToEnd();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
