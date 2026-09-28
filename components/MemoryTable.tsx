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
  compact = false,
  headers,
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
  /** Tighter columns, for the narrow side-by-side memory panel. */
  compact?: boolean;
  /** Column captions above the rows. */
  headers?: { addr: string; word: string; decode?: string };
}) {
  const gap = compact ? "gap-1.5" : "gap-3";
  const addrW = compact ? "w-10" : "w-16";
  const decodeW = compact ? "w-14" : "w-16";
  const base = useDisplayStore((s) => s.numericBase);
  const currentRowRef = useRef<HTMLDivElement>(null);

  const rows = Array.from({ length: wordCount }, (_, addr) => ({ addr, value: read(addr) }));

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: scrollBlock });
  }, [currentAddr, scrollBlock]);

  const fmtAddr = (addr: number) =>
    "0x" + addr.toString(16).toUpperCase().padStart(Math.ceil(addrBits / 4), "0");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {headers && (
        <div
          className={`flex shrink-0 items-center ${gap} border-b border-line ${
            compact ? "px-3" : "px-4"
          } py-1 font-mono text-[10px] text-fg-faint`}
        >
          <span aria-hidden className="w-2.5 shrink-0" />
          <span className={`${addrW} shrink-0`}>{headers.addr}</span>
          <span className="flex-1 text-right">{headers.word}</span>
          {decode && <span className={`${decodeW} shrink-0 text-right`}>{headers.decode}</span>}
        </div>
      )}
      <div className={`min-h-0 flex-1 overflow-y-auto ${compact ? "px-1" : "px-2"} py-2`}>
      {rows.map(({ addr, value }) => {
        const isCurrent = addr === currentAddr;
        return (
          <div
            key={addr}
            ref={isCurrent ? currentRowRef : undefined}
            className={`flex items-center ${gap} rounded px-1.5 py-1`}
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
            <span className={`num ${addrW} shrink-0 font-mono text-[11px] text-fg-faint`}>
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
                className={`${decodeW} shrink-0 text-right font-mono text-[11px] ${
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
  );
}
