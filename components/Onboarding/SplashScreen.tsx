"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { CREDITS } from "@/lib/helpContent";
import { useT } from "@/lib/i18n";

/**
 * Wires in the simulator's own right-angle style, running across the screen.
 * Each is a path in a 1200 x 700 box scaled to cover the viewport, and the
 * dots ride along the same paths.
 */
const WIRES = [
  { id: "a", d: "M0 150 H200 V90 H520 V150 H800 V70 H1200", color: "var(--st-data)", dur: 10, begin: 0 },
  { id: "b", d: "M0 600 H180 V540 H480 V620 H760 V560 H1200", color: "var(--st-data)", dur: 11, begin: 2 },
  { id: "c", d: "M120 700 V380 H240 V120 H320 V0", color: "var(--st-active)", dur: 8, begin: 1 },
  { id: "d", d: "M1200 400 H1010 V300 H1080 V0", color: "var(--st-active)", dur: 9, begin: 3 },
];

// Kept to the edges: the middle of the screen belongs to the title and the credits.
const NODES = [
  { x: 170, y: 76, w: 66, h: 28 },
  { x: 490, y: 136, w: 66, h: 28 },
  { x: 770, y: 56, w: 66, h: 28 },
  { x: 150, y: 526, w: 66, h: 28 },
  { x: 450, y: 606, w: 66, h: 28 },
  { x: 730, y: 546, w: 66, h: 28 },
  { x: 90, y: 366, w: 66, h: 28 },
  { x: 980, y: 286, w: 66, h: 28 },
];

/**
 * The first screen: the title and the credits, and nothing else to read. The
 * datapath drawn behind it is only a hint of what the simulator does — low
 * contrast, so it never competes with the text — and stands still when the
 * system asks for reduced motion.
 */
export default function SplashScreen({ onContinue }: { onContinue: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = useT().onboarding.splash;

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={CREDITS.project}
      onClick={onContinue}
      className="fixed inset-0 z-[9998] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-canvas px-6 text-center"
    >
      {/* Soft glow behind the title. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 48%, color-mix(in srgb, var(--st-active) 11%, transparent), transparent 70%)",
        }}
      />

      <svg
        aria-hidden
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
      >
        {WIRES.map((w) => (
          <path key={w.id} id={`splash-${w.id}`} d={w.d} fill="none" stroke="var(--border)" strokeWidth={1.5} />
        ))}
        {NODES.map((n) => (
          <rect
            key={`${n.x}-${n.y}`}
            x={n.x}
            y={n.y}
            width={n.w}
            height={n.h}
            rx={6}
            fill="var(--canvas)"
            stroke="var(--border-strong)"
            strokeWidth={1.5}
          />
        ))}
        <g className="splash-dots">
          {WIRES.map((w) => (
            <circle key={w.id} r={5} fill={w.color}>
              <animateMotion dur={`${w.dur}s`} begin={`${w.begin}s`} repeatCount="indefinite">
                <mpath href={`#splash-${w.id}`} />
              </animateMotion>
            </circle>
          ))}
        </g>
      </svg>

      <div className="relative z-10 flex flex-col items-center">
        <h1
          className="splash-rise font-sans text-fg"
          style={{
            fontSize: "clamp(3rem, 11vw, 8rem)",
            fontWeight: 300,
            letterSpacing: "0.02em",
            lineHeight: 1,
            "--d": "0.1s",
          } as React.CSSProperties}
        >
          {CREDITS.project}
        </h1>
        <p
          className="splash-rise mt-4 text-ui tracking-[0.18em] text-fg-muted uppercase"
          style={{ "--d": "0.45s" } as React.CSSProperties}
        >
          {t.subtitle}
        </p>

        <div
          className="splash-rise mt-10 h-px w-24 bg-line-strong"
          style={{ "--d": "0.8s" } as React.CSSProperties}
        />

        <div
          className="splash-rise mt-8 space-y-1.5 text-small leading-relaxed text-fg-muted"
          style={{ "--d": "1.05s" } as React.CSSProperties}
        >
          <p>
            {t.projectOf} <span className="text-fg">{CREDITS.universityShort}</span> · {CREDITS.center} · {CREDITS.year}
          </p>
          <p>
            {t.professor} <span className="text-fg">{CREDITS.professor}</span> · {t.student}{" "}
            <span className="text-fg">{CREDITS.student}</span>
          </p>
        </div>

        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            onContinue();
          }}
          className="splash-rise mt-12 inline-flex h-10 items-center gap-2 rounded-full border border-st-active px-6 text-ui text-fg transition-colors hover:bg-st-active/10"
          style={{ "--d": "1.4s" } as React.CSSProperties}
        >
          {t.continue}
          <ArrowRight size={16} strokeWidth={1.5} className="text-st-active" />
        </button>
        <p
          className="splash-rise mt-3 text-micro text-fg-faint"
          style={{ "--d": "1.6s" } as React.CSSProperties}
        >
          {t.continueHint}
        </p>
      </div>
    </div>
  );
}
