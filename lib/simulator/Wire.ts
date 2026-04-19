/**
 * Wire.ts – Serializable connection descriptor.
 *
 * A Wire describes a connection from an OutputPort on one component
 * to an InputPort on another. It holds only IDs and names, no runtime refs.
 * The Bus resolves these to actual Port objects at runtime.
 */

import { v4 as uuid } from "uuid";

// ── Wire descriptor ──────────────────────────────────────────────────────────

export interface WireDescriptor {
  /** Unique identifier for this wire. */
  id: string;

  /** ID of the component that owns the source OutputPort. */
  sourceComponentId: string;
  /** Name of the OutputPort on the source component. */
  sourcePortName: string;

  /** ID of the component that owns the target InputPort. */
  targetComponentId: string;
  /** Name of the InputPort on the target component. */
  targetPortName: string;

  /** Optional label for UI display. */
  label?: string;

  /** Whether to render this wire visually (as a BusWidget). */
  visible?: boolean;

  /** Intermediate orthogonal waypoints used by the visual editor. */
  nodes?: Array<{ x: number; y: number }>;

  /** Optional UI color override. */
  color?: string;
}

// ── Wire class ───────────────────────────────────────────────────────────────

export class Wire {
  readonly id: string;
  readonly sourceComponentId: string;
  readonly sourcePortName: string;
  readonly targetComponentId: string;
  readonly targetPortName: string;
  label: string;
  visible: boolean;
  nodes: Array<{ x: number; y: number }>;
  color?: string;

  constructor(descriptor: Omit<WireDescriptor, "id"> & { id?: string }) {
    this.id                = descriptor.id ?? uuid();
    this.sourceComponentId = descriptor.sourceComponentId;
    this.sourcePortName    = descriptor.sourcePortName;
    this.targetComponentId = descriptor.targetComponentId;
    this.targetPortName    = descriptor.targetPortName;
    this.label             = descriptor.label ?? "";
    this.visible           = descriptor.visible ?? true;
    this.nodes             = descriptor.nodes ?? [];
    this.color             = descriptor.color;
  }

  /** Serialize to a plain object for persistence. */
  toDescriptor(): WireDescriptor {
    return {
      id: this.id,
      sourceComponentId: this.sourceComponentId,
      sourcePortName: this.sourcePortName,
      targetComponentId: this.targetComponentId,
      targetPortName: this.targetPortName,
      label: this.label,
      visible: this.visible,
      nodes: this.nodes,
      color: this.color,
    };
  }

  /** Create a Wire instance from a persisted descriptor. */
  static fromDescriptor(desc: WireDescriptor): Wire {
    return new Wire(desc);
  }

  /** Human-readable string for debugging. */
  toString(): string {
    return `Wire[${this.id.slice(0, 8)}]: ${this.sourceComponentId}.${this.sourcePortName} → ${this.targetComponentId}.${this.targetPortName}`;
  }
}
