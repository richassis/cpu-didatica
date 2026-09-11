"use client";

import { useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { useMemoryPanelStore } from "@/lib/memoryPanelStore";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useExecutionStore } from "@/lib/executionStore";
import { useLayoutStore } from "@/lib/store";
import { InstructionMemory } from "@/lib/simulator";
import { decodeMnemonic } from "@/lib/disassemble";
import MemoryTable from "@/components/MemoryTable";

/**
 * A memory's full contents, shown where the code panels are so the datapath
 * stays visible on the right and the values update live while the clock steps.
 * "Voltar ao código" swaps back to the editor — a tab that opened, not a modal
 * that blocks.
 */
export default function MemoryPanel() {
  const id = useMemoryPanelStore((s) => s.inspectedMemoryId);
  const close = useMemoryPanelStore((s) => s.closeMemoryPanel);

  const revision = useSimulatorStore((s) => s.revision);
  const obj = useSimulatorStore((s) =>
    id ? s.getMemory(id) ?? s.getInstructionMemory(id) ?? null : null
  );
  const label = useLayoutStore((s) => s.components.find((c) => c.id === id)?.label);
  void revision;

  // Instruction memory: on the timeline the PC register runs ahead to PC+1, so
  // the address port no longer points at the instruction being executed.
  const isTimelineActive = useExecutionStore((s) => s.isTimelineActive);
  const executingAddr = useExecutionStore((s) =>
    s.isTimelineActive ? s.frames[s.currentIndex]?.postTick?.pc : undefined
  );

  const read = useCallback((addr: number) => obj?.peek(addr) ?? 0, [obj]);

  if (!obj) {
    return (
      <aside className="flex h-full w-full flex-col overflow-hidden border-r border-line bg-surface">
        <PanelHeader title={label ?? "Memória"} onBack={close} />
        <div className="flex flex-1 items-center justify-center px-3 text-center text-[11px] text-fg-faint">
          Memória indisponível.
        </div>
      </aside>
    );
  }

  const isInstr = obj instanceof InstructionMemory;
  const wordCount = obj.wordCount;
  const bitWidth = obj.bitWidth;
  const addrBits = Math.max(1, Math.ceil(Math.log2(wordCount)));
  const currentAddr =
    isInstr && isTimelineActive && executingAddr !== undefined
      ? executingAddr
      : obj.in_addr.value;

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-line bg-surface">
      <PanelHeader title={label ?? (isInstr ? "Instruções" : "Memória")} onBack={close} />
      <MemoryTable
        wordCount={wordCount}
        bitWidth={bitWidth}
        addrBits={addrBits}
        currentAddr={currentAddr}
        read={read}
        decode={isInstr ? decodeMnemonic : undefined}
        scrollBlock="nearest"
      />
    </aside>
  );
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex shrink-0 flex-col border-b border-line">
      <button
        onClick={onBack}
        className="flex items-center gap-1 px-3 py-1.5 text-left text-[11px] text-fg-muted transition-colors hover:bg-raised hover:text-fg"
      >
        <ChevronLeft size={13} strokeWidth={1.5} className="shrink-0" />
        Voltar ao código
      </button>
      <div className="flex items-baseline justify-between border-t border-line px-3 py-2">
        <h2 className="t-panel text-fg">{title}</h2>
        <span className="t-section">somente leitura</span>
      </div>
    </div>
  );
}
