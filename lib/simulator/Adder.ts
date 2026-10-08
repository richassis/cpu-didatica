import type { Clockable } from "./Clockable";
import { type Connectable, type PortMap, InputPort, OutputPort } from "./Port";

/**
 * Data model for the hardware Adder (dedicated ADD unit).
 *
 * Always performs A + B: two operand inputs, a result and a carry output,
 * no operation selector. Not part of the default datapath — PC+1 is done by
 * the `Incrementer`.
 */
export class Adder implements Clockable, Connectable {
  /** Unique ID matching the ComponentInstance id on the canvas */
  readonly id: string;
  /** Human-readable name, e.g. "ADD1" */
  name: string;
  /** Bit width for operands / result (default 16) */
  readonly bitWidth: number;

  // ── Ports ────────────────────────────────────────────────────

  /** Input: operand A */
  readonly in_a: InputPort<number>;
  /** Input: operand B */
  readonly in_b: InputPort<number>;

  /** Output: A + B */
  readonly out_result: OutputPort<number>;
  /** Output: carry/overflow flag */
  readonly out_carry: OutputPort<number>;

  constructor(id: string, name: string, bitWidth = 16) {
    this.id = id;
    this.name = name;
    this.bitWidth = bitWidth;

    this.in_a = new InputPort<number>(
      "operand_a", "number", bitWidth, 0,
      "Operand A"
    );
    this.in_b = new InputPort<number>(
      "operand_b", "number", bitWidth, 0,
      "Operand B"
    );
    this.out_result = new OutputPort<number>(
      "result", "number", bitWidth, 0,
      "A + B result"
    );
    this.out_carry = new OutputPort<number>(
      "carry", "boolean", 1, 0,
      "Carry/overflow flag"
    );
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    return {
      a:      this.in_a,
      b:      this.in_b,
      result: this.out_result,
      carry:  this.out_carry,
    };
  }

  // ── Core ─────────────────────────────────────────────────────

  /**
   * Combinational phase: execute A + B and update outputs.
   * Returns the numeric result.
   */
  evaluate(): number {
    const raw = this.in_a.value + this.in_b.value;
    const max = this.max;
    const result = this.clamp(raw);
    this.out_result.set(result);
    this.out_carry.set(raw > max ? 1 : 0);
    return result;
  }

  /** Reset to default state. */
  reset(): void {
    this.in_a.set(0);
    this.in_b.set(0);
    this.out_result.set(0);
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
