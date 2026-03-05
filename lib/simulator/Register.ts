import type { Clockable } from "./Clockable";
import { type Connectable, type PortMap, InputPort, OutputPort } from "./Port";

/**
 * Data model for a single CPU register.
 *
 * Each Register holds a fixed-width unsigned integer value (default 16-bit).
 * The UI RegisterComponent reads from this object.
 */
export class Register implements Clockable, Connectable {
  /** Unique ID matching the ComponentInstance id on the canvas */
  readonly id: string;
  /** Human-readable name, e.g. "PC", "IR", "MAR" */
  name: string;
  /** Bit width of this register (default 16) */
  readonly bitWidth: number;

  // ── Ports ────────────────────────────────────────────────────

  /** Input: value to latch into the register. */
  readonly in_data: InputPort<number>;

  /** Input: write-enable signal (1 = latch on tick, 0 = hold). */
  readonly in_writeEnable: InputPort<number>;

  /** Output: current register value. */
  readonly out_value: OutputPort<number>;

  constructor(id: string, name: string, bitWidth = 16, initialValue = 0) {
    this.id = id;
    this.name = name;
    this.bitWidth = bitWidth;

    // Create input ports
    this.in_data = new InputPort<number>(
      "data", "number", bitWidth, 0,
      "Data input to be latched"
    );
    this.in_writeEnable = new InputPort<number>(
      "writeEnable", "number", 1, 0,
      "Write-enable signal (1 = latch, 0 = hold)"
    );

    // Create output port
    this.out_value = new OutputPort<number>(
      "value", "number", bitWidth, this.clamp(initialValue),
      "Current register value"
    );
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    return {
      data: this.in_data,
      writeEnable: this.in_writeEnable,
      value: this.out_value,
    };
  }

  // ── Accessors ────────────────────────────────────────────────

  get value(): number {
    return this.out_value.value;
  }

  /** Set the register value directly (bypasses write-enable). */
  set value(v: number) {
    this.out_value.set(this.clamp(v));
  }

  /** Return the value as a zero-padded hex string, e.g. "0x00FF". */
  toHex(): string {
    const digits = Math.ceil(this.bitWidth / 4);
    return "0x" + this.out_value.value.toString(16).padStart(digits, "0").toUpperCase();
  }

  // ── Operations ───────────────────────────────────────────────

  /** Reset the register to zero. */
  reset(): void {
    this.out_value.set(0);
  }

  // ── Clockable callback ───────────────────────────────────────

  /**
   * Called by the global clock on each tick.
   * If write-enable is high, latch the data input.
   */
  onTick(): void {
    if (this.in_writeEnable.value !== 0) {
      this.out_value.set(this.clamp(this.in_data.value));
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private get max(): number {
    return (1 << this.bitWidth) - 1;
  }

  private clamp(v: number): number {
    return Math.max(0, Math.min(this.max, Math.floor(v)));
  }
}
