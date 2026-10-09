"use client";

import { useEffect } from "react";
import { useExecutionStore } from "./executionStore";
import { usePlaybackStore } from "./playbackStore";
import { useMemoryPanelStore } from "./memoryPanelStore";

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
    target.isContentEditable ||
    // A modal window (Ajuda, Salvar) owns the keyboard while it is open: space
    // must activate the focused tab or button, not start the simulation.
    target.closest('[aria-modal="true"]') !== null
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
        case "f":
        case "F":
          // Hold to run the animation faster; released in onKeyUp.
          playback.setBoost(true);
          break;
        default:
          break;
      }
    };

    // Release is handled wherever focus is, and even outside a text field: a key
    // let go after focus moved must not leave the animation sped up.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "f" || event.key === "F") usePlaybackStore.getState().setBoost(false);
    };
    const onBlur = () => usePlaybackStore.getState().setBoost(false);

    // Esc closes the memory panel, with or without the timeline. Listened to in
    // the capture phase so it runs before any window's own Esc handler has
    // closed that window: while a dialog (Ajuda, Ajustes, Salvar, the tour) is
    // open, this Esc is the dialog's, and the panel waits for the next one.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      useMemoryPanelStore.getState().closeMemoryPanel();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
}
