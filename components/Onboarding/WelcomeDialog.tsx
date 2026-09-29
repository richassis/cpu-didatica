"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircuitBoard, Hammer, Play } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboardingStore";
import { useHelpStore } from "@/lib/helpStore";
import SplashScreen from "@/components/Onboarding/SplashScreen";

const POINTS = [
  { icon: CircuitBoard, title: "Escreva em assembly", body: "Um programa curto, ou um dos exemplos prontos." },
  { icon: Hammer, title: "Monte e simule", body: "Veja o texto virar palavras de 16 bits e o programa rodar." },
  { icon: Play, title: "Acompanhe cada tick", body: "Os valores viajam pelo caminho de dados, passo a passo." },
];

/**
 * The first thing a new visitor meets, and again whenever they ask for it in
 * the Help: an opening screen with the title and the credits, then this
 * welcome. It never traps anyone: every way out marks it seen, and the tour it
 * offers is optional.
 */
export default function WelcomeDialog() {
  const welcomeSeen = useOnboardingStore((s) => s.welcomeSeen);
  const welcomeForced = useOnboardingStore((s) => s.welcomeForced);
  const tourActive = useOnboardingStore((s) => s.tourActive);
  const helpOpen = useHelpStore((s) => s.open);

  const open = (!welcomeSeen || welcomeForced) && !tourActive && !helpOpen;
  if (!open || typeof document === "undefined") return null;

  // A separate component, so the flow starts from the opening screen every
  // time it is shown: closing unmounts it and takes the stage with it.
  return <WelcomeFlow />;
}

/** The opening screen first, then the choices. */
function WelcomeFlow() {
  const [stage, setStage] = useState<"splash" | "choices">("splash");
  const dismissWelcome = useOnboardingStore((s) => s.dismissWelcome);
  const startTour = useOnboardingStore((s) => s.startTour);
  const showHelp = useHelpStore((s) => s.show);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (stage === "choices") primaryRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    // Only Esc is handled here. Enter and Space belong to the Continuar button,
    // which has focus: handling them as well would fire twice — once here and
    // once as the button's own click — and skip the welcome screen.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissWelcome();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismissWelcome]);

  if (stage === "splash") return createPortal(<SplashScreen onContinue={() => setStage("choices")} />, document.body);

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: "rgba(0,0,0,0.65)" }} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Boas-vindas"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-surface p-7"
      >
        <div className="t-panel text-fg">Bem-vindo à CPU Didática</div>
        <p className="mt-2 text-ui leading-relaxed text-fg-muted">
          Um simulador para ver, tick a tick, como uma CPU executa um programa: da instrução na
          memória até o resultado gravado no registrador.
        </p>

        <ul className="mt-5 space-y-3">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-st-active">
                <Icon size={16} strokeWidth={1.5} />
              </span>
              <div>
                <div className="t-node text-fg">{title}</div>
                <div className="text-small text-fg-muted">{body}</div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap items-center gap-2">
          <button
            ref={primaryRef}
            onClick={startTour}
            className="h-9 rounded-lg border border-st-active bg-st-active/10 px-4 text-ui text-fg transition-colors hover:bg-st-active/20"
          >
            Fazer o tutorial
          </button>
          <button
            onClick={dismissWelcome}
            className="h-9 rounded-lg border border-line px-4 text-ui text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            Explorar sozinho
          </button>
          <button
            onClick={() => {
              dismissWelcome();
              showHelp();
            }}
            className="h-9 px-2 text-ui text-fg-faint transition-colors hover:text-fg"
          >
            Abrir a ajuda
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
