"use client";

import { useEffect, useRef, useState } from "react";
import { useProgramDataStore } from "@/lib/programDataStore";
import { useExecutionStore } from "@/lib/executionStore";
import { PRESET_PROGRAMS } from "@/lib/presetPrograms";

// ── Syntax tokenizer ──────────────────────────────────────────────────────────
// Splits a source line into segments, preserving every character so that the
// concatenation of all segment.text === rawLine (required for cursor alignment).

type TokenType = "ws" | "label" | "directive" | "mnemonic" | "operand" | "comment";

interface Token { text: string; type: TokenType }

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let p = 0;
  const n = line.length;

  const push = (end: number, type: TokenType) => {
    if (end > p) { tokens.push({ text: line.slice(p, end), type }); p = end; }
  };

  // Locate comment
  const semi = line.indexOf(";");
  const codeEnd = semi !== -1 ? semi : n;

  // Leading whitespace
  let codeStart = p;
  while (codeStart < codeEnd && (line[codeStart] === " " || line[codeStart] === "\t")) codeStart++;
  push(codeStart, "ws");

  if (p < codeEnd) {
    if (line[p] === ".") {
      // Directive: everything from here to codeEnd
      push(codeEnd, "directive");
    } else {
      // Look for a label: word followed by ':'
      let wEnd = p;
      while (wEnd < codeEnd && line[wEnd] !== " " && line[wEnd] !== "\t" && line[wEnd] !== ":") wEnd++;
      if (wEnd < codeEnd && line[wEnd] === ":") {
        push(wEnd + 1, "label"); // includes the colon
        // Whitespace after label
        let ms = p;
        while (ms < codeEnd && (line[ms] === " " || line[ms] === "\t")) ms++;
        push(ms, "ws");
      }
      // Mnemonic
      if (p < codeEnd) {
        let me = p;
        while (me < codeEnd && line[me] !== " " && line[me] !== "\t") me++;
        push(me, "mnemonic");
        // Whitespace after mnemonic
        let oe = p;
        while (oe < codeEnd && (line[oe] === " " || line[oe] === "\t")) oe++;
        push(oe, "ws");
        // Operands
        push(codeEnd, "operand");
      }
    }
  }

  // Comment
  if (semi !== -1) push(n, "comment");

  return tokens;
}

// CSS class per token type
const TOKEN_CLASS: Record<TokenType, string> = {
  ws:        "",                               // invisible — just whitespace
  label:     "text-amber-400 font-semibold",
  directive: "text-violet-400 italic",
  mnemonic:  "text-cyan-300 font-bold",
  operand:   "text-gray-200",
  comment:   "text-emerald-400/80",
};

// ── Highlighted line renderer ─────────────────────────────────────────────────

function HighlightedLine({ line }: { line: string }) {
  if (!line) return <span>&nbsp;</span>; // empty line keeps height
  const tokens = tokenizeLine(line);
  return (
    <>
      {tokens.map((tok, i) =>
        tok.text ? (
          <span key={i} className={TOKEN_CLASS[tok.type] || ""}>
            {tok.text}
          </span>
        ) : null
      )}
    </>
  );
}

// ── Assembly Panel ────────────────────────────────────────────────────────────

// Shared font / spacing constants — must match between textarea and overlay.
const FONT_CLASS  = "font-mono text-[11.5px] leading-[1.6]";
const PAD_CLASS   = "px-2 pt-1 pb-4";
const GUTTER_W    = 36; // px

