"use client";

import { useMemo, useState } from "react";
import { Opcode, INSTRUCTION_SET, OPCODE_SEQUENCES } from "@/lib/simulator";
import { OPCODE_BITS, OPCODE_SHIFT } from "@/lib/simulator/ISA";
import { assemble } from "@/lib/assembler";
import { INSTRUCTION_HELP } from "@/lib/helpContent";
import BitFields, { wordFields, type WordField } from "@/components/Help/BitFields";

type Mnemonic = keyof typeof Opcode;

/** Every instruction, ordered by opcode. */
const INSTRUCTIONS = Object.values(INSTRUCTION_SET).sort((a, b) => a.opcode - b.opcode);

/**
 * The instruction formats as they are actually used — one drawing per group
 * of instructions that read the 16 bits the same way, rather than two generic
 * layouts the student has to specialise in their head.
 */
const FORMAT_GROUPS: { title: string; mnemonics: Mnemonic[]; registerMeaning?: string }[] = [
  { title: "LDA e STA", mnemonics: ["LDA", "STA"], registerMeaning: "destino (LDA) · fonte (STA)" },
  { title: "LDAI", mnemonics: ["LDAI"] },
  { title: "Desvios — JZ, JN e JMP", mnemonics: ["JZ", "JN", "JMP"] },
  { title: "HLT", mnemonics: ["HLT"] },
  { title: "ULA — ADD, SUB, AND e OR", mnemonics: ["ADD", "SUB", "AND", "OR"] },
  { title: "NOT", mnemonics: ["NOT"] },
];

/** The field layout one group uses, labelled for that group. */
function groupFields(group: (typeof FORMAT_GROUPS)[number]): WordField[] {
  const opcode = INSTRUCTION_SET[group.mnemonics[0]].opcode;
  return wordFields(opcode << OPCODE_SHIFT).fields.map((f): WordField => {
    if (f.kind === "opcode") return { ...f, meaning: undefined };
    if (f.meaning?.startsWith("não usado")) return { ...f, label: "—", kind: "pad" };
    if (f.kind === "register" && group.registerMeaning) return { ...f, meaning: group.registerMeaning };
    if (f.kind === "operand") return { ...f, label: f.meaning === "valor imediato N" ? "N" : "M" };
    return f;
  });
}

/** Each instruction's example, assembled — the help text is static, so once. */
const EXAMPLE_WORDS: Partial<Record<Mnemonic, number>> = Object.fromEntries(
  INSTRUCTIONS.flatMap((d) => {
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
function parseEncoderInput(text: string): { word?: number; error?: string } {
  const t = text.trim();
  if (!t) return {};

  if (/^0x[0-9a-f]{1,4}$/i.test(t)) return { word: parseInt(t, 16) };
  if (/^(0b)?[01]{16}$/i.test(t)) return { word: parseInt(t.replace(/^0b/i, ""), 2) };
  if (/^0x/i.test(t)) return { error: "Uma palavra tem até 4 dígitos hexadecimais (16 bits)." };

  const result = assemble(t);
  if (!result) return {};
  if (result.errors.length > 0) return { error: result.errors[0].message };
  if (result.words.length !== 1) return { error: "Digite uma instrução por vez." };
  return { word: result.words[0] };
}

export default function IsaTab() {
  const [input, setInput] = useState("ADD R1, R2, R3");
  const parsed = useMemo(() => parseEncoderInput(input), [input]);
  const decoded = parsed.word !== undefined ? wordFields(parsed.word) : null;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="t-node mb-1 text-fg">Uma instrução tem 16 bits</h3>
        <p className="mb-4 text-ui leading-relaxed text-fg-muted">
          Os 5 primeiros bits são sempre o <b className="text-fg">opcode</b>, que diz qual instrução é.
          O resto depende do formato de cada instrução: um registrador e um endereço{" "}
          <b className="text-fg">M</b>, um registrador e um valor <b className="text-fg">N</b>, só um
          endereço, três registradores da ULA — ou nada, no HLT. Campos marcados com{" "}
          <span className="font-mono text-fg">—</span> não são usados.
        </p>

        <div className="space-y-5">
          {FORMAT_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="t-section mb-1.5">{group.title}</div>
              <BitFields fields={groupFields(group)} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="t-node mb-1 text-fg">As {INSTRUCTIONS.length} instruções</h3>
        <p className="mb-3 text-ui leading-relaxed text-fg-muted">
          <b className="text-fg">Rd</b> é o destino, <b className="text-fg">Rs</b>, <b className="text-fg">Ra</b> e{" "}
          <b className="text-fg">Rb</b> são fontes, <b className="text-fg">M</b> é um endereço de memória
          (0 a 255) ou label, e <b className="text-fg">N</b> é um valor de −128 a 255. Clique numa linha
          para ver a instrução codificada abaixo.
        </p>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-raised text-fg-muted">
                <th className="px-2.5 py-1.5 font-normal">Opcode</th>
                <th className="px-2.5 py-1.5 font-normal">Sintaxe</th>
                <th className="px-2.5 py-1.5 font-normal">Palavra do exemplo</th>
                <th className="px-2.5 py-1.5 font-normal">Efeito</th>
                <th className="px-2.5 py-1.5 font-normal">Formato</th>
                <th className="px-2.5 py-1.5 font-normal">Flags</th>
                <th className="px-2.5 py-1.5 font-normal">Ticks</th>
              </tr>
            </thead>
            <tbody>
              {INSTRUCTIONS.map((d) => {
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
                      <span className="text-st-data">{bin(d.opcode, OPCODE_BITS)}</span>{" "}
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
                    <td className="px-2.5 py-1.5 font-mono text-fg-muted">{help.effect}</td>
                    <td className="px-2.5 py-1.5 text-fg-muted">{d.format === "ula" ? "ULA" : "padrão"}</td>
                    <td className="px-2.5 py-1.5 font-mono text-fg-muted">{help.flags}</td>
                    <td className="num px-2.5 py-1.5 font-mono text-fg-muted">{tickCount(d.opcode)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-caption leading-snug text-fg-faint">
          Ticks: quantos ciclos de clock a instrução leva, contando BUSCA e DECODIFICA. As flags
          Z (zero), C (vai-um), N (negativo) e V (overflow) são capturadas na ULA; LDA e LDAI
          atualizam só Z e N.
          Os desvios leem a última flag capturada.
        </p>
      </section>

      <section>
        <h3 className="t-node mb-1 text-fg">Codificador</h3>
        <p className="mb-3 text-ui leading-relaxed text-fg-muted">
          Digite uma instrução (<span className="font-mono">LDAI R0, -3</span>) ou uma palavra de
          máquina em hexadecimal (<span className="font-mono">0x2143</span>) ou binário, e veja os bits
          divididos em campos.
        </p>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="Instrução ou palavra de máquina"
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
                  {decoded.mnemonic ?? "opcode desconhecido"}
                </span>
                <span className="text-fg-muted">{hex(parsed.word)}</span>
                <span className="text-fg-faint">{bin(parsed.word, 16)}</span>
                {decoded.mnemonic && (
                  <span className="text-fg-faint">{INSTRUCTION_HELP[decoded.mnemonic as keyof typeof Opcode].effect}</span>
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
