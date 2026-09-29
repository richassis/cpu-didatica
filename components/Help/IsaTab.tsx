"use client";

import { useMemo, useState } from "react";
import { Opcode, INSTRUCTION_SET, OPCODE_SEQUENCES } from "@/lib/simulator";
import { OPCODE_BITS } from "@/lib/simulator/ISA";
import { assemble } from "@/lib/assembler";
import { INSTRUCTION_HELP } from "@/lib/helpContent";
import BitFields, { formatFields, wordFields } from "@/components/Help/BitFields";

/** Every instruction, ordered by opcode. */
const INSTRUCTIONS = Object.values(INSTRUCTION_SET).sort((a, b) => a.opcode - b.opcode);

/** FETCH and DECODE, plus whatever the opcode's own sequence adds. */
function tickCount(opcode: Opcode): number {
  return 2 + (OPCODE_SEQUENCES[opcode]?.length ?? 0);
}

const hex = (n: number, digits = 4) => `0x${n.toString(16).toUpperCase().padStart(digits, "0")}`;
const bin = (n: number, digits: number) => n.toString(2).padStart(digits, "0");

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
        <p className="mb-4 text-[12px] leading-relaxed text-fg-muted">
          Os 5 primeiros bits são sempre o <b className="text-fg">opcode</b>, que diz qual instrução é.
          O resto depende do formato: as instruções da ULA indicam três registradores; as demais
          indicam um registrador e um operando de 8 bits (um endereço ou um valor).
        </p>

        <div className="space-y-5">
          <div>
            <div className="t-section mb-1.5">Formato padrão — LDA, LDAI, STA e desvios</div>
            <BitFields fields={formatFields("standard")} />
          </div>
          <div>
            <div className="t-section mb-1.5">Formato da ULA — ADD, SUB, AND, OR e NOT</div>
            <BitFields fields={formatFields("ula")} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="t-node mb-1 text-fg">As {INSTRUCTIONS.length} instruções</h3>
        <p className="mb-3 text-[12px] leading-relaxed text-fg-muted">
          <b className="text-fg">Rd</b> é o destino, <b className="text-fg">Rs</b>, <b className="text-fg">Ra</b> e{" "}
          <b className="text-fg">Rb</b> são fontes, <b className="text-fg">M</b> é um endereço de memória
          (0 a 255) ou label, e <b className="text-fg">N</b> é um valor de −128 a 255. Clique numa linha
          para ver a instrução codificada abaixo.
        </p>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-line bg-raised text-fg-muted">
                <th className="px-2.5 py-1.5 font-normal">Opcode</th>
                <th className="px-2.5 py-1.5 font-normal">Sintaxe</th>
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
                    <td className="px-2.5 py-1.5 font-mono text-fg">{help.syntax}</td>
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
        <p className="mt-2 text-[10px] leading-snug text-fg-faint">
          Ticks: quantos ciclos de clock a instrução leva, contando BUSCA e DECODIFICA. As flags
          Z (zero), C (vai-um) e N (negativo) são capturadas na ULA; LDA e LDAI atualizam só Z e N.
          Os desvios leem a última flag capturada.
        </p>
      </section>

      <section>
        <h3 className="t-node mb-1 text-fg">Codificador</h3>
        <p className="mb-3 text-[12px] leading-relaxed text-fg-muted">
          Digite uma instrução (<span className="font-mono">LDAI R0, -3</span>) ou uma palavra de
          máquina em hexadecimal (<span className="font-mono">0x2123</span>) ou binário, e veja os bits
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
          className="h-9 w-full max-w-md rounded-lg border border-line bg-sunken px-3 font-mono text-[12px] text-fg placeholder:text-fg-faint focus:border-line-strong focus:outline-none"
        />

        <div className="mt-4 min-h-[88px]">
          {parsed.error && (
            <p className="rounded-lg border border-st-error px-3 py-2 font-mono text-[11px] text-st-error">
              {parsed.error}
            </p>
          )}

          {decoded && parsed.word !== undefined && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[12px]">
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
