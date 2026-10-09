"use client";

import {
  FIELD_LAYOUT,
  extractFields,
  lookupInstruction,
  type FieldSpec,
  type InstructionFormat,
} from "@/lib/simulator/ISA";

export type FieldKind = "opcode" | "register" | "operand" | "pad";

export interface WordField {
  label: string;
  /** Highest and lowest bit of the field. */
  hi: number;
  lo: number;
  kind: FieldKind;
  /** What the field means for this instruction. */
  meaning?: string;
  /** The instruction does not use the field. */
  unused?: boolean;
}

/** How each field of the layout is drawn. */
const FIELD_LOOK: Record<FieldSpec["name"], { label: string; kind: FieldKind }> = {
  opcode:  { label: "Opcode", kind: "opcode" },
  gprAddr: { label: "R", kind: "register" },
  operand: { label: "Operando (M ou N)", kind: "operand" },
  srcA:    { label: "Ra", kind: "register" },
  srcB:    { label: "Rb", kind: "register" },
  pad:     { label: "—", kind: "pad" },
  dst:     { label: "Rd", kind: "register" },
};

function toWordField(spec: FieldSpec): WordField {
  const { label, kind } = FIELD_LOOK[spec.name];
  return { label, hi: spec.shift + spec.bits - 1, lo: spec.shift, kind };
}

/** Field layout of the two instruction formats, straight from the ISA. */
export function formatFields(format: InstructionFormat): WordField[] {
  return FIELD_LAYOUT[format].map(toWordField);
}

/** The fields of a concrete word, with each one's meaning for that instruction. */
export function wordFields(word: number): { mnemonic: string | null; format: InstructionFormat; fields: WordField[] } {
  const entry = lookupInstruction(extractFields(word).opcode);
  const format = entry?.format ?? "standard";
  const fields = FIELD_LAYOUT[format].map((spec): WordField => {
    const f = toWordField(spec);
    if (!entry) return f;
    const operand = entry.operands.find((o) => o.field === spec.name);
    switch (spec.name) {
      case "opcode":  return { ...f, meaning: entry.mnemonic };
      case "srcA":    return { ...f, meaning: "primeiro operando" };
      case "srcB":    return operand ? { ...f, meaning: "segundo operando" } : { ...f, meaning: "não usado (NOT)", unused: true };
      case "dst":     return { ...f, meaning: "destino do resultado" };
      case "pad":     return { ...f, meaning: "não usado", unused: true };
      case "gprAddr":
        if (!operand) return { ...f, meaning: "não usado", unused: true };
        return { ...f, meaning: operand.label === "Rs" ? "registrador fonte" : "registrador destino" };
      case "operand":
        if (!operand) return { ...f, meaning: "não usado", unused: true };
        return { ...f, meaning: operand.kind === "immediate" ? "valor imediato N" : "endereço M" };
    }
  });
  return { mnemonic: entry?.mnemonic ?? null, format, fields };
}

const KIND_COLOR: Record<FieldKind, string> = {
  opcode: "var(--st-data)",
  register: "var(--st-active)",
  operand: "var(--st-warn)",
  pad: "var(--border-strong)",
};

/**
 * The 16 bits of an instruction, one box per bit, grouped and coloured by
 * field. Without a `word` it draws the empty format (bit numbers only).
 */
export default function BitFields({
  fields,
  word,
}: {
  fields: WordField[];
  word?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-1">
        {fields.map((field) => {
          const width = field.hi - field.lo + 1;
          const color = KIND_COLOR[field.kind];
          return (
            <div key={`${field.hi}-${field.lo}`} className="flex flex-col items-stretch" style={{ flexGrow: width, flexBasis: 0, minWidth: width * 18 }}>
              <div
                className="mb-0.5 truncate text-center font-mono text-caption"
                style={{ color }}
                title={field.meaning ? `${field.label}: ${field.meaning}` : field.label}
              >
                {field.label}
              </div>
              <div
                className="flex rounded-md border"
                style={{ borderColor: color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
              >
                {Array.from({ length: width }, (_, i) => {
                  const bit = field.hi - i;
                  const value = word === undefined ? null : (word >>> bit) & 1;
                  return (
                    <div key={bit} className="flex flex-1 flex-col items-center py-1">
                      <span className="font-mono text-ui leading-none text-fg">{value === null ? "·" : value}</span>
                      <span className="mt-1 font-mono text-micro leading-none text-fg-faint">{bit}</span>
                    </div>
                  );
                })}
              </div>
              {field.meaning && (
                <div className="mt-0.5 truncate text-center text-micro text-fg-faint" title={field.meaning}>
                  {field.meaning}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
