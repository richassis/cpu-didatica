import type { Clockable } from "./Clockable";
import { type Connectable, type PortMap, InputPort, OutputPort } from "./Port";

/**
 * Multiplexer (Mux) data model.
 *
 * Selects one of 2 or 3 data inputs and forwards it to the output.
 * The selection is driven by the `sel` input port:
 *   - sel == 0  →  out = in0
 *   - sel == 1  →  out = in1
 *   - sel == 2  →  out = in2  (only when numInputs == 3)
 *
 * All data ports share the same bitWidth.
 */
export class Mux implements Clockable, Connectable {
  /** Unique ID matching the ComponentInstance id on the canvas */
  readonly id: string;
  /** Human-readable name */
  name: string;
  /** Bit width of each data port (default 16) */
  readonly bitWidth: number;
  /** Number of data inputs: 2 or 3 (default 2) */
  readonly numInputs: 2 | 3;

  // ── Ports ────────────────────────────────────────────────────

  /** Data input 0 */
  readonly in_0: InputPort<number>;
  /** Data input 1 */
  readonly in_1: InputPort<number>;
  /** Data input 2 (only used when numInputs == 3) */
  readonly in_2: InputPort<number> | null;

  /** Select signal — chooses which input to forward */
  readonly in_sel: InputPort<number>;

  /** Output: the selected input value */
  readonly out_result: OutputPort<number>;

  constructor(id: string, name: string, bitWidth = 16, numInputs: 2 | 3 = 2) {
    this.id        = id;
    this.name      = name;
    this.bitWidth  = bitWidth;
    this.numInputs = numInputs;

    this.in_0 = new InputPort<number>("in_0", "number", bitWidth, 0, "Data input 0");
    this.in_1 = new InputPort<number>("in_1", "number", bitWidth, 0, "Data input 1");
    this.in_2 = numInputs === 3
      ? new InputPort<number>("in_2", "number", bitWidth, 0, "Data input 2")
      : null;

    // sel bit width: 1 bit for 2 inputs, 2 bits for 3 inputs
    const selBits = numInputs === 3 ? 2 : 1;
    this.in_sel = new InputPort<number>("in_sel", "number", selBits, 0, "Select signal");

    this.out_result = new OutputPort<number>("out_result", "number", bitWidth, 0, "Selected output");
  }

  // ── Connectable interface ────────────────────────────────────

  getPorts(): PortMap {
    const ports: PortMap = {
      in_0:   this.in_0,
      in_1:   this.in_1,
      sel:    this.in_sel,
      result: this.out_result,
    };
    if (this.in_2) {
      ports["in_2"] = this.in_2;
    }
    return ports;
  }

  // ── Accessors ────────────────────────────────────────────────

  get sel(): number { return this.in_sel.value; }

  get result(): number { return this.out_result.value; }

  resultHex(): string {
    const digits = Math.ceil(this.bitWidth / 4);
    return this.out_result.value.toString(16).padStart(digits, "0").toUpperCase();
  }

  // ── Core ─────────────────────────────────────────────────────

  /**
   * Combinational phase: read sel, pick the corresponding input, update output.
   */
  evaluate(): number {
    const sel = this.clamp(this.in_sel.value, this.numInputs === 3 ? 2 : 1);
    let result: number;
    switch (sel) {
      case 2: result = this.in_2?.value ?? 0; break;
      case 1: result = this.in_1.value;       break;
      default: result = this.in_0.value;      break;
    }
    this.out_result.set(result);
    return result;
  }

  reset(): void {
    this.in_0.set(0);
    this.in_1.set(0);
    this.in_2?.set(0);
    this.in_sel.set(0);
    this.out_result.set(0);
  }

  // ── Clockable callback ───────────────────────────────────────

  onTick(): void {
    this.evaluate();
  }

  // ── Helpers ──────────────────────────────────────────────────

  private get max(): number {
    return (1 << this.bitWidth) - 1;
  }

  private clamp(v: number, selMax: number): number {
    return Math.max(0, Math.min(selMax, Math.floor(v)));
  }
}
