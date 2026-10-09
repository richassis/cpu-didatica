"use client";

import { useMemo, useState } from "react";
import { Opcode, INSTRUCTION_SET, INSTRUCTIONS_BY_OPCODE, OPCODE_SEQUENCES } from "@/lib/simulator";
import { OPCODE_SHIFT, formatOpcodeBits } from "@/lib/simulator/ISA";
import { assemble } from "@/lib/assembler";
import { useT, type Messages } from "@/lib/i18n";
import { INSTRUCTION_HELP } from "@/lib/helpContent";
import BitFields, { wordFields, type WordField } from "@/components/Help/BitFields";

type Mnemonic = keyof typeof Opcode;

/**
 * The instruction formats as they are actually used — one drawing per group
 * of instructions that read the 16 bits the same way, rather than two generic
 * layouts the student has to specialise in their head.
 */
const FORMAT_GROUPS: { id: keyof Messages["reference"]["isa"]["groups"]; mnemonics: Mnemonic[] }[] = [
  { id: "loadStore", mnemonics: ["LDA", "STA"] },
  { id: "ldai",      mnemonics: ["LDAI"] },
  { id: "branches",  mnemonics: ["JZ", "JN", "JMP"] },
  { id: "hlt",       mnemonics: ["HLT"] },
  { id: "alu",       mnemonics: ["ADD", "SUB", "AND", "OR"] },
  { id: "not",       mnemonics: ["NOT"] },
];

/** The field layout one group uses, labelled for that group. */
function groupFields(group: (typeof FORMAT_GROUPS)[number], t: Messages): WordField[] {
  const { opcode, operands } = INSTRUCTION_SET[group.mnemonics[0]];
  const operandLabel = operands.find((o) => o.field === "operand")?.label;
  const registerMeaning = t.reference.isa.groups[group.id].registerMeaning;
  return wordFields(opcode << OPCODE_SHIFT, t.reference.bitFields).fields.map((f): WordField => {
    if (f.kind === "opcode") return { ...f, meaning: undefined };
    if (f.unused) return { ...f, label: "—", kind: "pad" };
    if (f.kind === "register" && registerMeaning) return { ...f, meaning: registerMeaning };
    if (f.kind === "operand" && operandLabel) return { ...f, label: operandLabel };
    return f;
  });
}

/** Each instruction's example, assembled — the help text is static, so once. */
const EXAMPLE_WORDS: Partial<Record<Mnemonic, number>> = Object.fromEntries(
  INSTRUCTIONS_BY_OPCODE.flatMap((d) => {
    const result = assemble(INSTRUCTION_HELP[d.mnemonic].example);
    return result && result.errors.length === 0 && result.words.length === 1
      ? [[d.mnemonic, result.words[0]]]
      : [];
  })
);

/** FETCH and DECODE, plus whatever the opcode's own sequence adds. */
function tickCount(opcode: Opcode): number {
  return 2 + (OPCODE_SEQUENCES[opcode]?.length ?? 0);
}

const hex = (n: number, digits = 4) => `0x${n.toString(16).toUpperCase().padStart(digits, "0")}`;
const bin = (n: number, digits: number) => n.toString(2).padStart(digits, "0");
/** 16 bits in groups of four, the way they line up with the hex digits. */
const binGroups = (n: number) => bin(n, 16).replace(/(.{4})(?=.)/g, "$1 ");

/** A word typed in hex or binary, or an instruction typed in assembly. */
function parseEncoderInput(
  text: string,
  messages: Messages,
): { word?: number; error?: string } {
  const t = text.trim();
  if (!t) return {};

  if (/^0x[0-9a-f]{1,4}$/i.test(t)) return { word: parseInt(t, 16) };
  if (/^(0b)?[01]{16}$/i.test(t)) return { word: parseInt(t.replace(/^0b/i, ""), 2) };
  if (/^0x/i.test(t)) return { error: messages.reference.isa.tooManyHexDigits };

  const result = assemble(t);
  if (!result) return {};
  if (result.errors.length > 0) return { error: messages.assembler.format(result.errors[0].message) };
  if (result.words.length !== 1) return { error: messages.reference.isa.oneInstruction };
  return { word: result.words[0] };
}

