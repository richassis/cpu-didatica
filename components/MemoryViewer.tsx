"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDisplayStore, formatNum } from "@/lib/displayStore";

/**
 * Read-only view of a whole memory.
 *
 * Both memory widgets only ever showed a window of three words either side of
 * the addressed one, and the only thing clicking offered was to *edit* the word
 * you clicked. So the contents of memory — the thing a student most wants to
 * inspect while stepping — could not actually be inspected. This shows all of
 * it and changes none of it.
 *
 * Editing has not disappeared from the product; it moved to edit mode, where
 * setting up an experiment belongs.
 */
export default function MemoryViewer({
  title,
  wordCount,
  bitWidth,
  addrBits,
  currentAddr,
  read,
  decode,
  onClose,
}: {
  title: string;
  wordCount: number;
  bitWidth: number;
  addrBits: number;
  /** Address currently on the memory's address port, highlighted and scrolled to. */
  currentAddr: number;
  read: (addr: number) => number;
  /** Optional second column — instruction memory renders mnemonics. */
  decode?: (word: number) => string;
  onClose: () => void;
}) {
  const base = useDisplayStore((s) => s.numericBase);
  const currentRowRef = useRef<HTMLDivElement>(null);

  // Read straight through on every render rather than memoising: `read` closes
  // over the live simulator object, so a cache keyed on anything but "now"
  // would show stale words while the student steps the clock behind the modal.
  const rows = Array.from({ length: wordCount }, (_, addr) => ({ addr, value: read(addr) }));

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: "center" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fmtAddr = (addr: number) =>
    "0x" + addr.toString(16).toUpperCase().padStart(Math.ceil(addrBits / 4), "0");

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title} contents`}
        className="relative z-10 flex max-h-[80vh] w-[420px] flex-col rounded-2xl border border-line bg-surface"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <div className="flex flex-col">
            <span className="t-node text-fg">{title}</span>
            <span className="t-section">
              {wordCount} words · read only
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:text-fg"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {rows.map(({ addr, value }) => {
            const isCurrent = addr === currentAddr;
            return (
              <div
                key={addr}
                ref={isCurrent ? currentRowRef : undefined}
                className="flex items-center gap-3 rounded px-2 py-1"
                style={
                  isCurrent
                    ? { background: "color-mix(in srgb, var(--st-data) 10%, transparent)" }
                    : undefined
                }
              >
                <span
                  className={`shrink-0 font-mono text-[10px] leading-none ${
                    isCurrent ? "text-fg" : "text-transparent"
                  }`}
                  aria-hidden
                >
                  ▶
                </span>
                <span className="num w-16 shrink-0 font-mono text-[11px] text-fg-faint">
                  {fmtAddr(addr)}
                </span>
                <span
                  className={`num flex-1 text-right font-mono text-[12px] ${
                    isCurrent ? "text-fg" : "text-fg-muted"
                  }`}
                >
                  {formatNum(value, base, bitWidth)}
                </span>
                {decode && (
                  <span
                    className={`w-16 shrink-0 text-right font-mono text-[11px] ${
                      isCurrent ? "text-fg" : "text-fg-faint"
                    }`}
                  >
                    {decode(value)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
