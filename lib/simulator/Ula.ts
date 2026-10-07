import type { Clockable } from "./Clockable";
import { type Connectable, type PortMap, InputPort, OutputPort } from "./Port";
import { UlaOperation, FLAG_BITS } from "./ISA";


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
  /** Output: overflow flag (signed overflow) */
  readonly out_overflow: OutputPort<number>;
  /** Output: the four flags as one bus, Z C N V (see `FLAG_BITS`) */
  readonly out_flags: OutputPort<number>;

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
      "zero", "number", 1, 0,
      "Zero flag (result == 0)"
    );
    this.out_carry = new OutputPort<number>(
      "carry", "number", 1, 0,
      "Carry flag (unsigned carry-out of the adder)"
    );
    this.out_negative = new OutputPort<number>(
      "negative", "number", 1, 0,
      "Negative flag (MSB set)"
    );
    this.out_overflow = new OutputPort<number>(
      "overflow", "number", 1, 0,
      "Overflow flag (signed result out of range)"
    );
    this.out_flags = new OutputPort<number>(
      "flags", "number", 4, 0,
      "Flags bus: Z C N V"
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
      overflow: this.out_overflow,
      flags: this.out_flags,
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

  get overflow(): boolean {
    return this.out_overflow.value !== 0;
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
        // Two's-complement subtraction, the way the adder does it: A + ~B + 1.
        raw = a + (~b & this.max) + 1;
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

    // Mask to bitWidth and update flags. `raw & this.max` wraps the same way
    // the hardware does (2 - 5 → 0xFFFD at 16 bits).
    const result = this.clamp(raw & this.max);
    const sign = 1 << (this.bitWidth - 1);
    const arithmetic = op === UlaOperation.ADD || op === UlaOperation.SUB;
    // Carry is the adder's unsigned carry-out, for ADD and SUB alike — so on a
    // SUB it is 1 when there is NO borrow (A >= B). Bitwise ops never carry.
    const carry = arithmetic && raw > this.max ? 1 : 0;
    // Overflow: the signed result does not fit. ADD overflows when both operands
    // share a sign the result lacks; SUB when the operands differ in sign and
    // the result's sign differs from A's.
    let overflow = 0;
    if (op === UlaOperation.ADD) {
      overflow = (~(a ^ b) & (a ^ result) & sign) !== 0 ? 1 : 0;
    } else if (op === UlaOperation.SUB) {
      overflow = ((a ^ b) & (a ^ result) & sign) !== 0 ? 1 : 0;
    }
    const zero = result === 0 ? 1 : 0;
    const negative = (result & sign) !== 0 ? 1 : 0;

    // Update output ports (propagates to connected inputs immediately)
    this.out_result.set(result);
    this.out_carry.set(carry);
    this.out_zero.set(zero);
    this.out_negative.set(negative);
    this.out_overflow.set(overflow);
    this.out_flags.set(
      (zero << FLAG_BITS.zero) |
      (carry << FLAG_BITS.carry) |
      (negative << FLAG_BITS.negative) |
      (overflow << FLAG_BITS.overflow)
    );

    return result;
  }

  /** Convenience: set operands + operation, execute, return result. */
  compute(op: UlaOperation, a: number, b: number = 0): number {
    this.a = a;
    this.b = b;
    this.operation = op;
    return this.evaluate();
  }

  /** Reset to default state. Flags start cleared — nothing has been computed. */
  reset(): void {
    this.a = 0;
    this.b = 0;
    this.operation = UlaOperation.ADD;
    this.out_result.set(0);
    this.out_zero.set(0);
    this.out_carry.set(0);
    this.out_negative.set(0);
    this.out_overflow.set(0);
    this.out_flags.set(0);
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