export default function IsaTab() {
  const [input, setInput] = useState("ADD R1, R2, R3");
  const t = useT();
  const parsed = useMemo(() => parseEncoderInput(input, t), [input, t]);
  const decoded = parsed.word !== undefined ? wordFields(parsed.word, t.reference.bitFields) : null;
  const isa = t.reference.isa;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="t-node mb-1 text-fg">{isa.formatHeading}</h3>
        <p className="mb-4 text-ui leading-relaxed text-fg-muted">{isa.formatIntro()}</p>

        <div className="space-y-5">
          {FORMAT_GROUPS.map((group) => (
            <div key={group.id}>
              <div className="t-section mb-1.5">{isa.groups[group.id].title}</div>
              <BitFields fields={groupFields(group, t)} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="t-node mb-1 text-fg">{isa.instructionsHeading(INSTRUCTIONS_BY_OPCODE.length)}</h3>
        <p className="mb-3 text-ui leading-relaxed text-fg-muted">{isa.instructionsIntro()}</p>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-raised text-fg-muted">
                <th className="px-2.5 py-1.5 font-normal">{isa.columns.opcode}</th>
                <th className="px-2.5 py-1.5 font-normal">{isa.columns.syntax}</th>
                <th className="px-2.5 py-1.5 font-normal">{isa.columns.exampleWord}</th>
                <th className="px-2.5 py-1.5 font-normal">{isa.columns.effect}</th>
                <th className="px-2.5 py-1.5 font-normal">{isa.columns.format}</th>
                <th className="px-2.5 py-1.5 font-normal">{isa.columns.flags}</th>
                <th className="px-2.5 py-1.5 font-normal">{isa.columns.ticks}</th>
              </tr>
            </thead>
            <tbody>
              {INSTRUCTIONS_BY_OPCODE.map((d) => {
                const help = INSTRUCTION_HELP[d.mnemonic];
                const selected = parsed.word !== undefined && decoded?.mnemonic === d.mnemonic;
                return (
                  <tr
                    key={d.mnemonic}
                    onClick={() => setInput(help.example)}
                    className={`cursor-pointer border-b border-line last:border-b-0 hover:bg-raised ${
                      selected ? "bg-raised" : ""
                    }`}
                  >
                    <td className="px-2.5 py-1.5 font-mono">
                      <span className="text-st-data">{formatOpcodeBits(d.opcode)}</span>{" "}
                      <span className="text-fg-faint">{hex(d.opcode, 2)}</span>
                    </td>
                    <td className="px-2.5 py-1.5 font-mono">
                      <div className="text-fg">{help.syntax}</div>
                      <div className="text-caption text-fg-faint">{help.example}</div>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 font-mono">
                      {EXAMPLE_WORDS[d.mnemonic] !== undefined && (
                        <>
                          <div className="text-fg-muted">{hex(EXAMPLE_WORDS[d.mnemonic]!)}</div>
                          <div className="text-caption text-fg-faint">{binGroups(EXAMPLE_WORDS[d.mnemonic]!)}</div>
                        </>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-fg-muted">{t.reference.instructions[d.mnemonic].effect}</td>
                    <td className="px-2.5 py-1.5 text-fg-muted">{isa.formats[d.format]}</td>
                    <td className="px-2.5 py-1.5 font-mono text-fg-muted">{help.flags}</td>
                    <td className="num px-2.5 py-1.5 font-mono text-fg-muted">{tickCount(d.opcode)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-caption leading-snug text-fg-faint">{isa.ticksNote}</p>
      </section>

      <section>
        <h3 className="t-node mb-1 text-fg">{isa.encoderHeading}</h3>
        <p className="mb-3 text-ui leading-relaxed text-fg-muted">{isa.encoderIntro()}</p>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label={isa.encoderInput}
          placeholder="ADD R1, R2, R3"
          className="h-9 w-full max-w-md rounded-lg border border-line bg-sunken px-3 font-mono text-ui text-fg placeholder:text-fg-faint focus:border-line-strong focus:outline-none"
        />

        <div className="mt-4 min-h-[88px]">
          {parsed.error && (
            <p className="rounded-lg border border-st-error px-3 py-2 font-mono text-small text-st-error">
              {parsed.error}
            </p>
          )}

          {decoded && parsed.word !== undefined && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-ui">
                <span className="text-fg">
                  {decoded.mnemonic ?? isa.unknownOpcode}
                </span>
                <span className="text-fg-muted">{hex(parsed.word)}</span>
                <span className="text-fg-faint">{bin(parsed.word, 16)}</span>
                {decoded.mnemonic && (
                  <span className="text-fg-faint">{t.reference.instructions[decoded.mnemonic as Mnemonic].effect}</span>
                )}
              </div>
              <BitFields fields={decoded.fields} word={parsed.word} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
