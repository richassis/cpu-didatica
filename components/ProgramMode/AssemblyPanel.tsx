"use client";

import { useEffect, useRef, useState } from "react";
import { useProgramDataStore } from "@/lib/programDataStore";
import { useExecutionStore } from "@/lib/executionStore";
import { PRESET_PROGRAMS } from "@/lib/presetPrograms";

// ── Syntax tokenizer ──────────────────────────────────────────────────────────
// Splits a source line into segments, preserving every character so that the
// concatenation of all segment.text === rawLine (required for cursor alignment).

type TokenType = "ws" | "label" | "directive" | "mnemonic" | "register" | "literal" | "comment";

interface Token { text: string; type: TokenType }

/**
 * Canonical register spelling, kept identical to `parseRegister` in
 * lib/assembler.ts. If the two ever disagree, the editor paints something the
 * assembler will not accept.
 */
const REGISTER_RE = /^[Rr][0-7]$/;

/**
 * Split the operand run into registers, literals and the punctuation between
 * them. Every character is preserved, including separators, because the
 * overlay has to stay glyph-for-glyph aligned with the textarea underneath it.
 */
function pushOperands(text: string, tokens: Token[]) {
  for (const piece of text.split(/([^A-Za-z0-9_]+)/)) {
    if (!piece) continue;
    if (/^[^A-Za-z0-9_]+$/.test(piece)) tokens.push({ text: piece, type: "ws" });
    else if (REGISTER_RE.test(piece)) tokens.push({ text: piece, type: "register" });
    else tokens.push({ text: piece, type: "literal" });
  }
}

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
        if (codeEnd > p) {
          pushOperands(line.slice(p, codeEnd), tokens);
          p = codeEnd;
        }
      }
    }
  }

  // Comment
  if (semi !== -1) push(n, "comment");

  return tokens;
}

