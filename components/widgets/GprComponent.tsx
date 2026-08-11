"use client";

import { useState, useRef } from "react";
import { Pencil } from "lucide-react";
import { Props } from "@/lib/store";
import { useSimulatorStore } from "@/lib/simulatorStore";
import { useDisplayStore, formatNum, type NumericBase } from "@/lib/displayStore";
import NodeShell from "@/components/widgets/NodeShell";

/**
 * The register bank.
 *
 * Its anatomy is a table — that is what separates it from a plain register at
 * reading distance, and why neither needs a colour of its own. The row being
 * read or written is marked with a low-alpha data tint plus a letter tag, so
 * which port touched it survives greyscale.
 */
export default function GprComponent({ component, zoom }: Props) {
  const { id } = component;
  const [editMode, setEditMode] = useState(false);

  const revision = useSimulatorStore((s) => s.revision);
  const gpr = useSimulatorStore((s) => s.getGpr(id));
  const pokeGprRegister = useSimulatorStore((s) => s.pokeGprRegister);
  const base = useDisplayStore((s) => s.numericBase);
  void revision;

  const regs = gpr ? gpr.snapshot() : [];
  const bitWidth = gpr?.bitWidth ?? 16;
  const readAddrA = gpr?.in_readAddrA?.value ?? 0;
  const readAddrB = gpr?.in_readAddrB?.value ?? 0;
  const writeAddr = gpr?.in_writeAddr?.value ?? 0;
  const wrEnable = (gpr?.in_writeEnable?.value ?? 0) !== 0;

  return (
    <NodeShell
      component={component}
      zoom={zoom}
      sequential
      actions={
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setEditMode((v) => !v);
          }}
          className={`shrink-0 rounded p-0.5 transition-colors ${
            editMode ? "text-st-active" : "text-fg-faint hover:text-fg"
          }`}
          title={editMode ? "Exit edit" : "Edit registers"}
        >
          <Pencil size={12} strokeWidth={1.5} />
        </button>
      }
    >
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-px px-1.5 py-1">
          {regs.map(({ value }, i) => {
            const isWriteTarget = wrEnable && i === writeAddr;
            const tag = isWriteTarget
              ? "W"
              : i === readAddrA && i === readAddrB
                ? "AB"
                : i === readAddrA
                  ? "A"
                  : i === readAddrB
                    ? "B"
                    : null;

            return (
              <GprRow
                key={i}
                index={i}
                value={value}
                bitWidth={bitWidth}
                base={base}
                editMode={editMode}
                tag={tag}
                onPoke={(idx, val) => pokeGprRegister(id, idx, val)}
              />
            );
          })}
        </div>
      </div>
    </NodeShell>
  );
}

interface GprRowProps {
  index: number;
  value: number;
  bitWidth: number;
  base: NumericBase;
  editMode: boolean;
  tag: string | null;
  onPoke: (index: number, value: number) => void;
}

function GprRow({ index, value, bitWidth, base, editMode, tag, onPoke }: GprRowProps) {
  const displayed = formatNum(value, base, bitWidth);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    const t = raw.trim();
    const parsed = /^0x/i.test(t)
      ? parseInt(t, 16)
      : /^0b/i.test(t)
        ? parseInt(t.slice(2), 2)
        : /^0o/i.test(t)
          ? parseInt(t.slice(2), 8)
          : parseInt(t, 10);
    if (!isNaN(parsed)) onPoke(index, parsed);
    setDraft(null);
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded px-1.5 py-[3px] transition-colors"
      style={tag ? { background: "color-mix(in srgb, var(--st-data) 8%, transparent)" } : undefined}
    >
      <span className="w-5 shrink-0 font-mono text-[11px] text-fg-faint">R{index}</span>
      {editMode ? (
        <input
          ref={inputRef}
          type="text"
          className="min-w-0 flex-1 rounded border border-line bg-sunken px-1 py-px font-mono text-[11px] text-fg focus:border-line-strong focus:outline-none"
          value={draft ?? displayed}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
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
      ) : (
        <>
          <span className={`num flex-1 text-right font-mono text-[11px] ${tag ? "text-fg" : "text-fg-muted"}`}>
            {displayed}
          </span>
          {tag && <span className="w-4 shrink-0 font-mono text-[9px] text-fg-faint">{tag}</span>}
        </>
      )}
    </div>
  );
}
