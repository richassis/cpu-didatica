import type { Clockable } from "./Clockable";
import { type Connectable, type PortMap, OutputPort } from "./Port";

/**
 * Constant source component.
 *
 * Exposes a single output port (`value`) that always drives a fixed numeric
 * value (N). Useful for constants like 0, 1, masks, and immediate sources.
 */
export class Constant implements Connectable, Clockable {
  readonly id: string;
  name: string;
  readonly bitWidth: number;

  private _constantValue: number;

  /** Output: fixed constant value. */
  readonly out_value: OutputPort<number>;

  constructor(id: string, name: string, bitWidth = 16, constantValue = 1) {
    this.id = id;
    this.name = name;
    this.bitWidth = bitWidth;
    this._constantValue = this.clamp(constantValue);

    this.out_value = new OutputPort<number>(
      "value",
      "number",
      bitWidth,
      this._constantValue,
      "Constant numeric output"
    );
  }

  getPorts(): PortMap {
    return {
      value: this.out_value,
    };
  }

  get value(): number {
    return this._constantValue;
  }

  setConstantValue(v: number): void {
    this._constantValue = this.clamp(v);
    this.out_value.set(this._constantValue);
  }

  reset(): void {
    this.out_value.set(this._constantValue);
  }

  onTick(): void {
    // Keep driving the constant through connected wires.
    this.out_value.set(this._constantValue);
  }

  private get max(): number {
    return (1 << this.bitWidth) - 1;
  }

  private clamp(v: number): number {
    return Math.max(0, Math.min(this.max, Math.floor(v)));
  }
}
