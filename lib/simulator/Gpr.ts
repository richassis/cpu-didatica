import { Register } from "./Register";
import type { ClockStep, Clockable } from "./Clockable";

/**
 * Data model for a General Purpose Register bank.
 *
 * Contains N registers (default 8: R0–R7), each with the same bit width.
 * The UI GprComponent reads from this object.
 */
export class Gpr implements Clockable {
  // ── Clockable ────────────────────────────────────────────────
  readonly clockSteps: ClockStep[] = ["WRITEBACK"];
  /** Unique ID matching the ComponentInstance id on the canvas */
  readonly id: string;
  /** Human-readable bank name, e.g. "GPR1" */
  name: string;
  /** The ordered list of registers in this bank */
  readonly registers: Register[];

  constructor(
    id: string,
    name: string,
    registerCount = 8,
    bitWidth = 16,
  ) {
    this.id = id;
    this.name = name;
    this.registers = Array.from(
      { length: registerCount },
      (_, i) =>
        new Register(
          `${id}__R${i}`,
          `R${i}`,
          bitWidth,
          0,
        ),
    );
  }

  // ── Accessors ────────────────────────────────────────────────

  /** Number of registers in this bank. */
  get count(): number {
    return this.registers.length;
  }

  /** Read a register by index. */
  read(index: number): number {
    this.assertIndex(index);
    return this.registers[index].value;
  }

  /** Read a register and return its hex string. */
  readHex(index: number): string {
    this.assertIndex(index);
    return this.registers[index].toHex();
  }

  /** Write a value into a register by index. */
  write(index: number, value: number): void {
    this.assertIndex(index);
    this.registers[index].value = value;
  }

  // ── Bulk operations (stubs) ──────────────────────────────────

  /** Reset every register to zero. */
  resetAll(): void {
    for (const r of this.registers) r.reset();
  }

  /** Return a snapshot of all register values (useful for diffing / UI). */
  snapshot(): { name: string; value: number }[] {
    return this.registers.map((r) => ({ name: r.name, value: r.value }));
  }

  snapshotHex(): { name: string; value: string }[] {
    return this.registers.map((r) => ({ name: r.name, value: r.toHex() }));
  }

  // ── Clockable callback ───────────────────────────────────────

  /**
   * Called by the global clock on each subscribed step.
   * Delegates to child registers so they can latch independently.
   */
  onClockStep(step: ClockStep): void {
    switch (step) {
      case "WRITEBACK":
        // for (const r of this.registers) {
        //   r.onClockStep(step);
        // }
        break;
      default:
        break;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private assertIndex(i: number): void {
    if (i < 0 || i >= this.registers.length) {
      throw new RangeError(
        `Register index ${i} out of range [0, ${this.registers.length - 1}]`,
      );
    }
  }
}
