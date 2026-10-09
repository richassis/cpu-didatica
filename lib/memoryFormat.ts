/**
 * memoryFormat.ts
 *
 * What every address listing (the canvas memories, the memory panel, the
 * modal viewer, the Ling. Máquina panel) shares, so the same address never
 * reads differently in two places.
 */

/** Address bits a memory of `wordCount` words needs — at least one. */
export function addrBitsFor(wordCount: number): number {
  return Math.max(1, Math.ceil(Math.log2(wordCount)));
}

/** `0x`-prefixed hex address, zero-padded to the width of the address bus. */
export function fmtAddr(addr: number, addrBits: number): string {
  return "0x" + addr.toString(16).toUpperCase().padStart(Math.ceil(addrBits / 4), "0");
}

/** Background of the row at the memory's address port. */
export const ADDRESS_HIGHLIGHT_BG = "color-mix(in srgb, var(--st-data) 8%, transparent)";
