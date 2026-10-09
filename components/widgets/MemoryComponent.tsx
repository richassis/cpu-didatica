"use client";

import { useState, useRef, useCallback } from "react";
import { List, Pencil } from "lucide-react";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useMemoryPanelStore } from "@/lib/memoryPanelStore";
import { useCanvasEditing } from "@/components/CanvasEditingContext";
import { useDisplayMaskStore } from "@/lib/displayMaskStore";
import { useDisplayStore, formatNum, type NumericBase } from "@/lib/displayStore";
import { addrBitsFor, fmtAddr, ADDRESS_HIGHLIGHT_BG } from "@/lib/memoryFormat";
import NodeShell from "@/components/widgets/NodeShell";
import MemoryViewer from "@/components/MemoryViewer";
import AddressList from "@/components/AddressList";
import { useT } from "@/lib/i18n";

/**
 * Data memory.
 *
 * Anatomy is an address list: faint addresses on the left, values on the
 * right, a cursor on the addressed word and a count of what is scrolled off
 * each end. The spine on the left border is what tells it apart from a
 * register at a glance, before any of this is read.
 */
export default function MemoryComponent({ component, zoom }: Props) {
  const { id } = component;
  const t = useT();
  const [editMode, setEditMode] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  // Poking values is an authoring act, so it belongs to edit mode. In program
  // mode the memory is readable in full and writable nowhere.
  const canEdit = useCanvasEditing();
  const openMemoryPanel = useMemoryPanelStore((s) => s.openMemoryPanel);

  // Program mode: the full listing opens in the side panel so the datapath
  // stays visible. Edit mode has no side panel, so it stays a modal.
  const openListing = () => (canEdit ? setViewerOpen(true) : openMemoryPanel(id));

  const revision = useSimulatorStore((s) => s.revision);
  const mem = useSimulatorStore((s) => s.getMemory(id));
  const pokeMemory = useSimulatorStore((s) => s.pokeMemory);
  const base = useDisplayStore((s) => s.numericBase);
  void revision;

  const wordCount = mem?.wordCount ?? 256;
  const bitWidth = mem?.bitWidth ?? 16;
  const addrBits = addrBitsFor(wordCount);
  const addr = mem?.in_addr.value ?? 0;
  // Enables land with the control signals, ahead of the address and data wires;
  // the headline waits for the component to be revealed so it never pairs the
  // new enable with the previous access's data.
  const revealed = useDisplayMaskStore((s) => s.isRevealed(id));
  const rdMem = revealed && (mem?.in_rdMem.value ?? 0) !== 0;
  const wrMem = revealed && (mem?.in_wrMem.value ?? 0) !== 0;
  const dataIn = mem?.in_data.value ?? 0;
  const dataOut = mem?.output ?? 0;

  const readCell = useCallback((addr: number) => mem?.peek(addr) ?? 0, [mem]);

  return (
    <>
    <NodeShell
      component={component}
      zoom={zoom}
      spine
      dense
      // Survives to mid zoom, where the address list does not.
      value={formatNum(wrMem ? dataIn : dataOut, base, bitWidth)}
      compactValue
      actions={
        <>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openListing();
            }}
            className="shrink-0 rounded p-0.5 text-fg-faint transition-colors hover:text-fg"
            title={t.canvas.memory.viewAll}
          >
            <List size={12} strokeWidth={1.5} />
          </button>
          {(rdMem || wrMem) && (
            <span className="shrink-0 rounded-md border border-st-warn px-1 font-mono text-cv-xs leading-[14px] text-st-warn">
              {wrMem ? "WR" : "RD"}
            </span>
          )}
          {canEdit && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setEditMode((v) => !v);
              }}
              className={`shrink-0 rounded p-0.5 transition-colors ${
                editMode ? "text-st-active" : "text-fg-faint hover:text-fg"
              }`}
              title={editMode ? "Exit edit" : "Edit all cells"}
            >
              <Pencil size={12} strokeWidth={1.5} />
            </button>
          )}
        </>
      }
    >
      <AddressList
        density="canvas"
        wordCount={wordCount}
        bitWidth={bitWidth}
        currentAddr={addr}
        read={readCell}
        renderEditor={
          canEdit && editMode
            ? (a, value, isActive) => (
                <EditRow
                  addr={a}
                  value={value}
                  bitWidth={bitWidth}
                  addrBits={addrBits}
                  base={base}
                  isActive={isActive}
                  onPoke={(a2, v) => pokeMemory(id, a2, v)}
                />
              )
            : undefined
        }
      />
    </NodeShell>

    {viewerOpen && (
      <MemoryViewer
        title={component.label}
        wordCount={wordCount}
        bitWidth={bitWidth}
        currentAddr={addr}
        read={readCell}
        onClose={() => setViewerOpen(false)}
      />
    )}
    </>
  );
}

function EditRow({
  addr,
  value,
  bitWidth,
  addrBits,
  base,
  isActive,
  onPoke,
}: {
  addr: number;
  value: number;
  bitWidth: number;
  addrBits: number;
  base: NumericBase;
  isActive: boolean;
  onPoke: (a: number, v: number) => void;
}) {
  const displayed = formatNum(value, base, bitWidth);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    const t = raw.trim();
    const p = /^0x/i.test(t)
      ? parseInt(t, 16)
      : /^0b/i.test(t)
        ? parseInt(t.slice(2), 2)
        : /^0o/i.test(t)
          ? parseInt(t.slice(2), 8)
          : parseInt(t, 10);
    if (!isNaN(p)) onPoke(addr, p);
    setDraft(null);
  }

  return (
    <div
      className="flex items-center gap-1 rounded px-0.5 py-px"
      style={isActive ? { background: ADDRESS_HIGHLIGHT_BG } : undefined}
    >
      <span className="num w-10 shrink-0 font-mono text-cv-xs text-fg-faint">
        {fmtAddr(addr, addrBits)}
      </span>
      <input
        ref={inputRef}
        type="text"
        className="min-w-0 flex-1 rounded border border-line bg-sunken px-1 py-px font-mono text-cv-xs text-fg focus:border-line-strong focus:outline-none"
        value={draft ?? displayed}
        onFocus={() => setDraft(draft ?? displayed)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            inputRef.current?.blur();
          }
          if (e.key === "Escape") {
            setDraft(null);
            inputRef.current?.blur();
          }
        }}
      />
    </div>
  );
}