// CSS class per token type
const TOKEN_CLASS: Record<TokenType, string> = {
  ws:        "",                    // invisible — whitespace and separators
  label:     "text-st-warn",
  directive: "text-fg-muted",
  mnemonic:  "text-st-data",
  register:  "text-fg",
  literal:   "text-st-active",
  comment:   "text-fg-faint italic",
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
const FONT_CLASS  = "font-mono text-[13px] leading-[1.6]";
const PAD_CLASS   = "px-2 pt-1 pb-4";
const GUTTER_W    = 36; // px

export default function AssemblyPanel() {
  const assemblySource    = useProgramDataStore((s) => s.assemblySource);
  const setAssemblySource = useProgramDataStore((s) => s.setAssemblySource);
  const assemblyErrors    = useProgramDataStore((s) => s.assemblyErrors);
  const assembled         = useProgramDataStore((s) => s.assembled);

  const isLoaded          = useExecutionStore((s) => s.isLoaded);
  const totalTicks        = useExecutionStore((s) => s.totalTicks);
  const isTimelineActive  = useExecutionStore((s) => s.isTimelineActive);
  const frames            = useExecutionStore((s) => s.frames);
  const currentIndex      = useExecutionStore((s) => s.currentIndex);
  const isRunning         = useProgramDataStore((s) => s.isRunning);

  const isLocked = isTimelineActive || isRunning;

  // The line executing right now, if any — the PC is stable across every tick
  // of one instruction, so this only changes at FETCH.
  const currentPc = isTimelineActive ? frames[currentIndex]?.postTick?.pc : undefined;
  const currentLine =
    assembled && currentPc !== undefined ? assembled.lineForAddress[currentPc] : undefined;

  const activePreset = PRESET_PROGRAMS.find((p) => p.source === assemblySource) ?? null;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);
  const gutterRef   = useRef<HTMLDivElement>(null);

  // Sync scroll: textarea drives gutter + overlay. Both axes — a long line
  // scrolls the textarea horizontally too, and without mirroring scrollLeft
  // the highlighted text (and the line highlight) drift out from under it.
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const handleScroll = () => {
    setScrollTop(textareaRef.current?.scrollTop ?? 0);
    setScrollLeft(textareaRef.current?.scrollLeft ?? 0);
  };

  useEffect(() => {
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
    if (overlayRef.current) {
      overlayRef.current.scrollTop = scrollTop;
      overlayRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollTop, scrollLeft]);

  function handlePresetChange(id: string) {
    const p = PRESET_PROGRAMS.find((x) => x.id === id);
    if (p) setAssemblySource(p.source);
  }

  const lines = assemblySource.split("\n");
  const lineCount = lines.length;

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-line bg-surface">

      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2">
        <h2 className="t-panel text-fg">Assembly</h2>
        {isLocked && (
          <span className="rounded-md border border-st-warn px-1.5 py-0.5 font-mono text-[10px] text-st-warn">
            travado
          </span>
        )}
      </div>

      {/* ── Preset selector ── */}
      <div className="shrink-0 border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <label className="t-section shrink-0">Programa</label>
          <select
            value={activePreset?.id ?? "__custom"}
            onChange={(e) => {
              if (e.target.value !== "__custom") handlePresetChange(e.target.value);
            }}
            disabled={isLocked}
            className="h-9 flex-1 cursor-pointer rounded-lg border border-line bg-sunken px-2 font-mono text-[11px] text-fg focus:border-line-strong focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {!activePreset && (
              <option value="__custom" disabled>Personalizado</option>
            )}
            {PRESET_PROGRAMS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {activePreset && (
          <p className="mt-1 text-[11px] leading-snug text-fg-faint">
            {activePreset.description}
          </p>
        )}
      </div>

      {/* ── Code Editor (flex-1) ── */}
      <div className={`relative flex min-h-0 flex-1 overflow-hidden bg-sunken transition-opacity duration-200 ${isLocked ? "opacity-60" : ""}`}>

        {/* Line number gutter */}
        <div
          ref={gutterRef}
          className={`shrink-0 select-none overflow-hidden border-r border-line text-right ${FONT_CLASS}`}
          style={{ width: GUTTER_W, paddingTop: "4px", paddingBottom: "16px", paddingRight: 6 }}
          aria-hidden
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="relative num text-fg-faint" style={{ lineHeight: "inherit" }}>
              {currentLine === i + 1 && (
                <span
                  className="absolute -left-0.5 top-0 bottom-0 w-0.5 rounded-full bg-st-active"
                  aria-hidden
                />
              )}
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
            {lines.map((line, i) => {
              const isCurrent = currentLine === i + 1;
              return (
                <div
                  key={i}
                  className={isCurrent ? "-mx-2 px-2" : undefined}
                  style={{
                    lineHeight: "inherit",
                    background: isCurrent
                      ? "color-mix(in srgb, var(--st-active) 12%, transparent)"
                      : undefined,
                  }}
                >
                  <HighlightedLine line={line} />
                </div>
              );
            })}
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
              caret-st-active overflow-auto whitespace-pre ${FONT_CLASS} ${PAD_CLASS}
              ${isLocked ? "cursor-not-allowed" : ""}`}
            style={{ color: "transparent" }}
            aria-label="Código-fonte assembly"
          />
        </div>
      </div>

      {/* ── Status / errors ── */}
      {(assemblyErrors.length > 0 || isLoaded || !assemblySource.trim()) && (
        <div className="shrink-0 space-y-1.5 border-t border-line px-3 py-2">
          {assemblyErrors.length > 0 && (
            <div className="space-y-0.5 rounded-lg border border-st-error px-2 py-1.5">
              <p className="font-mono text-[11px] text-st-error">
                Erros de montagem ({assemblyErrors.length})
              </p>
              {assemblyErrors.map((err, i) => (
                <div key={i} className="font-mono text-[11px] text-fg-muted">
                  <span className="text-st-error">L{err.line}:</span> {err.message}
                </div>
              ))}
            </div>
          )}
          {isLoaded && assemblyErrors.length === 0 && (
            <div className="rounded-lg border border-st-active px-2 py-1 font-mono text-[11px] text-st-active">
              {totalTicks} ticks capturados
            </div>
          )}
          {!assemblySource.trim() && (
            <div className="rounded-lg border border-st-warn px-2 py-1 font-mono text-[11px] text-st-warn">
              Código vazio — o programa de teste padrão será usado
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
