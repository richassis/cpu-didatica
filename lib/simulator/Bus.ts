/**
 * Bus.ts – The runtime manager for wires between component ports.
 *
 * Responsibilities:
 *  • Register Connectable components
 *  • Create and destroy wires (with port direction and data-type validation)
 *  • Resolve wire descriptors to actual Port objects
 *  • Serialize/deserialize the wiring configuration
 *
 * Cycles are not rejected: the datapath has legitimate loops (PC → PC+1 →
 * MUX_PC → PC). They can't run away, because a port only pushes its value to
 * the inputs wired to it, and the CPU caps re-evaluation per tick
 * (`MAX_EVALUATE_PASSES`).
 */

import {
  Connectable,
  InputPort,
  OutputPort,
  assertPortsCompatible,
} from "./Port";
import { Wire, WireDescriptor } from "./Wire";

// ── Bus class ────────────────────────────────────────────────────────────────

export class Bus {
  /** All registered components by ID. */
  private readonly _components: Map<string, Connectable> = new Map();

  /** All active wires by ID. */
  private readonly _wires: Map<string, Wire> = new Map();

  // ── Component registration ─────────────────────────────────────────────────

  /** Register a Connectable component so its ports can be wired. */
  registerComponent(component: Connectable): void {
    if (this._components.has(component.id)) {
      throw new Error(`Component "${component.id}" is already registered`);
    }
    this._components.set(component.id, component);
  }

  /**
   * Unregister a component, removing all wires connected to it.
   */
  unregisterComponent(componentId: string): void {
    // Remove all wires involving this component
    for (const wire of this._wires.values()) {
      if (
        wire.sourceComponentId === componentId ||
        wire.targetComponentId === componentId
      ) {
        this.removeWire(wire.id);
      }
    }
    this._components.delete(componentId);
  }

  /** Get a registered component by ID. */
  getComponent(id: string): Connectable | undefined {
    return this._components.get(id);
  }

  // ── Wire management ────────────────────────────────────────────────────────

  /**
   * Create a wire from an output port to an input port.
   *
   * Validates:
   *  • Both components exist
   *  • Ports exist and have correct directions
   *  • Data-type compatibility (bit widths are not compared)
   *  • No existing wire to the same input (inputs have single source)
   *
   * @returns The created Wire instance.
   */
  createWire(
    sourceComponentId: string,
    sourcePortName: string,
    targetComponentId: string,
    targetPortName: string,
    options?: {
      label?: string;
      visible?: boolean;
      id?: string;
      nodes?: Array<{ x: number; y: number }>;
      color?: string;
    },
  ): Wire {
    // Resolve components
    const sourceComponent = this._components.get(sourceComponentId);
    if (!sourceComponent) {
      throw new RangeError(`Source component "${sourceComponentId}" not found`);
    }
    const targetComponent = this._components.get(targetComponentId);
    if (!targetComponent) {
      throw new RangeError(`Target component "${targetComponentId}" not found`);
    }

    // Resolve ports
    const sourcePort = sourceComponent.getPorts()[sourcePortName];
    if (!sourcePort) {
      throw new RangeError(
        `Source port "${sourcePortName}" not found on component "${sourceComponentId}"`
      );
    }
    if (sourcePort.direction !== "output") {
      throw new TypeError(
        `Port "${sourcePortName}" on component "${sourceComponentId}" is not an output`
      );
    }

    const targetPort = targetComponent.getPorts()[targetPortName];
    if (!targetPort) {
      throw new RangeError(
        `Target port "${targetPortName}" not found on component "${targetComponentId}"`
      );
    }
    if (targetPort.direction !== "input") {
      throw new TypeError(
        `Port "${targetPortName}" on component "${targetComponentId}" is not an input`
      );
    }

    // Data-type compatibility
    assertPortsCompatible(
      sourcePort as OutputPort<unknown>,
      targetPort as InputPort<unknown>
    );

    // Check: input can only have one source
    const inputPort = targetPort as InputPort<unknown>;
    if (inputPort.isConnected) {
      throw new Error(
        `Input port "${targetPortName}" on component "${targetComponentId}" is already connected`
      );
    }

    // Create the wire
    const wire = new Wire({
      id: options?.id,
      sourceComponentId,
      sourcePortName,
      targetComponentId,
      targetPortName,
      label: options?.label,
      visible: options?.visible,
      nodes: options?.nodes,
      color: options?.color,
    });

    // Connect the ports
    const outputPort = sourcePort as OutputPort<unknown>;
    outputPort._addTarget(inputPort);
    inputPort._setSource(outputPort);

    // Store the wire
    this._wires.set(wire.id, wire);

    return wire;
  }

  /**
   * Remove a wire by its ID.
   */
  removeWire(wireId: string): boolean {
    const wire = this._wires.get(wireId);
    if (!wire) return false;

    // Resolve the ports
    const sourceComponent = this._components.get(wire.sourceComponentId);
    const targetComponent = this._components.get(wire.targetComponentId);

    if (sourceComponent && targetComponent) {
      const sourcePort = sourceComponent.getPorts()[wire.sourcePortName] as OutputPort<unknown> | undefined;
      const targetPort = targetComponent.getPorts()[wire.targetPortName] as InputPort<unknown> | undefined;

      if (sourcePort && targetPort) {
        sourcePort._removeTarget(targetPort);
        targetPort._setSource(null);
      }
    }

    this._wires.delete(wireId);
    return true;
  }

  /** List all wires. */
  get wires(): Wire[] {
    return Array.from(this._wires.values());
  }

  /** List all wire IDs. */
  getWireIds(): string[] {
    return Array.from(this._wires.keys());
  }

  /** List all wire descriptors (for serialization). */
  get wireDescriptors(): WireDescriptor[] {
    return this.wires.map(w => w.toDescriptor());
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  /**
   * Serialize the wiring configuration to a JSON-safe array.
   * Does NOT include component registrations (those come from the layout).
   */
  serialize(): WireDescriptor[] {
    return this.wireDescriptors;
  }

  /**
   * Deserialize wires from a saved configuration.
   * Components must already be registered before calling this.
   *
   * @param descriptors - Array of wire descriptors from `serialize()`.
   * @param skipInvalid - If true, skip wires that can't be created (missing component/port).
   */
  deserialize(descriptors: WireDescriptor[], skipInvalid = false): void {
    for (const desc of descriptors) {
      try {
        this.createWire(
          desc.sourceComponentId,
          desc.sourcePortName,
          desc.targetComponentId,
          desc.targetPortName,
          {
            id: desc.id,
            label: desc.label,
            visible: desc.visible,
            nodes: desc.nodes,
            color: desc.color,
          }
        );
      } catch (e) {
        if (!skipInvalid) throw e;
        // Only log in development mode
        if (process.env.NODE_ENV === "development") {
          console.warn(`[Bus] Skipping invalid wire: ${(e as Error).message}`);
        }
      }
    }
  }
}
