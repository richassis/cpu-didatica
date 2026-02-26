import type { ClockStep, Clockable } from "./Clockable";

/**
 * Data model for a single CPU register.
 *
 * Each Register holds a fixed-width unsigned integer value (default 16-bit).
 * The UI RegisterComponent reads from this object.
 */
export class Register implements Clockable {
  // ── Clockable ────────────────────────────────────────────────
  readonly clockSteps: ClockStep[] = ["WRITEBACK"];
  /** Unique ID matching the ComponentInstance id on the canvas */
  readonly id: string;
  /** Human-readable name, e.g. "PC", "IR", "MAR" */
  name: string;
  /** Bit width of this register (default 16) */
  readonly bitWidth: number;
  /** Internal numeric value (always unsigned, clamped to bitWidth) */
  private _value: number;

  constructor(id: string, name: string, bitWidth = 16, initialValue = 0) {
    this.id = id;
    this.name = name;
    this.bitWidth = bitWidth;
    this._value = this.clamp(initialValue);
  }

  // ── Accessors ────────────────────────────────────────────────

  get value(): number {
    return this._value;
  }

  /** Set the register value, clamping to the valid range. */
  set value(v: number) {
    this._value = this.clamp(v);
  }

  /** Return the value as a zero-padded hex string, e.g. "00FF". */
  toHex(): string {
    const digits = Math.ceil(this.bitWidth / 4);
    return "0x" + this._value.toString(16).padStart(digits, "0").toUpperCase();
  }

  // ── Operations (stubs – will be fleshed out later) ───────────

  /** Reset the register to zero. */
  reset(): void {
    this._value = 0;
  }

  // ── Clockable callback ───────────────────────────────────────

  /**
   * Called by the global clock on each subscribed step.
   * Stub: will contain latch / load logic once connections exist.
   */
  onClockStep(step: ClockStep): void {
    switch (step) {
      case "WRITEBACK":
        // TODO: latch the incoming value from a connected source
        break;
      default:
        break;
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
