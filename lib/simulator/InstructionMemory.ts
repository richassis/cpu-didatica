import type { Clockable } from "./Clockable";
import { type Connectable, type PortMap, InputPort, OutputPort } from "./Port";

/**
 * Instruction Memory - Read-only memory for program instructions.
 *
 * A word-addressable read-only memory with configurable size and word width.
 * Typically used to store the program's instruction code.
 *
 * Port map:
 *  Inputs:
 *    addr    – address to read from
 *
 *  Output:
 *    out     – instruction data read from mem[addr]
 *
 * Data can be loaded via the load() method but not written through ports.
 * The output updates immediately when the address changes (combinational).
 *
 * Default: 256 words × 16 bits.
 */
export class InstructionMemory implements Clockable, Connectable {
  /** Unique ID matching the ComponentInstance id on the canvas. */
  readonly id: string;
  /** Human-readable name, e.g. "IMEM". */
  name: string;
  /** Number of addressable words (default 256). */
  readonly wordCount: number;
  /** Bit width of each word (default 16). */
  readonly bitWidth: number;

  // ── Internal storage ─────────────────────────────────────────

  private readonly _cells: Uint16Array | Uint8Array | Uint32Array;

  // ── Ports ────────────────────────────────────────────────────

  /** Input: address to read from. Bit width = ceil(log2(wordCount)). */
  readonly in_addr: InputPort<number>;

  /** Output: instruction data read from mem[addr]. */
  readonly out_instruction: OutputPort<number>;

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

    this.in_addr  = new InputPort<number>("addr", "number", addrBits, 0, "Instruction address");
    this.out_instruction = new OutputPort<number>("instruction", "number", bitWidth, 0, "Instruction output");

    // Set up auto-update when address changes
    this.in_addr.onChange = () => this.execute();
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    return {
      addr:        this.in_addr,
      instruction: this.out_instruction,
    };
  }

  // ── Accessors ────────────────────────────────────────────────

  /** Current instruction output value. */
  get output(): number {
    return this.out_instruction.value;
  }

  /** Read a word directly by address. */
  peek(addr: number): number {
    const a = this.clampAddr(addr);
    return this._cells[a];
  }

  /** Write a word directly by address (for loading instructions). */
  poke(addr: number, value: number): void {
    const a = this.clampAddr(addr);
    this._cells[a] = this.clampWord(value);
  }

  /** Return a shallow copy of all cells as a plain number array. */
  dump(): number[] {
    return Array.from(this._cells);
  }

  /** Load a flat array of instructions into memory starting at address 0. */
  load(instructions: number[]): void {
    const count = Math.min(instructions.length, this.wordCount);
    for (let i = 0; i < count; i++) {
      this._cells[i] = this.clampWord(instructions[i]);
    }
  }

  // ── Core ─────────────────────────────────────────────────────

  /**
   * Evaluate one read cycle.
   * Drives out_instruction with the value at mem[addr].
   * This happens combinationally (no clock needed).
   */
  execute(): void {
    const addr = this.clampAddr(this.in_addr.value);
    this.out_instruction.set(this._cells[addr]);
  }

  /** Called by the global Clock on each tick. */
  onTick(): void {
    this.execute();
  }

  /** Reset all cells to zero and clear the output port. */
  reset(): void {
    this._cells.fill(0);
    this.out_instruction.set(0);
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
