import type { Clockable } from "./Clockable";
import { InputPort, OutputPort, type Connectable, type PortMap } from "./Port";

/**
 * Data model for a General Purpose Register bank.
 *
 * Contains N registers (default 8: R0–R7), each with the same bit width.
 * The UI GprComponent reads from this object.
 *
 * Ports:
 * - in_readAddrA  (3-bit): address for read port A
 * - in_readAddrB  (3-bit): address for read port B
 * - in_writeAddr  (3-bit): address for write port
 * - in_writeData  (16-bit): data to write
 * - in_writeEnable (1-bit): if high, latch in_writeData into addressed register on tick
 * - out_readDataA (16-bit): data read from register at in_readAddrA
 * - out_readDataB (16-bit): data read from register at in_readAddrB
 */
export class Gpr implements Clockable, Connectable {
  /** Unique ID matching the ComponentInstance id on the canvas */
  readonly id: string;
  /** Human-readable bank name, e.g. "GPR1" */
  name: string;
  /** Number of bits per register */
  readonly bitWidth: number;
  /** Internal register storage */
  private readonly _registers: number[];

  // ── Input Ports ──────────────────────────────────────────────
  readonly in_readAddrA: InputPort<number>;
  readonly in_readAddrB: InputPort<number>;
  readonly in_writeAddr: InputPort<number>;
  readonly in_writeData: InputPort<number>;
  readonly in_writeEnable: InputPort<number>;

  // ── Output Ports ─────────────────────────────────────────────
  readonly out_readDataA: OutputPort<number>;
  readonly out_readDataB: OutputPort<number>;

  constructor(
    id: string,
    name: string,
    registerCount = 8,
    bitWidth = 16,
  ) {
    this.id = id;
    this.name = name;
    this.bitWidth = bitWidth;
    this._registers = Array.from({ length: registerCount }, () => 0);

    // Address ports use 3 bits (for 8 registers)
    const addrBits = Math.ceil(Math.log2(registerCount));

    // Input ports
    this.in_readAddrA = new InputPort<number>("in_readAddrA", "number", addrBits, 0);
    this.in_readAddrB = new InputPort<number>("in_readAddrB", "number", addrBits, 0);
    this.in_writeAddr = new InputPort<number>("in_writeAddr", "number", addrBits, 0);
    this.in_writeData = new InputPort<number>("in_writeData", "number", bitWidth, 0);
    this.in_writeEnable = new InputPort<number>("in_writeEnable", "number", 1, 0);

    // Output ports - update immediately when read addresses change
    this.out_readDataA = new OutputPort<number>("out_readDataA", "number", bitWidth, 0);
    this.out_readDataB = new OutputPort<number>("out_readDataB", "number", bitWidth, 0);

    // Wire up combinational read: when address changes, output updates
    this.in_readAddrA.onChange = (addr) => {
      const idx = this.clampIndex(addr);
      this.out_readDataA.set(this._registers[idx]);
    };
    this.in_readAddrB.onChange = (addr) => {
      const idx = this.clampIndex(addr);
      this.out_readDataB.set(this._registers[idx]);
    };
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    return {
      in_readAddrA: this.in_readAddrA,
      in_readAddrB: this.in_readAddrB,
      in_writeAddr: this.in_writeAddr,
      in_writeData: this.in_writeData,
      in_writeEnable: this.in_writeEnable,
      out_readDataA: this.out_readDataA,
      out_readDataB: this.out_readDataB,
    };
  }

  // ── Accessors ────────────────────────────────────────────────

  /** Number of registers in this bank. */
  get count(): number {
    return this._registers.length;
  }

  /** Read a register by index (direct access, bypasses ports). */
  read(index: number): number {
    this.assertIndex(index);
    return this._registers[index];
  }

  /** Read a register and return its hex string. */
  readHex(index: number): string {
    this.assertIndex(index);
    return this._registers[index].toString(16).toUpperCase().padStart(this.bitWidth / 4, "0");
  }

  /** Write a value into a register by index (direct access, bypasses ports). */
  write(index: number, value: number): void {
    this.assertIndex(index);
    const mask = (1 << this.bitWidth) - 1;
    this._registers[index] = value & mask;
    // Update outputs if the written register is currently being read
    if (index === this.in_readAddrA.get()) {
      this.out_readDataA.set(this._registers[index]);
    }
    if (index === this.in_readAddrB.get()) {
      this.out_readDataB.set(this._registers[index]);
    }
  }

  // ── Bulk operations ──────────────────────────────────────────

  /** Reset every register to zero. */
  resetAll(): void {
    for (let i = 0; i < this._registers.length; i++) {
      this._registers[i] = 0;
    }
    this.out_readDataA.set(0);
    this.out_readDataB.set(0);
  }

  /** Return a snapshot of all register values (useful for diffing / UI). */
  snapshot(): { name: string; value: number }[] {
    return this._registers.map((val, i) => ({ name: `R${i}`, value: val }));
  }

  snapshotHex(): { name: string; value: string }[] {
    return this._registers.map((val, i) => ({
      name: `R${i}`,
      value: val.toString(16).toUpperCase().padStart(this.bitWidth / 4, "0"),
    }));
  }

  // ── Clockable callback ───────────────────────────────────────

  /**
   * Called by the global clock on each tick.
   * Latches in_writeData into register at in_writeAddr if in_writeEnable is high.
   */
  onTick(): void {
    const readAddrA = this.clampIndex(this.in_readAddrA.get());
    const readAddrB = this.clampIndex(this.in_readAddrB.get());
    this.out_readDataA.set(this._registers[readAddrA]);
    this.out_readDataB.set(this._registers[readAddrB]);
    
    if (this.in_writeEnable.get()) {
      const addr = this.clampIndex(this.in_writeAddr.get());
      const mask = (1 << this.bitWidth) - 1;
      this._registers[addr] = this.in_writeData.get() & mask;

    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private assertIndex(i: number): void {
    if (i < 0 || i >= this._registers.length) {
      throw new RangeError(
        `Register index ${i} out of range [0, ${this._registers.length - 1}]`,
      );
    }
  }

  private clampIndex(i: number): number {
    return Math.max(0, Math.min(this._registers.length - 1, i));
  }
}
