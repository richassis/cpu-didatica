import type { ClockStep, Clockable } from "./Clockable";

/**
 * Supported ALU operations.
 * Extend this union as new operations are added.
 */
export type UlaOperation = "ADD" | "SUB" | "AND" | "OR" | "XOR" | "NOT" | "SHL" | "SHR" | "NOP";

/**
 * Data model for the Arithmetic Logic Unit (ULA / ALU).
 *
 * Holds two operand inputs, an operation selector, and produces a result
 * plus status flags.  The UI UlaComponent reads from this object.
 */
export class Ula implements Clockable {
  // ── Clockable ────────────────────────────────────────────────
  readonly clockSteps: ClockStep[] = ["EXECUTE"];
  /** Unique ID matching the ComponentInstance id on the canvas */
  readonly id: string;
  /** Human-readable name, e.g. "ULA1" */
  name: string;
  /** Bit width for operands / result (default 16) */
  readonly bitWidth: number;

  /** Current operation */
  private _operation: UlaOperation;
  /** Operand A */
  private _a: number;
  /** Operand B */
  private _b: number;
  /** Cached result (re-computed on execute) */
  private _result: number;

  // ── Status flags ─────────────────────────────────────────────
  /** Result is zero */
  zero: boolean;
  /** Result overflowed */
  carry: boolean;
  /** Result is negative (MSB set) */
  negative: boolean;

  constructor(id: string, name: string, bitWidth = 16) {
    this.id = id;
    this.name = name;
    this.bitWidth = bitWidth;

    this._operation = "NOP";
    this._a = 0;
    this._b = 0;
    this._result = 0;

    this.zero = true;
    this.carry = false;
    this.negative = false;
  }

  // ── Accessors ────────────────────────────────────────────────

  get operation(): UlaOperation {
    return this._operation;
  }

  set operation(op: UlaOperation) {
    this._operation = op;
  }

  get a(): number {
    return this._a;
  }

  set a(v: number) {
    this._a = this.clamp(v);
  }

  get b(): number {
    return this._b;
  }

  set b(v: number) {
    this._b = this.clamp(v);
  }

  get result(): number {
    return this._result;
  }

  /** Return the result as a zero-padded hex string. */
  resultHex(): string {
    const digits = Math.ceil(this.bitWidth / 4);
    return this._result.toString(16).padStart(digits, "0").toUpperCase();
  }

  // ── Core ─────────────────────────────────────────────────────

  /**
   * Execute the current operation on a and b, storing the result
   * and updating status flags. Returns the numeric result.
   */
  execute(): number {
    let raw: number;

    switch (this._operation) {
      case "ADD":
        raw = this._a + this._b;
        break;
      case "SUB":
        raw = this._a - this._b;
        break;
      case "AND":
        raw = this._a & this._b;
        break;
      case "OR":
        raw = this._a | this._b;
        break;
      case "XOR":
        raw = this._a ^ this._b;
        break;
      case "NOT":
        raw = ~this._a;
        break;
      case "SHL":
        raw = this._a << (this._b & 0xf);
        break;
      case "SHR":
        raw = this._a >>> (this._b & 0xf);
        break;
      case "NOP":
      default:
        raw = 0;
        break;
    }

    // Mask to bitWidth and update flags
    this._result = this.clamp(raw & this.max); //NAO ENTENDI
    this.carry = raw > this.max || raw < 0;
    this.zero = this._result === 0;
    this.negative = (this._result & (1 << (this.bitWidth - 1))) !== 0;

    return this._result;
  }

  /** Convenience: set operands + operation, execute, return result. */
  compute(op: UlaOperation, a: number, b: number = 0): number {
    this._operation = op;
    this._a = this.clamp(a);
    this._b = this.clamp(b);
    return this.execute();
  }

  /** Reset to default state. */
  reset(): void {
    this._operation = "NOP";
    this._a = 0;
    this._b = 0;
    this._result = 0;
    this.zero = true;
    this.carry = false;
    this.negative = false;
  }

  // ── Clockable callback ───────────────────────────────────────

  /**
   * Called by the global clock on each subscribed step.
   * On EXECUTE: runs the current operation.
   */
  onClockStep(step: ClockStep): void {
    switch (step) {
      case "EXECUTE":
        this.execute();
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
