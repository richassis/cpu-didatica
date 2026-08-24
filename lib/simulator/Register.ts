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

  /**
   * When true, commit() latches into `_pendingValue` instead of driving
   * `out_value`.  The pending value only reaches the output — and therefore the
   * widget, the wires and every downstream component — when the CPU releases it
   * at the start of the next FETCH.
   *
   * Used by the PC so the address of the next instruction does not appear while
   * the current instruction is still executing.
   */
  private readonly _holdOutputUntilFetch: boolean;

  /** Value latched by commit() but not yet released to `out_value`. */
  private _pendingValue: number | null = null;

  /**
   * When false, commit() is a no-op — the register holds its last value.
   * Set by the CPU on pipeline registers (A, B) so they only latch during
   * READREG states instead of on every tick.
   * Defaults to true so all other registers work without change.
   */
  private _writeActive = true;

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

  constructor(
    id: string,
    name: string,
    bitWidth = 16,
    initialValue = 0,
    hasWriteEnable = true,
    holdOutputUntilFetch = false,
  ) {
    this.id = id;
    this.name = name;
    this.bitWidth = bitWidth;
    this.hasWriteEnable = hasWriteEnable;
    this._holdOutputUntilFetch = holdOutputUntilFetch;

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

  setWriteActive(active: boolean): void {
    this._writeActive = active;
  }

  /** True when this register holds its new value back until the next FETCH. */
  get holdOutputUntilFetch(): boolean {
    return this._holdOutputUntilFetch;
  }

  /** Value latched but not yet released, or null when nothing is pending. */
  get pendingValue(): number | null {
    return this._pendingValue;
  }

  /** Restore a pending value (used when replaying timeline snapshots). */
  setPendingValue(v: number | null): void {
    this._pendingValue = v === null ? null : this.clamp(v);
  }

  /**
   * Release a held value onto the output port.
   *
   * Called by the CPU at the start of every FETCH, before the evaluate phase, so
   * the instruction memory and the PC+1 adder see the new address on the same
   * tick that uses it.  No-op unless this register holds its output.
   */
  releaseHeldOutput(): void {
    if (!this._holdOutputUntilFetch || this._pendingValue === null) return;
    this.out_value.set(this._pendingValue);
    this._pendingValue = null;
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
    this._pendingValue = null;
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
   * Sequential phase: latch data when write-enable is high and write is active.
   *
   * With `holdOutputUntilFetch` the latched value is parked in `_pendingValue`
   * and only reaches `out_value` on the next `releaseHeldOutput()`.
   */
  commit(): void {
    if (!this._writeActive) return;
    if (!this.in_writeEnable || this.in_writeEnable.value !== 0) {
      const next = this.clamp(this.in_data.value);
      if (this._holdOutputUntilFetch) {
        this._pendingValue = next;
      } else {
        this.out_value.set(next);
      }
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
