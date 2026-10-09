"use client";

import { useCallback, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { useMemoryPanelStore } from "@/lib/memoryPanelStore";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useExecutingAddr } from "@/lib/useExecutingAddr";
import { useLayoutStore, type ComponentInstance } from "@/lib/store";
import { useProgramDataStore, mountStatus } from "@/lib/programDataStore";
import { decodeMnemonic } from "@/lib/disassemble";
import AddressList from "@/components/AddressList";
import { useDisplayLabel, useT } from "@/lib/i18n";

/**
 * Both memories, side by side, where the code panels are — instruction memory
 * on the left, data memory on the right — so the datapath stays visible and
 * the values update live while the clock steps. Either memory's "view all"
 * button opens both; "Voltar ao código" swaps back to the editor.
 */
export default function MemoryPanel() {
  const t = useT();
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
        {t.program.memoryPanel.back}
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
  const label = useDisplayLabel(component.label);
  const columns = useT().program.columns;

  const revision = useSimulatorStore((s) => s.revision);
  const imem = useSimulatorStore((s) => (instruction ? s.getInstructionMemory(id) : undefined));
  const mem = useSimulatorStore((s) => (instruction ? undefined : s.getMemory(id)));
  void revision;
  const obj = instruction ? imem : mem;

  // Instruction memory: on the timeline the PC register runs ahead to PC+1, so
  // the address port no longer points at the instruction being executed.
  const executingAddr = useExecutingAddr(id);

  const read = useCallback((addr: number) => obj?.peek(addr) ?? 0, [obj]);

  // Data memory: name each address after its `.data` variable — but only from
  // a clean, current mount, so an edited-but-not-remounted source can never
  // put names on cells it didn't lay out.
  const assemblySource = useProgramDataStore((s) => s.assemblySource);
  const mountedSource = useProgramDataStore((s) => s.mountedSource);
  const assembled = useProgramDataStore((s) => s.assembled);
  const assemblyErrors = useProgramDataStore((s) => s.assemblyErrors);
  const mounted =
    mountStatus({ mountedSource, assemblySource, assembled, assemblyErrors }) === "ok";
  const names = useMemo(() => {
    const map = new Map<number, string>();
    if (!instruction && mounted) {
      for (const sym of assembled?.dataSymbols ?? []) map.set(sym.addr, sym.name);
    }
    return map;
  }, [instruction, mounted, assembled]);
  const name = useCallback((addr: number) => names.get(addr), [names]);

  const wordCount = obj?.wordCount ?? 256;
  const bitWidth = obj?.bitWidth ?? 16;
  const currentAddr =
    instruction && executingAddr !== undefined ? executingAddr : (obj?.in_addr.value ?? 0);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-line last:border-r-0">
      <div className="flex shrink-0 items-baseline justify-between border-b border-line px-3 py-2">
        <h2 className="t-panel truncate text-fg">{label}</h2>
      </div>
      <AddressList
        density="compact"
        scrollBlock="nearest"
        wordCount={wordCount}
        bitWidth={bitWidth}
        currentAddr={currentAddr}
        read={read}
        unsigned={instruction}
        decode={instruction ? decodeMnemonic : undefined}
        name={instruction ? undefined : name}
        headers={{ addr: columns.addr, word: columns.word, decode: columns.opcode, name: columns.name }}
      />
    </section>
  );
}
