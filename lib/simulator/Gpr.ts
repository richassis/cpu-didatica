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
 * - out_flagZero (1-bit, hidden): high while in_writeEnable is high and
 *   in_writeData is all zero bits — a comparator on the write-data bus, not a
 *   latch, so it reads 0 again as soon as the write tick passes. Lets a
 *   LDA/LDAI feed the UC's Z flag from the loaded value, the same way the
 *   ULA feeds it from a computed result.
 * - out_flagNegative (1-bit, hidden): same idea, high while writing a value
 *   whose sign bit (MSB) is set.
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
  /** Hidden: high while a write in progress is writing an all-zero value. */
  readonly out_flagZero: OutputPort<number>;
  /** Hidden: high while a write in progress is writing a negative (MSB-set) value. */
  readonly out_flagNegative: OutputPort<number>;

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
    this.out_flagZero = new OutputPort<number>("out_flagZero", "number", 1, 0);
    this.out_flagNegative = new OutputPort<number>("out_flagNegative", "number", 1, 0);

    // Wire up combinational read: when address changes, output updates immediately.
    this.in_readAddrA.onChange = (addr) => {
      this.out_readDataA.set(this._registers[this.clampIndex(addr)]);
    };
    this.in_readAddrB.onChange = (addr) => {
      this.out_readDataB.set(this._registers[this.clampIndex(addr)]);
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
      out_flagZero: this.out_flagZero,
      out_flagNegative: this.out_flagNegative,
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
    this.evaluate();
    this.commit();
  }

  /**
   * Combinational phase: refresh read outputs for current addresses, and the
   * hidden Z/N comparator on the write-data bus.
   */
  evaluate(): void {
    const readAddrA = this.clampIndex(this.in_readAddrA.get());
    const readAddrB = this.clampIndex(this.in_readAddrB.get());
    this.out_readDataA.set(this._registers[readAddrA]);
    this.out_readDataB.set(this._registers[readAddrB]);

    this.evaluateWriteFlags();
  }

  /**
   * Comparator on the write-data bus: high only while `in_writeEnable` is
   * high, so it pulses for exactly the tick a value is actually written and
   * reads 0 the rest of the time (there is no latch here — the UC is what
   * latches, in `latchFlagsIfProduced()`).
   */
  private evaluateWriteFlags(): void {
    const writeEnabled = this.in_writeEnable.get() !== 0;
    const value = this.in_writeData.get() & this.mask;
    this.out_flagZero.set(writeEnabled && value === 0 ? 1 : 0);
    this.out_flagNegative.set(writeEnabled && (value & (1 << (this.bitWidth - 1))) !== 0 ? 1 : 0);
  }

  private get mask(): number {
    return (1 << this.bitWidth) - 1;
  }

  /**
   * Sequential phase: apply pending write.
   */
  commit(): void {
    if (this.in_writeEnable.get()) {
      const addr = this.clampIndex(this.in_writeAddr.get());
      const mask = (1 << this.bitWidth) - 1;
      this._registers[addr] = this.in_writeData.get() & mask;

      // Keep outputs coherent when writing into currently selected read registers.
      if (addr === this.in_readAddrA.get()) {
        this.out_readDataA.set(this._registers[addr]);
      }
      if (addr === this.in_readAddrB.get()) {
        this.out_readDataB.set(this._registers[addr]);
      }
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
