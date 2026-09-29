"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import GuideTab from "@/components/Help/GuideTab";
import IsaTab from "@/components/Help/IsaTab";
import DatapathTab from "@/components/Help/DatapathTab";
import CreditsTab from "@/components/Help/CreditsTab";
import { CREDITS } from "@/lib/helpContent";

type TabId = "guide" | "isa" | "datapath" | "credits";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "guide", label: "Guia" },
  { id: "isa", label: "ISA" },
  { id: "datapath", label: "Caminho de dados" },
  { id: "credits", label: "Créditos" },
];

const FOCUSABLE = 'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])';

/**
 * The Help window: how to use the simulator, the instruction set it was built
 * for, the datapath and its control, and the credits.
 *
 * It opens over the simulator rather than replacing it, so nothing about a run
 * in progress is lost. Esc or a click outside closes it, focus stays inside
 * while it is open, and goes back to whatever opened it — the Ajuda button —
 * when it closes.
 */
export default function HelpDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("guide");
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    guide: null, isa: null, datapath: null, credits: null,
  });

  // Take focus, and give it back on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    tabRefs.current.guide?.focus();
    return () => opener?.focus?.();
  }, []);

  // A new tab starts at the top.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Keep Tab inside the window.
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length];
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ajuda"
        className="relative z-10 flex h-[min(88vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-surface"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 pt-3">
          <div role="tablist" aria-label="Seções da ajuda" className="flex flex-wrap gap-1">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                role="tab"
                id={`help-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="help-panel"
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-[13px] transition-colors ${
                  tab === t.id
                    ? "border-st-active text-fg"
                    : "border-transparent text-fg-muted hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar a ajuda"
            className="mb-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:text-fg"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <div
          ref={contentRef}
          id="help-panel"
          role="tabpanel"
          aria-labelledby={`help-tab-${tab}`}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
        >
          {tab === "guide" && <GuideTab onClose={onClose} />}
          {tab === "isa" && <IsaTab />}
          {tab === "datapath" && <DatapathTab />}
          {tab === "credits" && <CreditsTab />}
        </div>

        <div className="shrink-0 border-t border-line px-5 py-2 text-center font-mono text-[10px] text-fg-faint">
          {CREDITS.project} · FURG · C3 · {CREDITS.year}
        </div>
      </div>
    </div>,
    document.body,
  );
}
