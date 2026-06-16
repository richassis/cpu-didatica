/**
 * assembler.ts
 *
 * Stub assembler. Currently always returns null (not implemented).
 * Replace with a full parser when the assembler is ready.
 *
 * When null is returned, callers should fall back to loadTestProgram().
 */

/**
 * Attempt to assemble the given source string into an array of instruction words.
 *
 * @param source - Assembly source text
 * @returns Array of encoded instruction words, or null if assembly is not yet implemented / source is empty
 */
export function assemble(source: string): number[] | null {
  // Return null for empty/whitespace-only input
  if (!source.trim()) return null;

  // TODO: Implement full assembler parser.
  // For now, always fall back to loadTestProgram() behaviour.
  return null;
}