export default function AssemblyPanel() {
  const assemblySource    = useProgramDataStore((s) => s.assemblySource);
  const setAssemblySource = useProgramDataStore((s) => s.setAssemblySource);
  const assemblyErrors    = useProgramDataStore((s) => s.assemblyErrors);

  const isLoaded          = useExecutionStore((s) => s.isLoaded);
  const totalTicks        = useExecutionStore((s) => s.totalTicks);
  const isTimelineActive  = useExecutionStore((s) => s.isTimelineActive);
  const isRunning         = useProgramDataStore((s) => s.isRunning);

  const isLocked = isTimelineActive || isRunning;

  const activePreset = PRESET_PROGRAMS.find((p) => p.source === assemblySource) ?? null;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);
  const gutterRef   = useRef<HTMLDivElement>(null);

  // Sync scroll: textarea drives gutter + overlay
  const [scrollTop, setScrollTop] = useState(0);
  const handleScroll = () => {
    const top = textareaRef.current?.scrollTop ?? 0;
    setScrollTop(top);
  };

  useEffect(() => {
    if (gutterRef.current)  gutterRef.current.scrollTop  = scrollTop;
    if (overlayRef.current) overlayRef.current.scrollTop = scrollTop;
  }, [scrollTop]);

  function handlePresetChange(id: string) {
    const p = PRESET_PROGRAMS.find((x) => x.id === id);
    if (p) setAssemblySource(p.source);
  }

  const lines = assemblySource.split("\n");
  const lineCount = lines.length;

  return (
    <aside className="h-full flex flex-col bg-[var(--widget-surface-alt)] border-r border-gray-800 w-full overflow-hidden">

      {/* ── Header ── */}
      <div className="px-4 py-2 border-b border-gray-800 shrink-0 flex items-center justify-between">
        <h2 className="text-[12px] font-bold text-gray-200 tracking-wide uppercase">Assembly</h2>
        {isLocked && (
          <span className="text-[9px] font-mono text-amber-400/80 border border-amber-500/30 bg-amber-900/20 rounded px-1.5 py-0.5 tracking-wider uppercase">
            bloqueado
          </span>
        )}
      </div>

      {/* ── Preset selector ── */}
      <div className="px-3 py-2 border-b border-gray-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-gray-500 shrink-0 font-mono">Programa:</label>
          <select
            value={activePreset?.id ?? "__custom"}
            onChange={(e) => {
              if (e.target.value !== "__custom") handlePresetChange(e.target.value);
            }}
            disabled={isLocked}
            className="flex-1 text-[11px] font-mono bg-[var(--widget-surface-alt)] border border-gray-700 rounded px-2 py-0.5 text-gray-200 focus:outline-none focus:border-gray-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {!activePreset && (
              <option value="__custom" disabled className="text-gray-500">✎ Personalizado</option>
            )}
            {PRESET_PROGRAMS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {activePreset && (
          <p className="mt-0.5 text-[10px] text-gray-600 font-mono leading-snug pl-[4.5rem]">
            {activePreset.description}
          </p>
        )}
      </div>

      {/* ── Code Editor (flex-1) ── */}
      <div className={`flex-1 min-h-0 flex overflow-hidden relative bg-[var(--widget-surface)] transition-opacity duration-200 ${isLocked ? "opacity-60" : ""}`}>

        {/* Line number gutter */}
        <div
          ref={gutterRef}
          className={`shrink-0 overflow-hidden bg-[var(--widget-surface)] border-r border-gray-800/60 text-right select-none ${FONT_CLASS}`}
          style={{ width: GUTTER_W, paddingTop: "4px", paddingBottom: "16px", paddingRight: 6 }}
          aria-hidden
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="text-gray-600" style={{ lineHeight: "inherit" }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Highlight + textarea container */}
        <div className="flex-1 relative overflow-hidden">

          {/* Syntax-highlight overlay (pointer-events: none, behind textarea) */}
          <div
            ref={overlayRef}
            className={`absolute inset-0 overflow-hidden whitespace-pre pointer-events-none select-none ${FONT_CLASS} ${PAD_CLASS}`}
            aria-hidden
          >
            {lines.map((line, i) => (
              <div key={i} style={{ lineHeight: "inherit" }}>
                <HighlightedLine line={line} />
              </div>
            ))}
          </div>

          {/* Transparent textarea (editing surface) */}
          <textarea
            ref={textareaRef}
            value={assemblySource}
            onChange={(e) => { if (!isLocked) setAssemblySource(e.target.value); }}
            onScroll={handleScroll}
            readOnly={isLocked}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className={`absolute inset-0 w-full h-full bg-transparent resize-none focus:outline-none
              caret-amber-300 overflow-auto whitespace-pre ${FONT_CLASS} ${PAD_CLASS}
              ${isLocked ? "cursor-not-allowed" : ""}`}
            style={{ color: "transparent" }}
            aria-label="Assembly source code"
          />
        </div>
      </div>

      {/* ── Status / errors ── */}
      {(assemblyErrors.length > 0 || isLoaded || !assemblySource.trim()) && (
        <div className="px-3 py-2 space-y-1.5 shrink-0 border-t border-gray-800/60 bg-[var(--widget-surface)]">
          {assemblyErrors.length > 0 && (
            <div className="rounded border border-red-700/50 bg-red-900/20 px-2 py-1.5 space-y-0.5">
              <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest font-mono">
                Erros de montagem ({assemblyErrors.length})
              </p>
              {assemblyErrors.map((err, i) => (
                <div key={i} className="text-[10px] font-mono text-red-300">
                  <span className="text-red-500">L{err.line}:</span> {err.message}
                </div>
              ))}
            </div>
          )}
          {isLoaded && assemblyErrors.length === 0 && (
            <div className="rounded border border-emerald-700/50 bg-emerald-900/20 px-2 py-1 text-[10px] font-mono text-emerald-300">
              ✓ {totalTicks} ticks capturados.
            </div>
          )}
          {!assemblySource.trim() && (
            <div className="rounded border border-amber-600/40 bg-amber-900/20 px-2 py-1 text-[10px] font-mono text-amber-400">
              ⚠ Fonte vazia — usando programa de teste padrão
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
