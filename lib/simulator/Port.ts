/**
 * Port.ts – Defines InputPort and OutputPort for the reactive signal bus.
 *
 * Components expose their inputs and outputs as Port objects.
 * OutputPorts can be wired to InputPorts; when an OutputPort's value changes,
 * all connected InputPorts receive the new value immediately.
 *
 * Data-type mismatches throw at wire-creation time (fail fast). Bit widths
 * are not compared (see `assertPortsCompatible`).
 */

// ── Port metadata ────────────────────────────────────────────────────────────

/**
 * Describes the data type carried by a port.
 * - `"number"` – a numeric signal (with optional bitWidth constraint)
 * - `"opcode"` – an Opcode enum value (treated as number under the hood)
 *
 * A one-bit signal (an enable, a flag) is a `"number"` of width 1 carrying 0/1.
 */
export type PortDataType = "number" | "opcode";

export interface PortDescriptor {
  /** Unique name within the owning component, e.g. "result", "opcode", "a". */
  name: string;
  /** Direction: input receives values, output emits values. */
  direction: "input" | "output";
  /** Data type for type-checking at wire-creation time. */
  dataType: PortDataType;
  /** Bit width (only meaningful for numeric ports; null = unconstrained). */
  bitWidth: number | null;
  /** Human-readable description of what the port carries (documentation only). */
  description?: string;
}

/** Clamp a numeric value into the port's bit width (no-op when unconstrained). */
function clampToWidth<T>(value: T, bitWidth: number | null): T {
  if (bitWidth === null || typeof value !== "number") return value;
  const max = (1 << bitWidth) - 1;
  return Math.max(0, Math.min(max, Math.floor(value))) as T;
}

// ── Base Port class ──────────────────────────────────────────────────────────

export abstract class Port<T = number> {
  readonly name: string;
  readonly direction: "input" | "output";
  readonly dataType: PortDataType;
  readonly bitWidth: number | null;
  readonly description: string;

  protected _value: T;

  constructor(descriptor: PortDescriptor, initialValue: T) {
    this.name        = descriptor.name;
    this.direction   = descriptor.direction;
    this.dataType    = descriptor.dataType;
    this.bitWidth    = descriptor.bitWidth;
    this.description = descriptor.description ?? "";
    this._value      = initialValue;
  }

  /** Current value (read-only from outside; subclasses control writes). */
  get value(): T {
    return this._value;
  }
}

// ── InputPort ────────────────────────────────────────────────────────────────

/**
 * An InputPort receives values from a connected OutputPort.
 * Its owning component only reads it; the value arrives through the wire, or
 * through `set()` when something outside the wiring (a reset, a snapshot
 * restore, the editor) writes it directly.
 */
export class InputPort<T = number> extends Port<T> {
  /** The OutputPort currently driving this input (null if unconnected). */
  private _source: OutputPort<T> | null = null;

  /** Optional callback when value changes. */
  onChange: ((value: T) => void) | null = null;

  constructor(
    name: string,
    dataType: PortDataType,
    bitWidth: number | null,
    initialValue: T,
    description?: string,
  ) {
    super({ name, direction: "input", dataType, bitWidth, description }, initialValue);
  }

  /** Get the current value. */
  get(): T {
    return this._value;
  }

  /** Set the value directly, bypassing the wire. */
  set(value: T): void {
    value = clampToWidth(value, this.bitWidth);
    this._value = value;
    if (this.onChange) {
      this.onChange(value);
    }
  }

  /** Called by Bus when wiring. */
  _setSource(source: OutputPort<T> | null): void {
    this._source = source;
    if (source) {
      this._value = source.value;
    }
  }

  /** Called by the connected OutputPort when its value changes. */
  _receive(value: T): void {
    this._value = value;
    if (this.onChange) {
      this.onChange(value);
    }
  }

  /** Returns the connected source, if any. */
  get source(): OutputPort<T> | null {
    return this._source;
  }

  /** True if this port is connected to an output. */
  get isConnected(): boolean {
    return this._source !== null;
  }
}

// ── OutputPort ───────────────────────────────────────────────────────────────

/**
 * An OutputPort emits values to all connected InputPorts.
 * `set()` propagates immediately; `setWithoutPropagate()` changes only this port.
 */
export class OutputPort<T = number> extends Port<T> {
  /** All InputPorts currently connected to this output. */
  private readonly _targets: Set<InputPort<T>> = new Set();

  constructor(
    name: string,
    dataType: PortDataType,
    bitWidth: number | null,
    initialValue: T,
    description?: string,
  ) {
    super({ name, direction: "output", dataType, bitWidth, description }, initialValue);
  }

  /**
   * Set the output value and immediately propagate to all connected inputs.
   */
  set(value: T): void {
    value = clampToWidth(value, this.bitWidth);
    this._value = value;

    // Immediate propagation to all targets
    for (const target of this._targets) {
      target._receive(value);
    }
  }

  /**
   * Set the output value WITHOUT propagating to connected inputs. The timeline
   * uses it to reveal one component's outputs without pushing them into the
   * components downstream (see `displayMaskStore`).
   */
  setWithoutPropagate(value: T): void {
    value = clampToWidth(value, this.bitWidth);
    this._value = value;
  }

  /** Called by Bus when wiring. */
  _addTarget(input: InputPort<T>): void {
    this._targets.add(input);
  }

  /** Called by Bus when unwiring. */
  _removeTarget(input: InputPort<T>): void {
    this._targets.delete(input);
  }
}

// ── Utility: type/width compatibility check ──────────────────────────────────

/**
 * Throws if the output and input ports carry different data types.
 */
export function assertPortsCompatible(
  output: OutputPort<unknown>,
  input: InputPort<unknown>,
): void {
  if (output.dataType !== input.dataType) {
    throw new TypeError(
      `Port type mismatch: output "${output.name}" (${output.dataType}) ` +
      `→ input "${input.name}" (${input.dataType})`
    );
  }

  // Bit widths are not compared: a wire delivers the source's value
  // unchanged, whatever width the input declares.
}

// ── Connectable interface ────────────────────────────────────────────────────

/** Map of port name → Port instance. */
export type PortMap = Record<string, Port<unknown>>;

/**
 * Any simulator component that exposes ports should implement this interface.
 */
export interface Connectable {
  /** Unique component ID. */
  readonly id: string;
  /** Returns the map of port name → Port instance. */
  getPorts(): PortMap;
}
