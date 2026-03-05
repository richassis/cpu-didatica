import type { Clockable } from "./Clockable";
import { type Connectable, type PortMap, InputPort, OutputPort } from "./Port";

/**
 * Unified Memory data model.
 *
 * A word-addressable memory with configurable size and word width.
 *
 * Port map:
 *  Inputs:
 *    addr    – address to read from or write to
 *    data    – data to write (only relevant when wrMem = 1)
 *    rdMem   – read-enable  (1 = drive out_data with mem[addr] on tick)
 *    wrMem   – write-enable (1 = write data input to mem[addr] on tick)
 *
 *  Output:
 *    out     – data read from mem[addr] (0 when rdMem = 0)
 *
 * Both rdMem and wrMem are evaluated on every clock tick.
 * If both are 1 simultaneously, the write happens first, then the read.
 *
 * Default: 256 words × 16 bits.
 */
export class Memory implements Clockable, Connectable {
  /** Unique ID matching the ComponentInstance id on the canvas. */
  readonly id: string;
  /** Human-readable name, e.g. "MEM". */
  name: string;
  /** Number of addressable words (default 256). */
  readonly wordCount: number;
  /** Bit width of each word (default 16). */
  readonly bitWidth: number;

  // ── Internal storage ─────────────────────────────────────────

  private readonly _cells: Uint16Array | Uint8Array | Uint32Array;

  // ── Ports ────────────────────────────────────────────────────

  /** Input: address to access. Bit width = ceil(log2(wordCount)). */
  readonly in_addr: InputPort<number>;
  /** Input: data to write into memory. */
  readonly in_data: InputPort<number>;
  /** Input: read-enable control signal (1 = read on tick). */
  readonly in_rdMem: InputPort<number>;
  /** Input: write-enable control signal (1 = write on tick). */
  readonly in_wrMem: InputPort<number>;

  /** Output: data read from mem[addr] (only valid after rdMem tick). */
  readonly out_data: OutputPort<number>;

  constructor(id: string, name: string, wordCount = 256, bitWidth = 16) {
    this.id        = id;
    this.name      = name;
    this.wordCount = wordCount;
    this.bitWidth  = bitWidth;

    // Allocate typed array matched to word width
    if (bitWidth <= 8) {
      this._cells = new Uint8Array(wordCount);
    } else if (bitWidth <= 16) {
      this._cells = new Uint16Array(wordCount);
    } else {
      this._cells = new Uint32Array(wordCount);
    }

    const addrBits = Math.max(1, Math.ceil(Math.log2(wordCount)));

    this.in_addr  = new InputPort<number>("addr",  "number",  addrBits, 0,  "Memory address");
    this.in_data  = new InputPort<number>("data",  "number",  bitWidth, 0,  "Data input (write)");
    this.in_rdMem = new InputPort<number>("rdMem", "number",  1,        0,  "Read-enable (1 = read on tick)");
    this.in_wrMem = new InputPort<number>("wrMem", "number",  1,        0,  "Write-enable (1 = write on tick)");

    this.out_data = new OutputPort<number>("out", "number", bitWidth, 0, "Data output (read)");
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    return {
      addr:  this.in_addr,
      data:  this.in_data,
      rdMem: this.in_rdMem,
      wrMem: this.in_wrMem,
      out:   this.out_data,
    };
  }

  // ── Accessors ────────────────────────────────────────────────

  /** Current read output value. */
  get output(): number {
    return this.out_data.value;
  }

  /** Read a word directly by address (bypasses rdMem gate). */
  peek(addr: number): number {
    const a = this.clampAddr(addr);
    return this._cells[a];
  }

  /** Write a word directly by address (bypasses wrMem gate). */
  poke(addr: number, value: number): void {
    const a = this.clampAddr(addr);
    this._cells[a] = this.clampWord(value);
  }

  /** Return a shallow copy of all cells as a plain number array. */
  dump(): number[] {
    return Array.from(this._cells);
  }

  /** Load a flat array of values into memory starting at address 0. */
  load(words: number[]): void {
    const count = Math.min(words.length, this.wordCount);
    for (let i = 0; i < count; i++) {
      this._cells[i] = this.clampWord(words[i]);
    }
  }

  // ── Core ─────────────────────────────────────────────────────

  /**
   * Evaluate one memory access cycle.
   *
   * If wrMem is 1 → write data to mem[addr].
   * If rdMem is 1 → drive out_data with mem[addr].
   * If rdMem is 0 → out_data is held at its previous value (bus hold).
   *
   * Write-before-read ordering means a simultaneous read+write returns
   * the newly written value.
   */
  execute(): void {
    const addr  = this.clampAddr(this.in_addr.value);
    const wr    = this.in_wrMem.value !== 0;
    const rd    = this.in_rdMem.value !== 0;

    if (wr) {
      this._cells[addr] = this.clampWord(this.in_data.value);
    }

    if (rd) {
      this.out_data.set(this._cells[addr]);
    }
  }

  /** Called by the global Clock on each tick. */
  onTick(): void {
    this.execute();
  }

  /** Reset all cells to zero and clear the output port. */
  reset(): void {
    this._cells.fill(0);
    this.out_data.set(0);
  }

  // ── Helpers ──────────────────────────────────────────────────

  private clampAddr(addr: number): number {
    return Math.max(0, Math.min(this.wordCount - 1, addr >>> 0));
  }

  private clampWord(v: number): number {
    return (v >>> 0) & this.wordMask;
  }

  private get wordMask(): number {
    return this.bitWidth >= 32 ? 0xffffffff : (1 << this.bitWidth) - 1;
  }
}
