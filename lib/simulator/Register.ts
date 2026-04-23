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
  /** Whether this register exposes a write-enable input port */
  readonly hasWriteEnable: boolean;

  // ── Ports ────────────────────────────────────────────────────

  /** Input: value to latch into the register. */
  readonly in_data: InputPort<number>;

  /** Optional input: write-enable signal (1 = latch on tick, 0 = hold). */
  readonly in_writeEnable?: InputPort<number>;

  /** Output: current register value. */
  readonly out_value: OutputPort<number>;

  /**
   * Snapshot of out_value captured in evaluate(), before commit() overwrites it.
   * Used by the animation system to show the value that was *sent* on the wire
   * during this tick (i.e. the pre-commit value), not the newly latched value.
   */
  private _preCommitValue: number = 0;

  constructor(id: string, name: string, bitWidth = 16, initialValue = 0, hasWriteEnable = true) {
    this.id = id;
    this.name = name;
    this.bitWidth = bitWidth;
    this.hasWriteEnable = hasWriteEnable;

    // Create input ports
    this.in_data = new InputPort<number>(
      "data", "number", bitWidth, 0,
      "Data input to be latched"
    );
    if (this.hasWriteEnable) {
      this.in_writeEnable = new InputPort<number>(
        "writeEnable", "number", 1, 1,
        "Write-enable signal (1 = latch, 0 = hold)"
      );
    }

    // Create output port
    this.out_value = new OutputPort<number>(
      "value", "number", bitWidth, this.clamp(initialValue),
      "Current register value"
    );
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    const ports: PortMap = {
      data: this.in_data,
      value: this.out_value,
    };

    if (this.in_writeEnable) {
      ports.writeEnable = this.in_writeEnable;
    }

    return ports;
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
    this.commit();
  }

  /**
   * Combinational phase: snapshot the current output value before commit runs.
   * This lets the animation overlay read the pre-commit value (i.e. what was
   * actually driving downstream inputs during this tick) via `preCommitValue`.
   */
  evaluate(): void {
    this._preCommitValue = this.out_value.value;
  }

  /**
   * Sequential phase: latch data when write-enable is high.
   */
  commit(): void {
    if (!this.in_writeEnable || this.in_writeEnable.value !== 0) {
      this.out_value.set(this.clamp(this.in_data.value));
    }
  }

  /**
   * The value of `out_value` captured just before the last `commit()` call.
   * Use this in animations to show what the register was *outputting* during
   * the tick, not what it received.
   */
  get preCommitValue(): number {
    return this._preCommitValue;
  }

  // ── Helpers ──────────────────────────────────────────────────

  private get max(): number {
    return (1 << this.bitWidth) - 1;
  }

  private clamp(v: number): number {
    return Math.max(0, Math.min(this.max, Math.floor(v)));
  }
}
