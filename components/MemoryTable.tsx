"use client";

import { useEffect, useRef } from "react";
import { useDisplayStore, formatNum } from "@/lib/displayStore";

/**
 * The scrollable address→value list shared by the edit-mode modal
 * (`MemoryViewer`) and the Program Mode side panel (`MemoryPanel`).
 *
 * Read-only. `read` closes over the live simulator object, so the rows are read
 * straight through on every render — a cache keyed on anything but "now" would
 * show stale words while the clock steps behind it.
 */
export default function MemoryTable({
  wordCount,
  bitWidth,
  addrBits,
  currentAddr,
  read,
  decode,
  scrollBlock = "center",
}: {
  wordCount: number;
  bitWidth: number;
  addrBits: number;
  /** Address on the memory's address port — highlighted and scrolled to. */
  currentAddr: number;
  read: (addr: number) => number;
  /** Optional second column — instruction memory renders mnemonics. */
  decode?: (word: number) => string;
  scrollBlock?: ScrollLogicalPosition;
}) {
  const base = useDisplayStore((s) => s.numericBase);
  const currentRowRef = useRef<HTMLDivElement>(null);

  const rows = Array.from({ length: wordCount }, (_, addr) => ({ addr, value: read(addr) }));

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: scrollBlock });
  }, [currentAddr, scrollBlock]);

  const fmtAddr = (addr: number) =>
    "0x" + addr.toString(16).toUpperCase().padStart(Math.ceil(addrBits / 4), "0");

  return (
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
  );
}
