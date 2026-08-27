"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { List } from "lucide-react";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useCanvasEditing } from "@/components/CanvasEditingContext";
import { useDisplayStore, formatNum } from "@/lib/displayStore";
import { EDITOR_ENABLED } from "@/lib/editorFlag";
import NodeShell from "@/components/widgets/NodeShell";
import MemoryViewer from "@/components/MemoryViewer";
import InstructionBuilder from "@/components/InstructionBuilder";
import { decodeMnemonic } from "@/lib/disassemble";

function fmtAddr(addr: number, addrBits: number) {
  return "0x" + addr.toString(16).toUpperCase().padStart(Math.ceil(addrBits / 4), "0");
}

/**
 * Instruction memory. Same shape family as data memory — a spine and a full,
 * scrollable address list — because they are the same class of thing.
 *
 * The list shows the raw stored word, not its mnemonic: the mnemonic already
 * lives in the source and in the Montagem panel, and a memory that displayed
 * decoded meaning instead of stored bits would misrepresent what memory
 * actually holds. The mnemonic survives as a secondary column in the full
 * listing (`MemoryViewer`'s `decode` prop) and in the compact headline.
 *
 * A row opens the full read-only listing. Hand-assembling a word with the
 * instruction builder is an authoring act and stays in edit mode; in program
 * mode the program comes from the assembler, and this is for reading it.
 */
export default function InstructionMemoryComponent({ component, zoom }: Props) {
  const { id } = component;
  const [builderOpen, setBuilderOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(0);
  const canEdit = useCanvasEditing();
  const base = useDisplayStore((s) => s.numericBase);
  const currentRowRef = useRef<HTMLDivElement>(null);

  const revision = useSimulatorStore((s) => s.revision);
  const imem = useSimulatorStore((s) => s.getInstructionMemory(id));
  void revision;

  const wordCount = imem?.wordCount ?? 256;
  const bitWidth = imem?.bitWidth ?? 16;
  const addrBits = Math.max(1, Math.ceil(Math.log2(wordCount)));
  const currentAddr = imem?.in_addr.value ?? 0;

  const readWord = useCallback((addr: number) => imem?.peek(addr) ?? 0, [imem]);

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentAddr]);

  return (
    <>
      <NodeShell
        component={component}
        zoom={zoom}
        sequential
        spine
        dense
        value={decodeMnemonic(imem?.peek(currentAddr) ?? 0)}
        compactValue
        actions={
          <>
            <span className="num shrink-0 font-mono text-[10px] text-fg-muted">
              {fmtAddr(currentAddr, addrBits)}
            </span>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setViewerOpen(true);
              }}
              className="shrink-0 rounded p-0.5 text-fg-faint transition-colors hover:text-fg"
              title="View the whole program"
            >
              <List size={12} strokeWidth={1.5} />
            </button>
          </>
        }
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 py-1 pl-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {Array.from({ length: wordCount }, (_, a) => a).map((a) => {
            const isCurrent = a === currentAddr;
            return (
              <div
                key={a}
                ref={isCurrent ? currentRowRef : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAddress(a);
                  if (canEdit) setBuilderOpen(true);
                  else setViewerOpen(true);
                }}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded px-1 py-[2px] transition-colors"
                style={
                  isCurrent
                    ? { background: "color-mix(in srgb, var(--st-data) 8%, transparent)" }
                    : undefined
                }
              >
                <span
                  className={`shrink-0 font-mono text-[9px] leading-none ${
                    isCurrent ? "text-fg" : "text-transparent"
                  }`}
                >
                  ▶
                </span>
                <span className="num shrink-0 font-mono text-[11px] text-fg-faint">
                  {fmtAddr(a, addrBits)}
                </span>
                <span
                  className={`num flex-1 text-right font-mono ${
                    isCurrent ? "text-[12.5px] text-fg" : "text-[11px] text-fg-muted"
                  }`}
                >
                  {formatNum(imem?.peek(a) ?? 0, base, bitWidth)}
                </span>
              </div>
            );
          })}
        </div>
      </NodeShell>

      {viewerOpen && (
        <MemoryViewer
          title={component.label}
          wordCount={wordCount}
          bitWidth={bitWidth}
          addrBits={addrBits}
          currentAddr={currentAddr}
          read={readWord}
          decode={decodeMnemonic}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {EDITOR_ENABLED &&
        builderOpen &&
        canEdit &&
        imem &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setBuilderOpen(false)}
            />
            <div className="relative z-10">
              <InstructionBuilder
                imem={imem}
                onClose={() => setBuilderOpen(false)}
                initialAddress={selectedAddress}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
