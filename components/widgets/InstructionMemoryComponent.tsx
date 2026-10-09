"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { List } from "lucide-react";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useExecutingAddr } from "@/lib/useExecutingAddr";
import { useMemoryPanelStore } from "@/lib/memoryPanelStore";
import { useCanvasEditing } from "@/components/CanvasEditingContext";
import { EDITOR_ENABLED } from "@/lib/editorFlag";
import NodeShell from "@/components/widgets/NodeShell";
import MemoryViewer from "@/components/MemoryViewer";
import AddressList from "@/components/AddressList";
import InstructionBuilder from "@/components/InstructionBuilder";
import { decodeMnemonic } from "@/lib/disassemble";

/** Student-visible text of this widget, in one place for translation. */
const LABELS = {
  viewAll: "Ver o programa inteiro",
} as const;

/**
 * Instruction memory. Same shape family as data memory — a spine and a full,
 * scrollable address list — because they are the same class of thing.
 *
 * The list shows the raw stored word, not its mnemonic: the mnemonic already
 * lives in the source and in the Ling. Máquina panel, and a memory that displayed
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
  const openMemoryPanel = useMemoryPanelStore((s) => s.openMemoryPanel);

  // In program mode the full listing opens in the side panel (datapath stays
  // visible); in edit mode it stays a modal, since edit mode has no side panel.
  const openListing = () => (canEdit ? setViewerOpen(true) : openMemoryPanel(id));

  const revision = useSimulatorStore((s) => s.revision);
  const imem = useSimulatorStore((s) => s.getInstructionMemory(id));
  void revision;

  // While a program runs, the PC register races ahead to PC+1 during the
  // instruction it fetched, so `imem.in_addr` no longer points at the
  // instruction being executed. The timeline carries that address separately,
  // and it only moves once the PC's wire has reached this memory.
  const executingAddr = useExecutingAddr(id);

  const wordCount = imem?.wordCount ?? 256;
  const bitWidth = imem?.bitWidth ?? 16;
  const currentAddr =
    executingAddr !== undefined ? executingAddr : imem?.in_addr.value ?? 0;

  const readWord = useCallback((addr: number) => imem?.peek(addr) ?? 0, [imem]);

  return (
    <>
      <NodeShell
        component={component}
        zoom={zoom}
        spine
        dense
        value={decodeMnemonic(imem?.peek(currentAddr) ?? 0)}
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
              data-tour="imem-list"
              title={LABELS.viewAll}
            >
              <List size={12} strokeWidth={1.5} />
            </button>
          </>
        }
      >
        <AddressList
          density="canvas"
          wordCount={wordCount}
          bitWidth={bitWidth}
          currentAddr={currentAddr}
          read={readWord}
          unsigned
          onRowClick={(a) => {
            setSelectedAddress(a);
            if (canEdit) setBuilderOpen(true);
            else openMemoryPanel(id);
          }}
        />
      </NodeShell>

      {viewerOpen && (
        <MemoryViewer
          title={component.label}
          wordCount={wordCount}
          bitWidth={bitWidth}
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
