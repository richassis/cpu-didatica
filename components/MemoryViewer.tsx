"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import MemoryTable from "@/components/MemoryTable";

/**
 * Read-only view of a whole memory, as a modal.
 *
 * This is the edit-mode surface — in Program Mode the same contents open in the
 * side panel instead (`MemoryPanel`), so the datapath stays visible while the
 * student reads the values. Editing lives in edit mode, where setting up an
 * experiment belongs.
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
  currentAddr: number;
  read: (addr: number) => number;
  decode?: (word: number) => string;
  onClose: () => void;
}) {
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
            <span className="t-section">{wordCount} words · read only</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:text-fg"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <MemoryTable
          wordCount={wordCount}
          bitWidth={bitWidth}
          addrBits={addrBits}
          currentAddr={currentAddr}
          read={read}
          decode={decode}
        />
      </div>
    </div>,
    document.body
  );
}
