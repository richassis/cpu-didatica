"use client";

import { useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { useMemoryPanelStore } from "@/lib/memoryPanelStore";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useExecutingAddr } from "@/lib/useExecutingAddr";
import { useLayoutStore, type ComponentInstance } from "@/lib/store";
import { decodeMnemonic } from "@/lib/disassemble";
import MemoryTable from "@/components/MemoryTable";

/**
 * Both memories, side by side, where the code panels are — instruction memory
 * on the left, data memory on the right — so the datapath stays visible and
 * the values update live while the clock steps. Either memory's "view all"
 * button opens both; "Voltar ao código" swaps back to the editor.
 */
export default function MemoryPanel() {
  const close = useMemoryPanelStore((s) => s.closeMemoryPanel);
  const components = useLayoutStore((s) => s.components);

  const imems = components.filter((c) => c.type === "InstructionMemoryComponent");
  const dmems = components.filter((c) => c.type === "MemoryComponent");

  return (
    <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden border-r border-line bg-surface">
      <button
        onClick={close}
        className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-1.5 text-left text-small text-fg-muted transition-colors hover:bg-raised hover:text-fg"
      >
        <ChevronLeft size={13} strokeWidth={1.5} className="shrink-0" />
        Voltar ao código
      </button>

      <div className="flex min-h-0 flex-1">
        {imems.map((c) => (
          <MemoryColumn key={c.id} component={c} instruction />
        ))}
        {dmems.map((c) => (
          <MemoryColumn key={c.id} component={c} />
        ))}
      </div>
    </aside>
  );
}

function MemoryColumn({
  component,
  instruction = false,
}: {
  component: ComponentInstance;
  instruction?: boolean;
}) {
  const { id } = component;

  const revision = useSimulatorStore((s) => s.revision);
  const imem = useSimulatorStore((s) => (instruction ? s.getInstructionMemory(id) : undefined));
  const mem = useSimulatorStore((s) => (instruction ? undefined : s.getMemory(id)));
  void revision;
  const obj = instruction ? imem : mem;

  // Instruction memory: on the timeline the PC register runs ahead to PC+1, so
  // the address port no longer points at the instruction being executed.
  const executingAddr = useExecutingAddr(id);

  const read = useCallback((addr: number) => obj?.peek(addr) ?? 0, [obj]);

  const wordCount = obj?.wordCount ?? 256;
  const bitWidth = obj?.bitWidth ?? 16;
  const addrBits = Math.max(1, Math.ceil(Math.log2(wordCount)));
  const currentAddr =
    instruction && executingAddr !== undefined ? executingAddr : (obj?.in_addr.value ?? 0);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-line last:border-r-0">
      <div className="flex shrink-0 items-baseline justify-between border-b border-line px-3 py-2">
        <h2 className="t-panel truncate text-fg">{component.label}</h2>
        <span className="t-section shrink-0">somente leitura</span>
      </div>
      <MemoryTable
        wordCount={wordCount}
        bitWidth={bitWidth}
        addrBits={addrBits}
        currentAddr={currentAddr}
        read={read}
        decode={instruction ? decodeMnemonic : undefined}
        scrollBlock="nearest"
        compact
        headers={{ addr: "End", word: "Palavra", decode: "Opcode" }}
      />
    </section>
  );
}
