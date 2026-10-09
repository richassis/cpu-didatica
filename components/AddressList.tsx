"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { useDisplayStore, formatPortValue } from "@/lib/displayStore";
import { addrBitsFor, fmtAddr, ADDRESS_HIGHLIGHT_BG } from "@/lib/memoryFormat";

/**
 * - `canvas`: inside a memory widget on the datapath; sized in `text-cv-*` so it
 *   follows the canvas, and the addressed word grows a step.
 * - `panel`: the edit-mode modal (`MemoryViewer`).
 * - `compact`: the narrow side-by-side columns of the memory panel.
 */
export type AddressListDensity = "canvas" | "panel" | "compact";

const CHROME = {
  panel: { gap: "gap-3", pad: "px-4", listPad: "px-2", addrW: "w-16", decodeW: "w-16", nameW: "w-20" },
  compact: { gap: "gap-1.5", pad: "px-3", listPad: "px-1", addrW: "w-10", decodeW: "w-14", nameW: "w-16" },
} as const;

/**
 * Every word of a memory, address → value, with a cursor on the word at the
 * address port that the list keeps scrolled into view. One list for the canvas
 * memories, the memory panel and the modal viewer, so they cannot drift apart.
 *
 * Read-only unless `renderEditor` is given. `read` closes over the live
 * simulator object, so the rows are read straight through on every render — a
 * cache keyed on anything but "now" would show stale words while the clock
 * steps behind it.
 */
export default function AddressList({
  wordCount,
  bitWidth,
  currentAddr,
  read,
  unsigned = false,
  density,
  scrollBlock = "nearest",
  decode,
  name,
  headers,
  onRowClick,
  renderEditor,
}: {
  wordCount: number;
  bitWidth: number;
  /** Address on the memory's address port — highlighted and scrolled to. */
  currentAddr: number;
  read: (addr: number) => number;
  /** Instruction words are encodings, never signed data (see `formatPortValue`). */
  unsigned?: boolean;
  density: AddressListDensity;
  scrollBlock?: ScrollLogicalPosition;
  /** Optional second column — instruction memory renders mnemonics. Not on the canvas. */
  decode?: (word: number) => string;
  /** Optional last column — data memory renders the `.data` variable at each address. Not on the canvas. */
  name?: (addr: number) => string | undefined;
  /** Column captions above the rows. Not on the canvas. */
  headers?: { addr: string; word: string; decode?: string; name?: string };
  onRowClick?: (addr: number) => void;
  /** Canvas only: replaces each row with an editor (data memory's edit mode). */
  renderEditor?: (addr: number, value: number, isCurrent: boolean) => ReactNode;
}) {
  const base = useDisplayStore((s) => s.numericBase);
  const currentRowRef = useRef<HTMLDivElement>(null);
  const addrBits = addrBitsFor(wordCount);
  const addrs = Array.from({ length: wordCount }, (_, a) => a);

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: scrollBlock });
  }, [currentAddr, scrollBlock]);

  const marker = (isCurrent: boolean, size: string) => (
    <span
      className={`shrink-0 font-mono ${size} leading-none ${isCurrent ? "text-fg" : "text-transparent"}`}
      aria-hidden
    >
      ▶
    </span>
  );

  const rowProps = (addr: number, isCurrent: boolean) => ({
    ref: isCurrent ? currentRowRef : undefined,
    style: isCurrent ? { background: ADDRESS_HIGHLIGHT_BG } : undefined,
    onClick: onRowClick
      ? (e: React.MouseEvent) => {
          e.stopPropagation();
          onRowClick(addr);
        }
      : undefined,
  });

  if (density === "canvas") {
    if (renderEditor) {
      return (
        <div
          className="flex-1 overflow-y-auto px-1.5 py-1"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {addrs.map((a) => (
            <Fragment key={a}>{renderEditor(a, read(a), a === currentAddr)}</Fragment>
          ))}
        </div>
      );
    }
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 py-1 pl-3"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {addrs.map((a) => {
          const isCurrent = a === currentAddr;
          return (
            <div
              key={a}
              {...rowProps(a, isCurrent)}
              className={`flex shrink-0 items-center gap-1.5 rounded px-1 py-[2px] transition-colors ${
                onRowClick ? "cursor-pointer" : ""
              }`}
            >
              {marker(isCurrent, "text-cv-xs")}
              <span className="num shrink-0 font-mono text-cv-sm text-fg-faint">
                {fmtAddr(a, addrBits)}
              </span>
              <span
                className={`num flex-1 text-right font-mono ${
                  isCurrent ? "text-cv-md text-fg" : "text-cv-sm text-fg-muted"
                }`}
              >
                {formatPortValue(read(a), base, bitWidth, unsigned)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  const { gap, pad, listPad, addrW, decodeW, nameW } = CHROME[density];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {headers && (
        <div
          className={`flex shrink-0 items-center ${gap} border-b border-line ${pad} py-1 font-mono text-caption text-fg-faint`}
        >
          <span aria-hidden className="w-2.5 shrink-0" />
          <span className={`${addrW} shrink-0`}>{headers.addr}</span>
          <span className="flex-1 text-right">{headers.word}</span>
          {decode && <span className={`${decodeW} shrink-0 text-right`}>{headers.decode}</span>}
          {name && <span className={`${nameW} shrink-0 truncate`}>{headers.name}</span>}
        </div>
      )}
      <div className={`min-h-0 flex-1 overflow-y-auto ${listPad} py-2`}>
        {addrs.map((a) => {
          const isCurrent = a === currentAddr;
          const value = read(a);
          const side = isCurrent ? "text-fg" : "text-fg-faint";
          return (
            <div
              key={a}
              {...rowProps(a, isCurrent)}
              className={`flex items-center ${gap} rounded px-1.5 py-1 ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {marker(isCurrent, "text-caption")}
              <span className={`num ${addrW} shrink-0 font-mono text-small text-fg-faint`}>
                {fmtAddr(a, addrBits)}
              </span>
              <span
                className={`num flex-1 text-right font-mono text-ui ${
                  isCurrent ? "text-fg" : "text-fg-muted"
                }`}
              >
                {formatPortValue(value, base, bitWidth, unsigned)}
              </span>
              {decode && (
                <span className={`${decodeW} shrink-0 text-right font-mono text-small ${side}`}>
                  {decode(value)}
                </span>
              )}
              {name && (
                <span
                  className={`${nameW} shrink-0 truncate font-mono text-small ${side}`}
                  title={name(a)}
                >
                  {name(a)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
