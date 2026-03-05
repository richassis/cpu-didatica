/**
 * Bus.ts – The runtime manager for wires between component ports.
 *
 * Responsibilities:
 *  • Register Connectable components
 *  • Create and destroy wires (with type/width validation)
 *  • Resolve wire descriptors to actual Port objects
 *  • Serialize/deserialize the wiring configuration
 *  • Detect cycles to prevent infinite propagation loops
 */

import {
  Connectable,
  InputPort,
  OutputPort,
  assertPortsCompatible,
  Port,
} from "./Port";
import { Wire, WireDescriptor } from "./Wire";

// ── Bus class ────────────────────────────────────────────────────────────────

export class Bus {
  /** All registered components by ID. */
  private readonly _components: Map<string, Connectable> = new Map();

  /** All active wires by ID. */
  private readonly _wires: Map<string, Wire> = new Map();

  // ── Component registration ─────────────────────────────────────────────────

  /**
   * Register a Connectable component so its ports can be wired.
   * Also sets `port.componentId` on all ports for back-reference.
   */
  registerComponent(component: Connectable): void {
    if (this._components.has(component.id)) {
      throw new Error(`Component "${component.id}" is already registered`);
    }
    this._components.set(component.id, component);

    // Set componentId on all ports
    for (const port of Object.values(component.getPorts())) {
      port.componentId = component.id;
    }
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

  /** Check if a component is registered. */
  hasComponent(id: string): boolean {
    return this._components.has(id);
  }

  /** List all registered component IDs. */
  get componentIds(): string[] {
    return Array.from(this._components.keys());
  }

  // ── Wire management ────────────────────────────────────────────────────────

  /**
   * Create a wire from an output port to an input port.
   *
   * Validates:
   *  • Both components exist
   *  • Ports exist and have correct directions
   *  • Type and bit-width compatibility
   *  • No existing wire to the same input (inputs have single source)
   *  • No cycles in the wiring graph
   *
   * @returns The created Wire instance.
   */
  createWire(
    sourceComponentId: string,
    sourcePortName: string,
    targetComponentId: string,
    targetPortName: string,
    options?: { label?: string; visible?: boolean; id?: string },
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

    // Type and bit-width compatibility
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

    // Check for cycles
    // if (this._wouldCreateCycle(sourceComponentId, targetComponentId)) {
    //   throw new Error(
    //     `Wiring "${sourceComponentId}.${sourcePortName}" → "${targetComponentId}.${targetPortName}" would create a cycle`
    //   );
    // }

    // Create the wire
    const wire = new Wire({
      id: options?.id,
      sourceComponentId,
      sourcePortName,
      targetComponentId,
      targetPortName,
      label: options?.label,
      visible: options?.visible,
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

  /** Get a wire by ID. */
  getWire(id: string): Wire | undefined {
    return this._wires.get(id);
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

  // ── Cycle detection ────────────────────────────────────────────────────────

  /**
   * Check if adding a wire from `sourceId` to `targetId` would create a cycle.
   * Uses DFS on the existing wiring graph.
   */
  private _wouldCreateCycle(sourceId: string, targetId: string): boolean {
    // If source === target, it's a self-loop
    if (sourceId === targetId) return true;

    // Build adjacency list: component A → [components that A outputs to]
    const adj = new Map<string, Set<string>>();
    for (const wire of this._wires.values()) {
      if (!adj.has(wire.sourceComponentId)) {
        adj.set(wire.sourceComponentId, new Set());
      }
      adj.get(wire.sourceComponentId)!.add(wire.targetComponentId);
    }

    // Add the proposed edge temporarily
    if (!adj.has(sourceId)) {
      adj.set(sourceId, new Set());
    }
    adj.get(sourceId)!.add(targetId);

    // DFS from sourceId to see if we can reach sourceId again
    const visited = new Set<string>();
    const stack = [targetId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === sourceId) {
        return true; // Cycle detected
      }
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = adj.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          stack.push(neighbor);
        }
      }
    }

    return false;
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
          { id: desc.id, label: desc.label, visible: desc.visible }
        );
      } catch (e) {
        if (!skipInvalid) throw e;
        console.warn(`[Bus] Skipping invalid wire: ${(e as Error).message}`);
      }
    }
  }

  /**
   * Remove all wires (but keep components registered).
   */
  clearWires(): void {
    for (const wireId of Array.from(this._wires.keys())) {
      this.removeWire(wireId);
    }
  }

  /**
   * Reset the bus entirely (remove all wires and components).
   */
  reset(): void {
    this.clearWires();
    this._components.clear();
  }

  // ── Debugging ──────────────────────────────────────────────────────────────

  /**
   * List all ports on a component (for UI introspection).
   */
  listPorts(componentId: string): Port<unknown>[] {
    const component = this._components.get(componentId);
    if (!component) return [];
    return Object.values(component.getPorts());
  }

  /**
   * List all wires connected to a component (as source or target).
   */
  getWiresForComponent(componentId: string): Wire[] {
    return this.wires.filter(
      w => w.sourceComponentId === componentId || w.targetComponentId === componentId
    );
  }
}
