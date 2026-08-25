"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProgramDataStore } from "@/lib/programDataStore";
import {
  CODE_FILE_EXTENSIONS,
  buildCodeFileName,
  sanitizeFileBaseName,
  stripKnownExtension,
  type CodeFileExtension,
} from "@/lib/codeFile";

interface Props {
  onClose: () => void;
}

/**
 * "Salvar programa" — the export surface.
 *
 * Exporting used to be a button that dropped `program.asm` into the downloads
 * folder with no say from the student: same name every time, so a second save
 * became `program (1).asm`. Naming the file is the whole point of the dialog;
 * the counts are there so it is obvious *what* is being saved before it lands
 * on disk.
 */
export default function SaveProgramDialog({ onClose }: Props) {
  const assemblySource = useProgramDataStore((s) => s.assemblySource);
  const storedName = useProgramDataStore((s) => s.programName);
  const setProgramName = useProgramDataStore((s) => s.setProgramName);
  const exportAssembly = useProgramDataStore((s) => s.exportAssembly);

  const [baseName, setBaseName] = useState(storedName);
  const [extension, setExtension] = useState<CodeFileExtension>(".asm");
  const inputRef = useRef<HTMLInputElement>(null);

  // Select rather than just focus: the field is prefilled, and the student's
  // first keystroke should replace the suggestion instead of appending to it.
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const fileName = buildCodeFileName(baseName, extension);

  const lineCount = useMemo(() => assemblySource.split("\n").length, [assemblySource]);

  // TextEncoder, not `.length` — the preset programs carry accented Portuguese
  // comments, so characters and bytes are different numbers.
  const byteCount = useMemo(
    () => new TextEncoder().encode(assemblySource).length,
    [assemblySource]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Remember the cleaned-up name, so the next save opens on it rather than
    // on whatever raw text was typed here.
    setProgramName(sanitizeFileBaseName(stripKnownExtension(baseName)));
    exportAssembly(fileName);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-program-title"
        className="w-[420px] max-w-full rounded-2xl border border-line bg-surface p-6"
      >
        <h3 id="save-program-title" className="t-panel mb-5 text-fg">
          Salvar programa
        </h3>

        <label className="t-section mb-1.5 block" htmlFor="save-program-name">
          Nome
        </label>
        <input
          id="save-program-name"
          ref={inputRef}
          value={baseName}
          onChange={(e) => setBaseName(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="mb-1.5 h-9 w-full rounded-lg border border-line bg-sunken px-2.5 font-mono text-xs text-fg focus:border-line-strong focus:outline-none"
        />

        <p className="mb-5 font-mono text-[11px] text-fg-faint">
          Será salvo como <span className="text-fg-muted">{fileName}</span>
        </p>

        <span className="t-section mb-1.5 block">Tipo</span>
        <div className="mb-5 flex items-center gap-1">
          {CODE_FILE_EXTENSIONS.map((ext) => (
            <button
              key={ext}
              type="button"
              onClick={() => setExtension(ext)}
              aria-pressed={extension === ext}
              className={`flex-1 rounded-lg border px-2 py-1.5 font-mono text-xs transition-colors ${
                extension === ext
                  ? "border-st-active text-st-active"
                  : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
              }`}
            >
              {ext}
            </button>
          ))}
        </div>

        <div className="mb-5 border-t border-line pt-3 font-mono text-[11px] text-fg-faint">
          {lineCount} {lineCount === 1 ? "linha" : "linhas"} · {byteCount} bytes
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-line px-3 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="h-8 rounded-lg border border-st-active px-3 text-xs text-st-active transition-colors hover:bg-st-active/10"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
