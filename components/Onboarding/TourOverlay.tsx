"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOnboardingStore } from "@/lib/onboardingStore";
import { TOUR_STEPS, nextApplicable, previousApplicable } from "@/lib/tourSteps";

/** Air between the lit element and the edge of the cut-out. */
const PAD = 6;
/** Gap between the cut-out and the balloon. */
const GAP = 14;
const MARGIN = 12;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5);

/**
 * Where the balloon goes: beside the lit element on the side with room, or —
 * when the element fills most of the screen — inside it, low and centred.
 */
function placeBalloon(target: Box | null, card: { width: number; height: number }): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.max(MARGIN, Math.min(vw - card.width - MARGIN, x));
  const clampY = (y: number) => Math.max(MARGIN, Math.min(vh - card.height - MARGIN, y));

  if (!target) return { left: (vw - card.width) / 2, top: (vh - card.height) / 2 };

  const centreX = target.left + target.width / 2 - card.width / 2;
  const centreY = target.top + target.height / 2 - card.height / 2;
  const below = target.top + target.height + GAP;
  const above = target.top - GAP - card.height;
  const right = target.left + target.width + GAP;
  const left = target.left - GAP - card.width;

  if (below + card.height + MARGIN <= vh) return { left: clampX(centreX), top: below };
  if (above >= MARGIN) return { left: clampX(centreX), top: above };
  if (right + card.width + MARGIN <= vw) return { left: right, top: clampY(centreY) };
  if (left >= MARGIN) return { left, top: clampY(centreY) };
  return { left: clampX(centreX), top: clampY(target.top + target.height - card.height - MARGIN * 2) };
}

/**
 * The guided tour: the whole screen goes dark except the element being
 * explained, and a balloon says what it is. A step that asks for a click leaves
 * the cut-out open so the student presses the real button; every other step
 * covers it, so nothing is triggered by accident.
 *
 * The lit element is measured on every frame. It moves — the canvas follows the
 * zoom, the code region changes width when a run starts — and a cut-out that
 * lags behind it is worse than none.
 */
export default function TourOverlay() {
  const active = useOnboardingStore((s) => s.tourActive);
  const stepIndex = useOnboardingStore((s) => s.stepIndex);
  const goToStep = useOnboardingStore((s) => s.goToStep);
  const endTour = useOnboardingStore((s) => s.endTour);

  const step = TOUR_STEPS[stepIndex];
  const [box, setBox] = useState<Box | null>(null);
  const [cardSize, setCardSize] = useState({ width: 352, height: 180 });
  const cardRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const lastBox = useRef<Box | null>(null);

  const advance = useCallback(() => {
    const next = nextApplicable(stepIndex);
    if (next === -1) endTour();
    else goToStep(next);
  }, [stepIndex, goToStep, endTour]);

  const back = useCallback(() => {
    const prev = previousApplicable(stepIndex);
    if (prev !== -1) goToStep(prev);
  }, [stepIndex, goToStep]);

  // Remember what had focus, and give it back when the tour ends.
  useEffect(() => {
    if (!active) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    return () => openerRef.current?.focus?.();
  }, [active]);

  // Measure the target every frame, and notice when a step's action was done.
  useEffect(() => {
    if (!active || !step) return;
    let frame = 0;

    const tick = () => {
      if (step.action?.done()) {
        advance();
        return;
      }

      const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
      let next: Box | null = null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          next = {
            left: r.left - PAD,
            top: r.top - PAD,
            width: r.width + PAD * 2,
            height: r.height + PAD * 2,
          };
        }
      }
      if (!sameBox(lastBox.current, next)) {
        lastBox.current = next;
        setBox(next);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, step, advance]);

  // A new step starts with focus on the balloon.
  useLayoutEffect(() => {
    if (active) cardRef.current?.focus({ preventScroll: true });
  }, [active, stepIndex]);

  // The balloon's size decides where it goes, and changes with each step's text.
  useEffect(() => {
    const el = cardRef.current;
    if (!active || !el) return;
    const observer = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setCardSize((prev) =>
        Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
          ? prev
          : { width: r.width, height: r.height },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        endTour();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        // A step that waits for a click is not skipped by accident.
        if (TOUR_STEPS[stepIndex]?.action) return;
        e.preventDefault();
        e.stopPropagation();
        advance();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        back();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [active, stepIndex, advance, back, endTour]);

  if (!active || !step || typeof document === "undefined") return null;

  const isLast = nextApplicable(stepIndex) === -1;
  const hasPrev = previousApplicable(stepIndex) !== -1;
  const openHole = Boolean(step.action) && box !== null;
  const position = placeBalloon(box, cardSize);

  // Numbering counts the steps already passed and those still to come that
  // apply, so a step done by the student's own click (Montar) still counts and
  // the numbers never jump.
  const applicable = TOUR_STEPS.map((s, i) => ({ s, i })).filter(({ s, i }) => i <= stepIndex || !s.applicable || s.applicable());
  const position1 = applicable.findIndex(({ i }) => i === stepIndex) + 1;

  const blocker = "fixed z-[10000] bg-transparent";

  return createPortal(
    <div>
      {box ? (
        <>
          {/* Four blocks around the cut-out keep every click away from the app. */}
          <div className={blocker} style={{ left: 0, top: 0, width: "100vw", height: Math.max(0, box.top) }} />
          <div className={blocker} style={{ left: 0, top: box.top + box.height, width: "100vw", bottom: 0 }} />
          <div className={blocker} style={{ left: 0, top: box.top, width: Math.max(0, box.left), height: box.height }} />
          <div className={blocker} style={{ left: box.left + box.width, top: box.top, right: 0, height: box.height }} />
          {/* Unless the step asks for a click, the cut-out is covered as well. */}
          {!openHole && (
            <div className={blocker} style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />
          )}
          {/* The shade, and the ring around what is lit. */}
          <div
            className="pointer-events-none fixed z-[10000] rounded-xl"
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
              boxShadow: "0 0 0 200vmax rgba(0, 0, 0, 0.7)",
              outline: "2px solid var(--st-active)",
              outlineOffset: 0,
              transition: "left 0.2s ease, top 0.2s ease, width 0.2s ease, height 0.2s ease",
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 z-[10000]" style={{ background: "rgba(0, 0, 0, 0.7)" }} />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Tutorial: ${step.title}`}
        tabIndex={-1}
        className="fixed z-[10001] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-line-strong bg-surface p-4 outline-none"
        style={{ left: position.left, top: position.top }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="t-node text-fg">{step.title}</div>
          <div className="shrink-0 font-mono text-micro text-fg-faint">
            {position1} de {applicable.length}
          </div>
        </div>
        <p className="mt-2 text-small leading-relaxed text-fg-muted">{step.body}</p>
        {step.action && (
          <p className="mt-2 text-small leading-snug text-st-active">{step.action.hint}</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => endTour()}
            className="text-small text-fg-faint transition-colors hover:text-fg"
          >
            Pular tutorial
          </button>
          <div className="flex items-center gap-2">
            {hasPrev && (
              <button
                onClick={back}
                className="h-8 rounded-lg border border-line px-3 text-small text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
              >
                Voltar
              </button>
            )}
            {step.action ? (
              <button
                onClick={step.action.run}
                className="h-8 rounded-lg border border-line px-3 text-small text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
              >
                {step.action.label}
              </button>
            ) : (
              <button
                onClick={advance}
                className="h-8 rounded-lg border border-st-active bg-st-active/10 px-3 text-small text-fg transition-colors hover:bg-st-active/20"
              >
                {isLast ? "Concluir" : "Próximo"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
