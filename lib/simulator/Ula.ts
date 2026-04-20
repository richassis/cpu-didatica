import type { Clockable } from "./Clockable";
import { type Connectable, type PortMap, InputPort, OutputPort } from "./Port";
import { UlaOperation } from "./ISA";


/**
 * Supported ALU operations.
 * Extend this union as new operations are added.
 */

/**
 * Data model for the Arithmetic Logic Unit (ULA / ALU).
 *
 * Holds two operand inputs, an operation selector, and produces a result
 * plus status flags.  The UI UlaComponent reads from this object.
 */
export class Ula implements Clockable, Connectable {
  /** Unique ID matching the ComponentInstance id on the canvas */
  readonly id: string;
  /** Human-readable name, e.g. "ULA1" */
  name: string;
  /** Bit width for operands / result (default 16) */
  readonly bitWidth: number;

  // ── Ports ────────────────────────────────────────────────────

  /** Input: operand A */
  readonly in_a: InputPort<number>;
  /** Input: operand B */
  readonly in_b: InputPort<number>;
  /** Input: operation selector (UlaOperation enum value) */
  readonly in_operation: InputPort<number>;

  /** Output: computation result */
  readonly out_result: OutputPort<number>;
  /** Output: zero flag */
  readonly out_zero: OutputPort<number>;
  /** Output: carry flag */
  readonly out_carry: OutputPort<number>;
  /** Output: negative flag */
  readonly out_negative: OutputPort<number>;

  constructor(id: string, name: string, bitWidth = 16) {
    this.id = id;
    this.name = name;
    this.bitWidth = bitWidth;

    // Create input ports
    this.in_a = new InputPort<number>(
      "operand_a", "number", bitWidth, 0,
      "Operand A"
    );
    this.in_b = new InputPort<number>(
      "operand_b", "number", bitWidth, 0,
      "Operand B"
    );
    this.in_operation = new InputPort<number>(
      "operation", "number", 3, UlaOperation.ADD,
      "Operation selector (UlaOperation enum)"
    );

    // Create output ports
    this.out_result = new OutputPort<number>(
      "result", "number", bitWidth, 0,
      "Computation result"
    );
    this.out_zero = new OutputPort<number>(
      "zero", "boolean", 1, 1,
      "Zero flag (result == 0)"
    );
    this.out_carry = new OutputPort<number>(
      "carry", "boolean", 1, 0,
      "Carry/overflow flag"
    );
    this.out_negative = new OutputPort<number>(
      "negative", "boolean", 1, 0,
      "Negative flag (MSB set)"
    );
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    return {
      a: this.in_a,
      b: this.in_b,
      operation: this.in_operation,
      result: this.out_result,
      zero: this.out_zero,
      carry: this.out_carry,
      negative: this.out_negative,
    };
  }

  // ── Convenience accessors (read/write via ports) ─────────────

  get operation(): UlaOperation {
    return this.in_operation.value as UlaOperation;
  }

  set operation(op: UlaOperation) {
    this.in_operation.set(op);
  }

  get a(): number {
    return this.in_a.value;
  }

  set a(v: number) {
    this.in_a.set(this.clamp(v));
  }

  get b(): number {
    return this.in_b.value;
  }

  set b(v: number) {
    this.in_b.set(this.clamp(v));
  }

  get result(): number {
    return this.out_result.value;
  }

  get zero(): boolean {
    return this.out_zero.value !== 0;
  }

  get carry(): boolean {
    return this.out_carry.value !== 0;
  }

  get negative(): boolean {
    return this.out_negative.value !== 0;
  }

  /** Return the result as a zero-padded hex string. */
  resultHex(): string {
    const digits = Math.ceil(this.bitWidth / 4);
    return this.out_result.value.toString(16).padStart(digits, "0").toUpperCase();
  }

  // ── Core ─────────────────────────────────────────────────────

  /**
   * Combinational phase: execute the current operation on a and b, storing the result
   * and updating status flags. Returns the numeric result.
   */
  evaluate(): number {
    const a = this.in_a.value;
    const b = this.in_b.value;
    const op = this.in_operation.value as UlaOperation;
    let raw: number;

    switch (op) {
      case UlaOperation.ADD:
        raw = a + b;
        break;
      case UlaOperation.SUB:
        raw = a - b;
        break;
      case UlaOperation.AND:
        raw = a & b;
        break;
      case UlaOperation.OR:
        raw = a | b;
        break;
      case UlaOperation.NOT:
        raw = ~a;
        break;
      default:
        raw = 0;
        break;
    }

    // Mask to bitWidth and update flags
    const result = this.clamp(raw & this.max);
    const carry = raw > this.max || raw < 0 ? 1 : 0;
    const zero = result === 0 ? 1 : 0;
    const negative = (result & (1 << (this.bitWidth - 1))) !== 0 ? 1 : 0;

    // Update output ports (propagates to connected inputs immediately)
    this.out_result.set(result);
    this.out_carry.set(carry);
    this.out_zero.set(zero);
    this.out_negative.set(negative);

    return result;
  }

  /** Convenience: set operands + operation, execute, return result. */
  compute(op: UlaOperation, a: number, b: number = 0): number {
    this.a = a;
    this.b = b;
    this.operation = op;
    return this.evaluate();
  }

  /** Reset to default state. */
  reset(): void {
    this.a = 0;
    this.b = 0;
    this.operation = UlaOperation.ADD;
    this.out_result.set(0);
    this.out_zero.set(1);
    this.out_carry.set(0);
    this.out_negative.set(0);
  }

  // ── Clockable callback ───────────────────────────────────────

  /**
   * Called by the global clock on each tick.
   * Executes the ULA operation with current inputs.
   */
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
