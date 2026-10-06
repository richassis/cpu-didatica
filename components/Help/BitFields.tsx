"use client";

import {
  ISA_WORD_SIZE,
  OPCODE_BITS,
  OPCODE_SHIFT,
  GPR_ADDR_BITS,
  GPR_ADDR_SHIFT,
  ULA_SRC_B_SHIFT,
  ULA_DST_SHIFT,
  OPERAND_BITS,
  INSTRUCTION_SET,
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
}

/** Field layout of the two instruction formats, straight from the ISA constants. */
export function formatFields(format: "standard" | "ula"): WordField[] {
  const opcode: WordField = {
    label: "Opcode", hi: ISA_WORD_SIZE - 1, lo: OPCODE_SHIFT, kind: "opcode",
  };
  if (format === "ula") {
    return [
      opcode,
      { label: "Ra", hi: GPR_ADDR_SHIFT + GPR_ADDR_BITS - 1, lo: GPR_ADDR_SHIFT, kind: "register" },
      { label: "Rb", hi: ULA_SRC_B_SHIFT + GPR_ADDR_BITS - 1, lo: ULA_SRC_B_SHIFT, kind: "register" },
      { label: "—", hi: ULA_SRC_B_SHIFT - 1, lo: ULA_DST_SHIFT + GPR_ADDR_BITS, kind: "pad" },
      { label: "Rd", hi: ULA_DST_SHIFT + GPR_ADDR_BITS - 1, lo: ULA_DST_SHIFT, kind: "register" },
    ];
  }
  return [
    opcode,
    { label: "R", hi: GPR_ADDR_SHIFT + GPR_ADDR_BITS - 1, lo: GPR_ADDR_SHIFT, kind: "register" },
    { label: "Operando (M ou N)", hi: OPERAND_BITS - 1, lo: 0, kind: "operand" },
  ];
}

/** The fields of a concrete word, with each one's meaning for that instruction. */
export function wordFields(word: number): { mnemonic: string | null; format: "standard" | "ula"; fields: WordField[] } {
  const opcode = (word >>> OPCODE_SHIFT) & ((1 << OPCODE_BITS) - 1);
  const entry = Object.values(INSTRUCTION_SET).find((d) => d.opcode === opcode);
  const format = entry?.format ?? "standard";
  const fields = formatFields(format).map((f): WordField => {
    if (!entry) return f;
    if (f.kind === "opcode") return { ...f, meaning: entry.mnemonic };
    if (entry.format === "ula") {
      if (f.label === "Ra") return { ...f, label: "Ra", meaning: "primeiro operando" };
      if (f.label === "Rb") return { ...f, meaning: entry.usesSrcB ? "segundo operando" : "não usado (NOT)" };
      if (f.label === "Rd") return { ...f, meaning: "destino do resultado" };
      return { ...f, meaning: "não usado" };
    }
    if (f.kind === "register") {
      return { ...f, meaning: entry.usesGPR ? (entry.mnemonic === "STA" ? "registrador fonte" : "registrador destino") : "não usado" };
    }
    return {
      ...f,
      meaning: !entry.usesOperand
        ? "não usado"
        : entry.mnemonic === "LDAI"
          ? "valor imediato N"
          : "endereço M",
    };
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
