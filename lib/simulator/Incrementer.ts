import type { Clockable } from "./Clockable";
import { type Connectable, type PortMap, InputPort, OutputPort } from "./Port";

/**
 * Dedicated "+N" unit (N = 1 by default), used for PC+1.
 *
 * Unlike `Adder`, the increment is built into the hardware instead of arriving
 * on a second operand port. That removes the constant-1 register the datapath
 * used to need — a component that carried no teaching value and cost an extra
 * wire, an extra box on the canvas, and an evaluation-order dependency in the
 * PC → +1 → MUX → PC loop.
 *
 * One input, one output, nothing else.
 */
export class Incrementer implements Clockable, Connectable {
  /** Unique ID matching the ComponentInstance id on the canvas */
  readonly id: string;
  /** Human-readable name, e.g. "PC+1" */
  name: string;
  /** Bit width for the operand / result (default 16) */
  readonly bitWidth: number;
  /** How much is added on every evaluation (default 1) */
  readonly step: number;

  // ── Ports ────────────────────────────────────────────────────

  /** Input: the value to increment */
  readonly in_value: InputPort<number>;

  /** Output: input + step */
  readonly out_result: OutputPort<number>;

  /** Output: carry/overflow flag */
  readonly out_carry: OutputPort<number>;

  constructor(id: string, name: string, bitWidth = 16, step = 1) {
    this.id = id;
    this.name = name;
    this.bitWidth = bitWidth;
    this.step = step;

    this.in_value = new InputPort<number>(
      "in", "number", bitWidth, 0,
      "Value to increment",
    );
    this.out_result = new OutputPort<number>(
      "result", "number", bitWidth, this.clamp(step),
      `Input + ${step}`,
    );
    this.out_carry = new OutputPort<number>(
      "carry", "boolean", 1, 0,
      "Carry/overflow flag",
    );
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    return {
      in: this.in_value,
      result: this.out_result,
      carry: this.out_carry,
    };
  }

  // ── Convenience accessors ────────────────────────────────────

  get value(): number { return this.in_value.value; }
  set value(v: number) { this.in_value.set(this.clamp(v)); }

  get result(): number { return this.out_result.value; }

  /** Return the result as a zero-padded hex string. */
  resultHex(): string {
    const digits = Math.ceil(this.bitWidth / 4);
    return this.out_result.value.toString(16).padStart(digits, "0").toUpperCase();
  }

  // ── Core ─────────────────────────────────────────────────────

  /** Combinational phase: result = input + step. */
  evaluate(): number {
    const raw = this.in_value.value + this.step;
    const result = this.clamp(raw);
    this.out_result.set(result);
    this.out_carry.set(raw > this.max ? 1 : 0);
    return result;
  }

  /** Reset to default state. */
  reset(): void {
    this.in_value.set(0);
    this.out_result.set(this.clamp(this.step));
    this.out_carry.set(0);
  }

  // ── Clockable callback ───────────────────────────────────────

  onTick(): void {
    this.evaluate();
  }

  // ── Helpers ──────────────────────────────────────────────────

  private get max(): number {
    return (1 << this.bitWidth) - 1;
  }

  private clamp(v: number): number {
    return Math.max(0, Math.min(this.max, Math.floor(v)));
  }
}
