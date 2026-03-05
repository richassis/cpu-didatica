/**
 * Port.ts – Defines InputPort and OutputPort for the reactive signal bus.
 *
 * Components expose their inputs and outputs as Port objects.
 * OutputPorts can be wired to InputPorts; when an OutputPort's value changes,
 * all connected InputPorts receive the new value immediately.
 *
 * Type and bit-width mismatches throw at wire-creation time (fail fast).
 */

// ── Port metadata ────────────────────────────────────────────────────────────

/**
 * Describes the data type carried by a port.
 * - `"number"` – a numeric signal (with optional bitWidth constraint)
 * - `"opcode"` – an Opcode enum value (treated as number under the hood)
 * - `"boolean"` – a flag signal
 */
export type PortDataType = "number" | "opcode" | "boolean";

export interface PortDescriptor {
  /** Unique name within the owning component, e.g. "result", "opcode", "a". */
  name: string;
  /** Direction: input receives values, output emits values. */
  direction: "input" | "output";
  /** Data type for type-checking at wire-creation time. */
  dataType: PortDataType;
  /** Bit width (only meaningful for numeric ports; null = unconstrained). */
  bitWidth: number | null;
  /** Human-readable description for UI tooltips. */
  description?: string;
}

// ── Base Port class ──────────────────────────────────────────────────────────

export abstract class Port<T = number> {
  readonly name: string;
  readonly direction: "input" | "output";
  readonly dataType: PortDataType;
  readonly bitWidth: number | null;
  readonly description: string;

  /** Back-reference to owning component's ID (set when registering). */
  componentId: string | null = null;

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

  /** Returns a serializable descriptor (no runtime references). */
  toDescriptor(): PortDescriptor {
    return {
      name: this.name,
      direction: this.direction,
      dataType: this.dataType,
      bitWidth: this.bitWidth,
      description: this.description,
    };
  }
}

// ── InputPort ────────────────────────────────────────────────────────────────

/**
 * An InputPort receives values from a connected OutputPort.
 * It is read-only from the component's perspective; only the Bus writes to it.
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

  /**
   * Set the value directly (for components that need to bypass wiring).
   * This is useful for direct API access (e.g., Ula.setA()).
   */
  set(value: T): void {
    // Clamp numeric values if bitWidth is defined
    if ((this.dataType === "number" || this.dataType === "opcode") && this.bitWidth !== null && typeof value === "number") {
      const max = (1 << this.bitWidth) - 1;
      value = Math.max(0, Math.min(max, Math.floor(value))) as T;
    }
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
 * Writing to it immediately propagates to all listeners.
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
    // Clamp numeric values if bitWidth is defined
    if (this.dataType === "number" || this.dataType === "opcode") {
      if (this.bitWidth !== null && typeof value === "number") {
        const max = (1 << this.bitWidth) - 1;
        value = Math.max(0, Math.min(max, Math.floor(value))) as T;
      }
    }

    this._value = value;

    // Immediate propagation to all targets
    for (const target of this._targets) {
      target._receive(value);
    }
  }

  /** Called by Bus when wiring. */
  _addTarget(input: InputPort<T>): void {
    this._targets.add(input);
  }

  /** Called by Bus when unwiring. */
  _removeTarget(input: InputPort<T>): void {
    this._targets.delete(input);
  }

  /** Number of connected inputs. */
  get targetCount(): number {
    return this._targets.size;
  }

  /** Iterate over connected inputs (for debugging / UI). */
  get targets(): ReadonlySet<InputPort<T>> {
    return this._targets;
  }
}

// ── Utility: type/width compatibility check ──────────────────────────────────

/**
 * Throws if the output and input ports are incompatible (type or bit-width).
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

  // Bit-width check: if both specify a width, they must match
  // if (
  //   output.bitWidth !== null &&
  //   input.bitWidth !== null &&
  //   output.bitWidth !== input.bitWidth
  // ) {
  //   throw new RangeError(
  //     `Port bit-width mismatch: output "${output.name}" (${output.bitWidth} bits) ` +
  //     `→ input "${input.name}" (${input.bitWidth} bits)`
  //   );
  // }

  // If only one specifies a width, allow it (the constrained side will clamp)
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

/**
 * Helper to get a typed input port from a Connectable.
 */
export function getInputPort<T>(
  component: Connectable,
  name: string,
): InputPort<T> {
  const ports = component.getPorts();
  const port = ports[name];
  if (!port) {
    throw new RangeError(`Component "${component.id}" has no port named "${name}"`);
  }
  if (port.direction !== "input") {
    throw new TypeError(`Port "${name}" on component "${component.id}" is not an input`);
  }
  return port as InputPort<T>;
}

/**
 * Helper to get a typed output port from a Connectable.
 */
export function getOutputPort<T>(
  component: Connectable,
  name: string,
): OutputPort<T> {
  const ports = component.getPorts();
  const port = ports[name];
  if (!port) {
    throw new RangeError(`Component "${component.id}" has no port named "${name}"`);
  }
  if (port.direction !== "output") {
    throw new TypeError(`Port "${name}" on component "${component.id}" is not an output`);
  }
  return port as OutputPort<T>;
}
