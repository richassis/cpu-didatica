/**
 * codeFile.ts
 *
 * The single source of truth for the files the student exchanges with the
 * simulator: their assembly source, and nothing else.
 *
 * These strings used to be scattered — an `accept=".asm,.s"` on one input, a
 * hardcoded `"program.asm"` in the store, the same extensions repeated in
 * button titles and doc comments — with no way to tell which was authoritative.
 *
 * There is deliberately no simulator-specific extension. A program is text; any
 * text file is a valid import, and the extension on export is the student's
 * choice, not a format claim.
 */

/** Extensions the export dialog offers. Both are plain text. */
export const CODE_FILE_EXTENSIONS = [".asm", ".txt"] as const;
export type CodeFileExtension = (typeof CODE_FILE_EXTENSIONS)[number];

export const CODE_FILE_DEFAULT_EXTENSION: CodeFileExtension = ".asm";

export const CODE_FILE_MIME = "text/plain;charset=utf-8";

/**
 * Hints for the OS file picker. These only change which files it *highlights* —
 * the picker still offers everything, because any text file is importable.
 */
export const CODE_FILE_ACCEPT = "text/plain,.asm,.s,.txt,.inc";

/** Fallback name when the student clears the filename field. */
export const DEFAULT_PROGRAM_BASENAME = "programa";

/**
 * Extensions stripped when deriving a base name, so importing `soma.asm` and
 * saving as `.asm` gives `soma.asm` rather than `soma.asm.asm`.
 */
const STRIPPABLE_EXTENSIONS = [".asm", ".txt", ".s", ".text", ".inc"];

/** Longest name we will produce, to stay clear of filesystem limits. */
const MAX_BASENAME_LENGTH = 64;

/** Characters no filesystem we care about accepts inside a name. */
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001F]/g;

/**
 * Reduce arbitrary user input to something every filesystem accepts.
 *
 * Windows rejects `\ / : * ? " < > |` and trailing dots outright, so those go
 * regardless of the platform the student is on — the file may well be opened
 * somewhere other than where it was saved.
 */
export function sanitizeFileBaseName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(ILLEGAL_FILENAME_CHARS, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, MAX_BASENAME_LENGTH);

  return cleaned || DEFAULT_PROGRAM_BASENAME;
}

/** Drop a known code extension from a file name, leaving the stem. */
export function stripKnownExtension(name: string): string {
  const lower = name.toLowerCase();
  const match = STRIPPABLE_EXTENSIONS.find((ext) => lower.endsWith(ext));
  return match ? name.slice(0, -match.length) : name;
}

/** Full file name for a download, from a raw base name and a chosen extension. */
export function buildCodeFileName(base: string, extension: CodeFileExtension): string {
  return `${sanitizeFileBaseName(stripKnownExtension(base))}${extension}`;
}

/**
 * Base name to show in the export dialog for a file the student just opened.
 *
 * Unlike `buildCodeFileName` this drops *any* trailing extension, not only the
 * ones we produce: the import accepts every text file, so a `notas.md` should
 * come back as `notas`. A name the student types by hand keeps its dots.
 */
export function programNameFromFile(fileName: string): string {
  return sanitizeFileBaseName(fileName.replace(/\.[^.]{1,8}$/, ""));
}

/**
 * Rejects binaries without pretending to sniff file types properly. Text does
 * not contain NUL; every common binary does, well within the first kilobyte.
 */
export function looksBinary(text: string): boolean {
  return text.slice(0, 1024).includes("\u0000");
}
